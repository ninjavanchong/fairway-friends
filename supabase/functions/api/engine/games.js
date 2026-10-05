// Game engine: pure functions that turn a round's players + scores into standings.
//
// Every game is normalised into one small "spec" so stroke play, Stableford,
// best ball, scramble and the custom builder all share one code path:
//   style     strokes | points | holewins | match
//   unit      player | team
//   teamCount how a team's members combine on a hole: sum | best | single
//   useHandicap, scope (hole numbers counted), points table, tie rule
//
// Handicap is deliberately simple: it is the number of strokes a player gets
// for the round. Net total = gross - handicap. Where a per-hole figure is
// needed (Stableford, match play, best ball) the strokes are handed out from
// hole 1 onward, one per hole (two per hole if the handicap exceeds the holes).

export const STABLEFORD = { albatross: 5, eagle: 4, birdie: 3, par: 2, bogey: 1, double: 0 };

export const GAME_PRESETS = [
  {
    id: "stroke",
    name: "Stroke Play",
    emoji: "⛳",
    tagline: "Lowest total score wins. The classic.",
    teams: "none",
    minPlayers: 2,
    rules: [
      "Count every shot you take on every hole.",
      "Add them up at the end. The lowest total wins.",
      "With handicap on, your handicap is taken off your total (net score). A handicap of 10 means 10 shots off.",
      "If you only play 9 holes, the handicap is spread over those holes.",
    ],
    example: "Aisha shoots 90 with a handicap of 12 → net 78. Ben shoots 85 with a handicap of 4 → net 81. Aisha wins.",
    defaults: { type: "stroke", useHandicap: true },
  },
  {
    id: "stableford",
    name: "Stableford",
    emoji: "🏅",
    tagline: "Points per hole. A bad hole won't wreck your round.",
    teams: "none",
    minPlayers: 2,
    rules: [
      "Each hole earns points based on your score against par: birdie 3, par 2, bogey 1, double bogey or worse 0 (eagle 4).",
      "The most points at the end wins.",
      "Handicap shots are given from hole 1 onward, one per hole, so you get a head start on those holes.",
      "Had a nightmare hole? Pick up and move on, you only lose that hole's points.",
    ],
    example: "Par 4: you take 5 (bogey) = 1 point. With a handicap shot on that hole it counts as a 4 (par) = 2 points.",
    defaults: { type: "stableford", useHandicap: true },
  },
  {
    id: "match",
    name: "Match Play",
    emoji: "🤝",
    tagline: "Head to head, hole by hole. Win more holes, win the match.",
    teams: "optional",
    minPlayers: 2,
    rules: [
      "Two sides only: two players, or two teams (the better score of each team counts on every hole).",
      "Win a hole by taking fewer strokes than the other side. Equal scores = hole halved.",
      "The match score is how many holes you are up, e.g. '2 UP'.",
      "The match ends early when someone leads by more holes than are left. '3&2' = 3 up with 2 to play.",
      "Handicap shots are given from hole 1 onward, one per hole.",
    ],
    example: "After hole 16 you are 3 up with 2 holes left → you win 3&2 and the last two holes are not needed.",
    defaults: { type: "match", useHandicap: true },
  },
  {
    id: "bestball",
    name: "Team Best Ball",
    emoji: "👥",
    tagline: "Everyone plays their own ball; the team keeps its best score.",
    teams: "required",
    minPlayers: 4,
    rules: [
      "Split into teams (usually 2 per team).",
      "Everyone plays their own ball all the way round.",
      "On each hole, only the lowest score on the team counts.",
      "Add up the team's counted scores. The lowest team total wins.",
      "Handicap shots are given from hole 1 onward, one per hole.",
    ],
    example: "Par 4: teammates score 4 and 6. The team counts 4 for that hole.",
    defaults: { type: "bestball", useHandicap: true },
  },
  {
    id: "scramble",
    name: "Scramble",
    emoji: "🔀",
    tagline: "The whole team plays one ball, always from the best shot.",
    teams: "required",
    minPlayers: 4,
    rules: [
      "Everyone on the team tees off. The team picks the best drive.",
      "Everyone then plays their next shot from that spot, and again from the best result, until the ball is holed.",
      "The team writes down ONE score per hole.",
      "Lowest team total wins. Team handicap = the average of its players' handicaps.",
    ],
    example: "Four shots from the best spot to hole out = the team scores 4 on that hole.",
    defaults: { type: "scramble", useHandicap: true },
  },
  {
    id: "custom",
    name: "Custom Game",
    emoji: "🛠️",
    tagline: "Build your own house rules.",
    teams: "optional",
    minPlayers: 2,
    rules: ["Set the scoring style, who counts, handicap, points and ties yourself."],
    example: "E.g. 'Birdie Bonanza': birdie = 3 points, par = 1 point, anything else 0. Most points wins.",
    defaults: {
      type: "custom",
      name: "My Game",
      style: "points",
      unit: "player",
      teamCount: "best",
      useHandicap: true,
      scope: "all",
      points: { ...STABLEFORD },
      holeWinPoints: 1,
      tie: "split",
      notes: "",
    },
  },
];

