// Rounds API: create a round, join by QR/code, score, settle.
//
// Identity is deliberately light: friends type a name when they join and the
// browser remembers it. Anyone in a round may edit any score; every write is
// recorded with the name of whoever made it ("edited by" notes).
import crypto from "node:crypto";
import { pool, tx } from "./db.js";
import { GAME_PRESETS, computeStandings, normalizeGame, rulesFor, validateSetup } from "./engine/games.js";
import { computeSettlement, normalizeBets, normalizeMeal, MEAL_METHODS } from "./engine/settle.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_PLAYERS = 16;

function genCode() {
  const bytes = crypto.randomBytes(6);
  return Array.from(bytes, b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function cleanName(v, max = 40) {
  const s = String(v ?? "").replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
  return s;
}

function actor(req) {
  return cleanName(req.body?.by || req.get("X-Player-Name") || "Someone", 40) || "Someone";
}

function clampInt(v, lo, hi, dflt) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt;
}

function parsePars(raw, holes) {
  let arr = Array.isArray(raw) ? raw : [];
  arr = arr.slice(0, holes).map(p => clampInt(p, 3, 6, 4));
  while (arr.length < holes) arr.push(4);
  return arr;
}

// Cheap in-memory throttle for round creation (per client IP).
const createLog = new Map();
function throttleCreate(req) {
  const ip = req.ip || "x";
  const now = Date.now();
  const recent = (createLog.get(ip) || []).filter(t => now - t < 3600_000);
  if (recent.length >= 40) throw httpError(429, "Too many rounds created from here. Try again later.");
  recent.push(now);
  createLog.set(ip, recent);
}

const parseJson = (s, dflt) => { try { return JSON.parse(s); } catch { return dflt; } };

async function getRoundRow(code) {
  const [rows] = await pool.query("SELECT * FROM rounds WHERE code = ?", [String(code || "").toUpperCase()]);
  if (!rows.length) throw httpError(404, "Round not found. Check the code and try again.");
  return rows[0];
}

async function bump(conn, roundId) {
  await conn.query("UPDATE rounds SET rev = rev + 1 WHERE id = ?", [roundId]);
}

export async function buildPayload(row) {
  const [players] = await pool.query("SELECT id, name, handicap, team FROM players WHERE round_id = ? ORDER BY id", [row.id]);
  const [scoreRows] = await pool.query(
    "SELECT player_id, hole_no, strokes, entered_by, updated_by, edits, updated_at FROM scores WHERE round_id = ?", [row.id]);
  const scores = {}, scoreInfo = {};
  for (const s of scoreRows) {
    (scores[s.player_id] ||= {})[s.hole_no] = s.strokes;
    (scoreInfo[s.player_id] ||= {})[s.hole_no] = {
      by: s.updated_by || s.entered_by, edits: s.edits, at: s.updated_at instanceof Date ? s.updated_at.toISOString() : s.updated_at,
    };
  }
  const pars = parseJson(row.pars, []);
  const game = normalizeGame(parseJson(row.game_json, {}));
  const bets = normalizeBets(parseJson(row.bets_json, {}));
  const meal = normalizeMeal(parseJson(row.meal_json, {}));
  const standings = computeStandings({ game, holes: row.holes, pars, players, scores });
  const settlement = computeSettlement({ bets, meal, standings, players });
  return {
    code: row.code,
    name: row.name,
    courseId: row.course_id,
    courseName: row.course_name,
    holes: row.holes,
    pars,
    status: row.status,
    rev: row.rev,
    createdBy: row.created_by,
    game, bets, meal,
    rules: rulesFor(game),
    players,
    scores,
    scoreInfo,
    standings: { participants: standings.participants, better: standings.better, match: standings.match, complete: standings.complete, scope: standings.scope },
    settlement,
    setupErrors: validateSetup(game, players),
  };
}

async function insertPlayer(conn, roundId, { name, handicap, team }) {
  const [r] = await conn.query("INSERT INTO players (round_id, name, handicap, team) VALUES (?, ?, ?, ?)",
    [roundId, name, clampInt(handicap, 0, 54, 0), team ? cleanName(team, 8).toUpperCase() || null : null]);
  return r.insertId;
}

export function mountRounds(app) {
  app.get("/api/games", (_req, res) => {
    res.json({ games: GAME_PRESETS, mealMethods: MEAL_METHODS });
  });

  app.post("/api/rounds", async (req, res) => {
    throttleCreate(req);
    const b = req.body || {};
    const holes = Number(b.holes) === 9 ? 9 : 18;
    const courseName = cleanName(b.courseName, 160) || "Custom course";
    const game = normalizeGame(b.game);
    const bets = normalizeBets(b.bets);
    const meal = normalizeMeal(b.meal);
    const hostName = cleanName(b.hostName, 40);
    if (!hostName) throw httpError(400, "Enter your name first.");
    const incoming = Array.isArray(b.players) ? b.players : [];
    const people = [{ name: hostName, handicap: b.hostHandicap, team: b.hostTeam }, ...incoming]
      .map(p => ({ name: cleanName(p.name), handicap: p.handicap, team: p.team }))
      .filter(p => p.name);
    if (people.length > MAX_PLAYERS) throw httpError(400, `Up to ${MAX_PLAYERS} players per round.`);
    const seen = new Set();
    for (const p of people) {
      const k = p.name.toLowerCase();
      if (seen.has(k)) throw httpError(400, `Two players are called "${p.name}". Give them different names.`);
      seen.add(k);
    }
    let courseId = null;
    if (b.courseId) {
      const [c] = await pool.query("SELECT id FROM courses WHERE id = ?", [Number(b.courseId)]);
      if (c.length) courseId = c[0].id;
    }
    const pars = parsePars(b.pars, holes);

    let code, roundId, hostId;
    for (let attempt = 0; attempt < 8; attempt++) {
      code = genCode();
      try {
        await tx(async conn => {
          const [r] = await conn.query(
            "INSERT INTO rounds (code, name, course_id, course_name, holes, pars, game_json, bets_json, meal_json, status, created_by) VALUES (?,?,?,?,?,?,?,?,?, 'setup', ?)",
            [code, cleanName(b.name, 100) || null, courseId, courseName, holes, JSON.stringify(pars), JSON.stringify(game), JSON.stringify(bets), JSON.stringify(meal), hostName]);
          roundId = r.insertId;
          for (let i = 0; i < people.length; i++) {
            const pid = await insertPlayer(conn, roundId, people[i]);
            if (i === 0) hostId = pid;
          }
        });
        break;
      } catch (e) {
        if (e.code === "ER_DUP_ENTRY" && attempt < 7) continue;
        throw e;
      }
    }
    res.status(201).json({ code, hostPlayerId: hostId });
  });

  app.get("/api/rounds/:code", async (req, res) => {
    const row = await getRoundRow(req.params.code);
    const since = Number(req.query.since);
    if (Number.isFinite(since) && since === row.rev) return res.json({ unchanged: true, rev: row.rev });
    res.json(await buildPayload(row));
  });

  // Join (or rejoin): same name in the same round = the same person.
  app.post("/api/rounds/:code/join", async (req, res) => {
    const row = await getRoundRow(req.params.code);
    const body = req.body || {};
    if (body.playerId) {
      const [p] = await pool.query("SELECT id, name, handicap, team FROM players WHERE id = ? AND round_id = ?", [Number(body.playerId), row.id]);
      if (!p.length) throw httpError(404, "That player is not in this round.");
      return res.json({ player: p[0] });
    }
    const name = cleanName(body.name);
    if (!name) throw httpError(400, "Type your name to join.");
    const [existing] = await pool.query("SELECT id, name, handicap, team FROM players WHERE round_id = ? AND LOWER(name) = LOWER(?)", [row.id, name]);
    if (existing.length) return res.json({ player: existing[0] });
    const [[{ n }]] = await pool.query("SELECT COUNT(*) AS n FROM players WHERE round_id = ?", [row.id]);
    if (n >= MAX_PLAYERS) throw httpError(400, "This round is full.");
    let player;
    await tx(async conn => {
      const id = await insertPlayer(conn, row.id, { name, handicap: row.status === "setup" ? body.handicap : 0, team: null });
      await bump(conn, row.id);
      const [p] = await conn.query("SELECT id, name, handicap, team FROM players WHERE id = ?", [id]);
      player = p[0];
    });
    res.status(201).json({ player });
  });

  app.patch("/api/rounds/:code", async (req, res) => {
    const row = await getRoundRow(req.params.code);
    const b = req.body || {};
    const sets = [], vals = [];
    const setup = row.status === "setup";
    if (typeof b.name === "string") { sets.push("name = ?"); vals.push(cleanName(b.name, 100) || null); }
    if (b.game) {
      if (!setup && normalizeGame(b.game).type !== normalizeGame(parseJson(row.game_json, {})).type) throw httpError(400, "The game type can't be changed after the round starts.");
      sets.push("game_json = ?"); vals.push(JSON.stringify(normalizeGame(b.game)));
    }
    if (b.bets) { sets.push("bets_json = ?"); vals.push(JSON.stringify(normalizeBets(b.bets))); }
    if (b.meal) { sets.push("meal_json = ?"); vals.push(JSON.stringify(normalizeMeal(b.meal))); }
    if (b.pars) {
      sets.push("pars = ?"); vals.push(JSON.stringify(parsePars(b.pars, row.holes)));
    }
    if (b.status && b.status !== row.status) {
      if (!["setup", "active", "finished"].includes(b.status)) throw httpError(400, "Unknown status");
      if (b.status === "active" && row.status === "setup") {
        const [players] = await pool.query("SELECT id, name, handicap, team FROM players WHERE round_id = ?", [row.id]);
        const game = typeof b.game === "object" && b.game ? normalizeGame(b.game) : normalizeGame(parseJson(row.game_json, {}));
        const errs = validateSetup(game, players);
        if (errs.length) throw httpError(400, errs[0]);
      }
      sets.push("status = ?"); vals.push(b.status);
    }
    if (!sets.length) return res.json(await buildPayload(row));
    await tx(async conn => {
      await conn.query(`UPDATE rounds SET ${sets.join(", ")} WHERE id = ?`, [...vals, row.id]);
      await bump(conn, row.id);
    });
    res.json(await buildPayload(await getRoundRow(row.code)));
  });

  app.put("/api/rounds/:code/players/:pid", async (req, res) => {
    const row = await getRoundRow(req.params.code);
    const pid = Number(req.params.pid);
    const [p] = await pool.query("SELECT * FROM players WHERE id = ? AND round_id = ?", [pid, row.id]);
    if (!p.length) throw httpError(404, "Player not found");
    const b = req.body || {};
    const sets = [], vals = [];
    if (typeof b.name === "string") {
      const name = cleanName(b.name);
      if (!name) throw httpError(400, "Name can't be empty");
      const [dupe] = await pool.query("SELECT id FROM players WHERE round_id = ? AND LOWER(name) = LOWER(?) AND id <> ?", [row.id, name, pid]);
      if (dupe.length) throw httpError(400, `"${name}" is already in this round.`);
      sets.push("name = ?"); vals.push(name);
    }
    if (b.handicap !== undefined) {
      if (row.status !== "setup") throw httpError(400, "Handicaps are locked once the round has started.");
      sets.push("handicap = ?"); vals.push(clampInt(b.handicap, 0, 54, 0));
    }
    if (b.team !== undefined) {
      if (row.status !== "setup") throw httpError(400, "Teams are locked once the round has started.");
      sets.push("team = ?"); vals.push(b.team ? cleanName(b.team, 8).toUpperCase() || null : null);
    }
    if (sets.length) await tx(async conn => {
      await conn.query(`UPDATE players SET ${sets.join(", ")} WHERE id = ?`, [...vals, pid]);
      await bump(conn, row.id);
    });
    res.json(await buildPayload(await getRoundRow(row.code)));
  });

  app.delete("/api/rounds/:code/players/:pid", async (req, res) => {
    const row = await getRoundRow(req.params.code);
    if (row.status !== "setup") throw httpError(400, "Players can only be removed before the round starts.");
    await tx(async conn => {
      await conn.query("DELETE FROM players WHERE id = ? AND round_id = ?", [Number(req.params.pid), row.id]);
      await bump(conn, row.id);
    });
    res.json(await buildPayload(await getRoundRow(row.code)));
  });

  // Set (or clear, with strokes = null) one score. Scramble fans the team's
  // score out to every team member so there's a single team score per hole.
  app.put("/api/rounds/:code/scores", async (req, res) => {
    const row = await getRoundRow(req.params.code);
    const b = req.body || {};
    const by = actor(req);
    const hole = clampInt(b.hole, 1, row.holes, 0);
    if (!hole) throw httpError(400, "Bad hole number");
    const [target] = await pool.query("SELECT id, team FROM players WHERE id = ? AND round_id = ?", [Number(b.playerId), row.id]);
    if (!target.length) throw httpError(404, "Player not found");
    if (row.status === "setup") throw httpError(400, "Start the round before entering scores.");
    const strokes = b.strokes === null || b.strokes === "" || b.strokes === undefined ? null : clampInt(b.strokes, 1, 20, null);
    if (strokes === null && b.strokes !== null && b.strokes !== "" && b.strokes !== undefined) throw httpError(400, "Bad score");

    let ids = [target[0].id];
    const game = normalizeGame(parseJson(row.game_json, {}));
    if (game.teamCount === "single" && game.unit === "team" && target[0].team) {
      const [mates] = await pool.query("SELECT id FROM players WHERE round_id = ? AND team = ?", [row.id, target[0].team]);
      ids = mates.map(m => m.id);
    }
    await tx(async conn => {
      for (const id of ids) {
        const [old] = await conn.query("SELECT strokes, entered_by FROM scores WHERE round_id = ? AND player_id = ? AND hole_no = ?", [row.id, id, hole]);
        const before = old.length ? old[0].strokes : null;
        if (before === strokes) continue;
        if (strokes === null) {
          await conn.query("DELETE FROM scores WHERE round_id = ? AND player_id = ? AND hole_no = ?", [row.id, id, hole]);
        } else if (old.length) {
          await conn.query("UPDATE scores SET strokes = ?, updated_by = ?, edits = edits + 1, updated_at = CURRENT_TIMESTAMP WHERE round_id = ? AND player_id = ? AND hole_no = ?",
            [strokes, by, row.id, id, hole]);
        } else {
          await conn.query("INSERT INTO scores (round_id, player_id, hole_no, strokes, entered_by, updated_by) VALUES (?,?,?,?,?,?)",
            [row.id, id, hole, strokes, by, by]);
        }
        await conn.query("INSERT INTO score_edits (round_id, player_id, hole_no, old_strokes, new_strokes, edited_by) VALUES (?,?,?,?,?,?)",
          [row.id, id, hole, before, strokes, by]);
      }
      await bump(conn, row.id);
    });
    res.json(await buildPayload(await getRoundRow(row.code)));
  });

  app.get("/api/rounds/:code/edits", async (req, res) => {
    const row = await getRoundRow(req.params.code);
    const [rows] = await pool.query(
      `SELECT e.id, e.hole_no, e.old_strokes, e.new_strokes, e.edited_by, e.edited_at, p.name AS player
         FROM score_edits e JOIN players p ON p.id = e.player_id
        WHERE e.round_id = ? ORDER BY e.id DESC LIMIT 200`, [row.id]);
    res.json({ edits: rows.map(r => ({ ...r, edited_at: r.edited_at instanceof Date ? r.edited_at.toISOString() : r.edited_at })) });
  });
}
