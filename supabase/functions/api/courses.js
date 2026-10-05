// Course list (par per hole). Seeded by a migration and editable in the app so the list improves over time.
import { pool, tx } from "./db.js";

export const STATES = ["Kuala Lumpur", "Selangor", "Negeri Sembilan", "Pahang", "Penang", "Johor", "Melaka", "Perak", "Kedah", "Perlis", "Kelantan", "Terengganu", "Putrajaya", "Other"];

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

const clean = (v, max) => String(v ?? "").replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);

function cleanHoles(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  if (arr.length !== 9 && arr.length !== 18) throw httpError(400, "A course needs 9 or 18 holes.");
  return arr.map((h, i) => {
    const par = Math.round(Number(h?.par));
    if (!(par >= 3 && par <= 6)) throw httpError(400, `Hole ${i + 1}: par must be 3 to 6.`);
    const y = Math.round(Number(h?.yards));
    return { hole_no: i + 1, par, yards: Number.isFinite(y) && y > 0 && y < 900 ? y : null };
  });
}

export function mountCourses(app) {
  app.get("/api/courses", async (req, res) => {
    const q = clean(req.query.q, 60);
    const state = clean(req.query.state, 60);
    const where = [], vals = [];
    if (q) { where.push("c.name ILIKE ?"); vals.push(`%${q.replace(/[%_]/g, "")}%`); }
    if (state) { where.push("c.state = ?"); vals.push(state); }
    const [rows] = await pool.query(
      `SELECT c.id, c.name, c.state, c.verified, COUNT(h.hole_no)::int AS holes, COALESCE(SUM(h.par), 0)::int AS par
         FROM courses c LEFT JOIN course_holes h ON h.course_id = c.id
         ${where.length ? "WHERE " + where.join(" AND ") : ""}
        GROUP BY c.id, c.name, c.state, c.verified ORDER BY c.name LIMIT 300`, vals);
    res.json({ courses: rows.map(r => ({ ...r, verified: !!r.verified })), states: STATES });
  });

  app.get("/api/courses/:id", async (req, res) => {
    const [rows] = await pool.query("SELECT id, name, state, source, verified FROM courses WHERE id = ?", [Number(req.params.id)]);
    if (!rows.length) throw httpError(404, "Course not found");
    const [holes] = await pool.query("SELECT hole_no, par, yards FROM course_holes WHERE course_id = ? ORDER BY hole_no", [rows[0].id]);
    res.json({ course: { ...rows[0], verified: !!rows[0].verified, holes } });
  });

  app.post("/api/courses", async (req, res) => {
    const name = clean(req.body?.name, 160);
    if (!name) throw httpError(400, "Course name is required.");
    const state = STATES.includes(req.body?.state) ? req.body.state : "Other";
    const holes = cleanHoles(req.body?.holes);
    let id;
    try {
      await tx(async conn => {
        const [r] = await conn.query("INSERT INTO courses (name, state, source, verified) VALUES (?,?,?,false) RETURNING id", [name, state, "added in app"]);
        id = r[0].id;
        for (const h of holes) await conn.query("INSERT INTO course_holes (course_id, hole_no, par, yards) VALUES (?,?,?,?)", [id, h.hole_no, h.par, h.yards]);
      });
    } catch (e) {
      if (e.code === "ER_DUP_ENTRY") throw httpError(400, "A course with that name already exists. Search for it instead.");
      throw e;
    }
    res.status(201).json({ id });
  });

  app.put("/api/courses/:id", async (req, res) => {
    const id = Number(req.params.id);
    const [rows] = await pool.query("SELECT id FROM courses WHERE id = ?", [id]);
    if (!rows.length) throw httpError(404, "Course not found");
    const name = clean(req.body?.name, 160);
    if (!name) throw httpError(400, "Course name is required.");
    const state = STATES.includes(req.body?.state) ? req.body.state : "Other";
    const holes = cleanHoles(req.body?.holes);
    try {
      await tx(async conn => {
        await conn.query("UPDATE courses SET name = ?, state = ?, source = 'edited in app' WHERE id = ?", [name, state, id]);
        await conn.query("DELETE FROM course_holes WHERE course_id = ?", [id]);
        for (const h of holes) await conn.query("INSERT INTO course_holes (course_id, hole_no, par, yards) VALUES (?,?,?,?)", [id, h.hole_no, h.par, h.yards]);
      });
    } catch (e) {
      if (e.code === "ER_DUP_ENTRY") throw httpError(400, "Another course already has that name.");
      throw e;
    }
    res.json({ id });
  });
}