const POINT_KEYS = ["albatross", "eagle", "birdie", "par", "bogey", "double"];

// teamPlan: { [segmentIndex]: { [playerId]: "A" | "B" | ... | null } } — who is on which team in each stretch.
function cleanPlan(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [seg, map] of Object.entries(raw)) {
    const s = Number(seg);
    if (!Number.isInteger(s) || s < 0 || s > 17 || !map || typeof map !== "object") continue;
    out[s] = {};
    for (const [pid, team] of Object.entries(map)) {
      const id = Number(pid);
      if (!Number.isInteger(id)) continue;
      out[s][id] = team ? String(team).toUpperCase().slice(0, 8) : null;
    }
  }
  return out;
}
const cleanSwap = v => ([3, 6, 9].includes(Number(v)) ? Number(v) : 0);

export function normalizeGame(game = {}) {
  const g = game || {};
  const type = g.type || "stroke";
  const base = {
    type,
    name: type === "custom" ? (g.name || "Custom Game") : (GAME_PRESETS.find(p => p.id === type)?.name || type),
    useHandicap: g.useHandicap !== false,
    scope: ["front", "back"].includes(g.scope) ? g.scope : "all",
    points: { ...STABLEFORD },
    holeWinPoints: 1,
    tie: "split",
    teamCount: "best",
    unit: "player",
    style: "strokes",
    swapEvery: 0,
    teamPlan: {},
    notes: typeof g.notes === "string" ? g.notes.slice(0, 600) : "",
  };
  if (type === "stroke") return { ...base, style: "strokes" };
  if (type === "stableford") return { ...base, style: "points" };
  if (type === "match") return { ...base, style: "match" };
  if (type === "bestball") return { ...base, style: "strokes", unit: "team", teamCount: "best", swapEvery: cleanSwap(g.swapEvery), teamPlan: cleanPlan(g.teamPlan) };
  if (type === "scramble") return { ...base, style: "strokes", unit: "team", teamCount: "single" };
  // custom
  const style = ["strokes", "points", "holewins"].includes(g.style) ? g.style : "points";
  const points = { ...STABLEFORD };
  for (const k of POINT_KEYS) {
    const v = Number(g.points?.[k]);
    if (Number.isFinite(v)) points[k] = Math.max(-50, Math.min(50, v));
  }
  const hw = Number(g.holeWinPoints);
  return {
    ...base,
    style,
    unit: g.unit === "team" ? "team" : "player",
    teamCount: ["sum", "best", "single"].includes(g.teamCount) ? g.teamCount : "best",
    swapEvery: g.unit === "team" && g.teamCount !== "single" ? cleanSwap(g.swapEvery) : 0,
    teamPlan: g.unit === "team" && g.teamCount !== "single" ? cleanPlan(g.teamPlan) : {},
    points,
    holeWinPoints: Number.isFinite(hw) && hw > 0 ? Math.min(hw, 50) : 1,
    tie: g.tie === "none" ? "none" : "split",
  };
}

/** Plain-language rules for the in-round "Rules" sheet. */
export function rulesFor(game) {
  const g = normalizeGame(game);
  if (g.type !== "custom") {
    const p = GAME_PRESETS.find(x => x.id === g.type);
    const lines = [...p.rules];
    if (!g.useHandicap) lines.push("Handicap is switched OFF for this round: gross scores only.");
    if (g.scope === "front") lines.push("Only the front 9 holes count.");
    if (g.scope === "back") lines.push("Only the back 9 holes count.");
    if (g.swapEvery) lines.push(`Partners swap every ${g.swapEvery} holes (see Settings > Players for who is on which team).`);
    return lines;
  }
  const lines = [];
  const who = g.unit === "team"
    ? (g.teamCount === "sum" ? "Teams score together: every member's score counts." : "Teams score together: only the best score on the team counts on each hole.")
    : "Everyone plays for themselves.";
  lines.push(who);
  if (g.style === "strokes") lines.push("Add up your strokes. The lowest total wins.");
  if (g.style === "points") {
    lines.push("Each hole earns points based on your score against par:");
    lines.push(`Albatross ${g.points.albatross} · Eagle ${g.points.eagle} · Birdie ${g.points.birdie} · Par ${g.points.par} · Bogey ${g.points.bogey} · Double bogey or worse ${g.points.double}.`);
    lines.push("Most points wins.");
  }
  if (g.style === "holewins") {
    lines.push(`Win a hole outright (fewest strokes) to earn ${g.holeWinPoints} point${g.holeWinPoints === 1 ? "" : "s"}.`);
    lines.push(g.tie === "split" ? "Tied holes: the points are shared between the players who tied." : "Tied holes: nobody scores.");
    lines.push("Most points wins.");
  }
  lines.push(g.useHandicap ? "Handicap shots are given from hole 1 onward, one per hole." : "No handicap: gross scores.");
  if (g.scope === "front") lines.push("Only the front 9 holes count.");
  if (g.scope === "back") lines.push("Only the back 9 holes count.");
  if (g.swapEvery) lines.push(`Partners swap every ${g.swapEvery} holes.`);
  if (g.notes) lines.push(g.notes);
  return lines;
}

export function holesInScope(game, holes) {
  const g = normalizeGame(game);
  const all = Array.from({ length: holes }, (_, i) => i + 1);
  if (holes <= 9) return all;
  if (g.scope === "front") return all.filter(h => h <= 9);
  if (g.scope === "back") return all.filter(h => h > 9);
  return all;
}

/** Strokes a player receives on hole `holeNo` (1-based) with a round handicap. */
export function strokesOnHole(handicap, holeNo, holes) {
  const h = Math.max(0, Math.round(Number(handicap) || 0));
  const base = Math.floor(h / holes);
  const extra = holeNo <= h % holes ? 1 : 0;
  return base + extra;
}

export function pointsForDiff(diff, table = STABLEFORD) {
  if (diff <= -3) return table.albatross;
  if (diff === -2) return table.eagle;
  if (diff === -1) return table.birdie;
  if (diff === 0) return table.par;
  if (diff === 1) return table.bogey;
  return table.double;
}

/** Problems that stop a round from starting. Empty array = fine. */
export function validateSetup(game, players) {
  const g = normalizeGame(game);
  const errs = [];
  if (players.length < 1) errs.push("Add at least 1 player.");
  if (g.type === "match") {
    const teamed = players.filter(p => p.team);
    if (teamed.length) {
      const teams = new Set(teamed.map(p => p.team));
      if (teams.size !== 2 || teamed.length !== players.length) errs.push("Match play needs exactly 2 teams, with every player on one.");
    } else if (players.length !== 2) {
      errs.push("Match play is head to head: use exactly 2 players, or split into 2 teams.");
    }
  }
  if (g.unit === "team") {
    const noTeam = players.filter(p => !p.team);
    if (noTeam.length) errs.push(`Put everyone on a team (${noTeam.map(p => p.name).join(", ")} has none).`);
    if (new Set(players.map(p => p.team).filter(Boolean)).size < 2) errs.push("Need at least 2 teams.");
  }
  return errs;
}

function avg(nums) {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

/** Game that counts holes won outright (used for "settle by holes won" and the holes-won column). */
export function holesWonGame(game, players) {
  const s = normalizeGame(game);
  const teamed = s.unit === "team" || (s.style === "match" && players.some(p => p.team));
  return {
    type: "custom", style: "holewins", unit: teamed ? "team" : "player",
    teamCount: s.unit === "team" ? s.teamCount : "best",
    useHandicap: s.useHandicap, scope: s.scope, holeWinPoints: 1, tie: "none",
    swapEvery: s.swapEvery, teamPlan: s.teamPlan,
  };
}

/**
 * players: [{id, name, handicap, team}]
 * scores:  { [playerId]: { [holeNo]: strokes } }
 * returns: { spec, better, participants, settleParticipants?, match, complete, scope }
 * Each participant: { key, name, memberIds, total, toPar, thru, gross, pos, rankValue, label,
 *                     holesPlayed, grossTotal, netTotal, parThru, toParNet, toParGross }
 * settleParticipants: per-player results used for money when partners rotate.
 */
export function computeStandings({ game, holes, pars, players, scores }) {
  const spec = normalizeGame(game);
  const scope = holesInScope(spec, holes);
  const useH = spec.useHandicap;
  const scrambleLike = spec.teamCount === "single" && spec.unit === "team";
  const rotating = spec.unit === "team" && spec.swapEvery > 0 && spec.style !== "match" && !scrambleLike;

  // Which team is a player on at a given hole? (Rotation: look back to the latest plan.)
  const teamAt = (p, holeNo) => {
    if (!rotating) return p.team || null;
    for (let s = Math.floor((holeNo - (scope[0] || 1)) / spec.swapEvery); s >= 0; s--) {
      const plan = spec.teamPlan?.[s];
      if (plan && Object.prototype.hasOwnProperty.call(plan, p.id)) return plan[p.id] || null;
    }
    return p.team || null;
  };

  const teamKeys = () => {
    const set = new Set(players.map(p => p.team).filter(Boolean));
    if (rotating) for (const plan of Object.values(spec.teamPlan || {})) for (const t of Object.values(plan)) if (t) set.add(t);
    return [...set].sort();
  };
  const teamPart = k => ({ key: `t:${k}`, name: `Team ${k}`, team: k, members: players.filter(p => p.team === k) });

  // Build participants.
  let participants;
  if (spec.style === "match") {
    participants = players.some(p => p.team)
      ? [...new Set(players.map(p => p.team).filter(Boolean))].sort().map(teamPart)
      : players.map(p => ({ key: `p:${p.id}`, name: p.name, members: [p] }));
  } else if (spec.unit === "team") {
    participants = teamKeys().map(teamPart);
  } else {
    participants = players.map(p => ({ key: `p:${p.id}`, name: p.name, members: [p] }));
  }

  const membersOf = (part, holeNo) => (part.team && rotating ? players.filter(p => teamAt(p, holeNo) === part.team) : part.members);
  const sumMode = part => !!part.team && !scrambleLike && spec.style !== "match" && spec.teamCount === "sum";

  // Per hole, per participant: the figures that count (or null if not yet played).
  function holeValue(part, holeNo) {
    const members = membersOf(part, holeNo);
    const memberVals = [];
    for (const m of members) {
      const s = scores?.[m.id]?.[holeNo];
      if (s == null) continue;
      const alloc = useH ? strokesOnHole(m.handicap, holeNo, holes) : 0;
      memberVals.push({ gross: s, net: s - alloc });
    }
    if (!memberVals.length) return null;
    const ids = members.map(m => m.id);
    if (scrambleLike) {
      const gross = Math.min(...memberVals.map(v => v.gross));
      const teamHcp = Math.round(avg(members.map(m => m.handicap)));
      const alloc = useH ? strokesOnHole(teamHcp, holeNo, holes) : 0;
      return { net: gross - alloc, gross, memberNets: [gross - alloc], ids, n: 1 };
    }
    if (part.team) {
      const sm = sumMode(part);
      if (sm && memberVals.length < members.length) return null;
      const nets = memberVals.map(v => v.net);
      return {
        net: sm ? nets.reduce((a, b) => a + b, 0) : Math.min(...nets),
        gross: sm ? memberVals.reduce((a, v) => a + v.gross, 0) : Math.min(...memberVals.map(v => v.gross)),
        memberNets: nets, ids, n: sm ? members.length : 1,
      };
    }
    const v = memberVals[0];
    return { net: v.net, gross: v.gross, memberNets: [v.net], ids, n: 1 };
  }

  const per = new Map();
  for (const part of participants) per.set(part.key, scope.map(h => ({ hole: h, v: holeValue(part, h) })));

  // Credits per hole (for per-player money results when partners rotate).
  const credits = []; // { hole, ids, amt }

  let better = "low";
  let match = null;

  if (spec.style === "match") {
    better = "high";
    const [A, B] = participants;
    if (!A || !B) {
      // Not enough sides yet (e.g. only the host is in the lobby).
      match = { up: 0, played: 0, remaining: scope.length, finished: false, leader: null, label: "Waiting for two sides", margin: 0 };
      participants.forEach(p => { p.total = 0; p.thru = 0; p.rankValue = 0; p.gross = null; p.toPar = null; });
    } else {
      let up = 0, played = 0, decided = null;
      for (let i = 0; i < scope.length; i++) {
        const a = per.get(A.key)[i].v, b = per.get(B.key)[i].v;
        if (!a || !b) break; // matches are played in order
        played++;
        if (a.net < b.net) up++;
        else if (b.net < a.net) up--;
        const remaining = scope.length - played;
        if (Math.abs(up) > remaining) { decided = { holes: played, remaining }; break; }
      }
      const remaining = scope.length - played;
      const finished = decided != null || played === scope.length;
      const leader = up > 0 ? A.key : up < 0 ? B.key : null;
      const lname = up > 0 ? A.name : B.name;
      let label;
      if (decided) label = `${lname} wins ${Math.abs(up)}&${decided.remaining}`;
      else if (finished) label = up === 0 ? "Match halved (all square)" : `${lname} wins ${Math.abs(up)} UP`;
      else if (played === 0) label = "Not started";
      else label = up === 0 ? `All square thru ${played}` : `${lname} ${Math.abs(up)} UP thru ${played}`;
      match = { up, played, remaining, finished, leader, label, margin: Math.abs(up) };
      for (const part of participants) {
        part.total = part.key === A.key ? up : -up;
        part.thru = played;
      }
      participants.forEach(p => { p.rankValue = p.total; p.gross = null; p.toPar = null; });
    }
  } else if (spec.style === "strokes") {
    for (const part of participants) {
      let total = 0, gross = 0, thru = 0, parSum = 0;
      for (const { hole, v } of per.get(part.key)) {
        if (!v) continue;
        total += v.net; gross += v.gross; thru++;
        const par = pars[hole - 1] || 0;
        const base = par * (v.n || 1); // sum-teams: the par baseline scales with member count
        parSum += base;
        credits.push({ hole, ids: v.ids, amt: -(v.net - base) });
      }
      part.total = total; part.gross = gross; part.thru = thru; part.toPar = total - parSum;
      part.rankValue = thru ? -(total - parSum) : -Infinity;
    }
  } else if (spec.style === "points") {
    better = "high";
    for (const part of participants) {
      let total = 0, thru = 0, gross = 0;
      for (const { hole, v } of per.get(part.key)) {
        if (!v) continue;
        thru++; gross += v.gross;
        const par = pars[hole - 1] || 0;
        const pts = v.memberNets.map(n => pointsForDiff(n - par, spec.points));
        // 'sum' teams add everyone's points; 'best' (and singles/players) take the max.
        const hp = sumMode(part) ? pts.reduce((a, b) => a + b, 0) : Math.max(...pts);
        total += hp;
        credits.push({ hole, ids: v.ids, amt: hp });
      }
      part.total = total; part.thru = thru; part.gross = gross; part.toPar = null;
      part.rankValue = total;
    }
  } else if (spec.style === "holewins") {
    better = "high";
    for (const part of participants) { part.total = 0; part.thru = 0; part.gross = 0; part.toPar = null; }
    for (let i = 0; i < scope.length; i++) {
      const vals = participants.map(p => ({ p, v: per.get(p.key)[i].v }));
      if (vals.some(x => !x.v)) continue; // hole not finished by everyone yet
      participants.forEach(p => { p.thru++; });
      const best = Math.min(...vals.map(x => x.v.net));
      const winners = vals.filter(x => x.v.net === best);
      if (winners.length === 1) {
        winners[0].p.total += spec.holeWinPoints;
        credits.push({ hole: scope[i], ids: winners[0].v.ids, amt: spec.holeWinPoints });
      } else if (spec.tie === "split") {
        winners.forEach(w => {
          const amt = spec.holeWinPoints / winners.length;
          w.p.total += amt;
          credits.push({ hole: scope[i], ids: w.v.ids, amt });
        });
      }
    }
    participants.forEach(p => { p.total = Math.round(p.total * 100) / 100; p.rankValue = p.total; });
  }

  // Display stats for every style: strokes against par, gross and net.
  for (const part of participants) {
    let gross = 0, net = 0, parThru = 0, played = 0;
    for (const { hole, v } of per.get(part.key)) {
      if (!v) continue;
      played++; gross += v.gross; net += v.net;
      parThru += (pars[hole - 1] || 0) * (v.n || 1);
    }
    part.holesPlayed = played; part.grossTotal = gross; part.netTotal = net; part.parThru = parThru;
    part.toParNet = net - parThru; part.toParGross = gross - parThru;
  }

  // Positions (ties share a position).
  const rank = list => { for (const p of list) p.pos = 1 + list.filter(o => o.rankValue > p.rankValue).length; };
  rank(participants);

  // Partners rotate: money is settled per player, from the credits above.
  let settleParticipants = null;
  if (rotating && spec.style !== "match") {
    settleParticipants = players.map(p => {
      const total = credits.filter(c => c.ids.includes(p.id)).reduce((a, c) => a + c.amt, 0);
      return { key: `p:${p.id}`, name: p.name, memberIds: [p.id], rankValue: Math.round(total * 100) / 100 };
    });
    rank(settleParticipants);
  }

  for (const p of participants) {
    // Everyone who was on this team at any scored hole.
    p.memberIds = p.team && rotating
      ? players.filter(pl => scope.some(h => teamAt(pl, h) === p.team)).map(pl => pl.id)
      : p.members.map(m => m.id);
    delete p.members;
  }
  participants.sort((a, b) => a.pos - b.pos || a.name.localeCompare(b.name));

  const complete = spec.style === "match"
    ? match.finished
    : participants.length > 0 && participants.every(p => p.thru >= scope.length);

  // Labels.
  for (const p of participants) {
    if (spec.style === "strokes") {
      p.label = p.thru ? `${p.total} net · ${fmtToPar(p.toPar)}` : "—";
      if (!spec.useHandicap) p.label = p.thru ? `${p.total} · ${fmtToPar(p.toPar)}` : "—";
    } else if (spec.style === "match") {
      p.label = p.total > 0 ? `${p.total} UP` : p.total < 0 ? "behind" : (match.played ? "AS" : "—");
    } else {
      p.label = `${p.total} pts`;
    }
  }

  return { spec, better, participants, settleParticipants, match, complete, scope, rotating };
}

export function fmtToPar(n) {
  if (n === 0) return "E";
  return n > 0 ? `+${n}` : `${n}`;
}
