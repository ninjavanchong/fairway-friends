import { useState } from "react";
import { api } from "../api.js";
import { Seg } from "./ui.jsx";

const STATES = ["Kuala Lumpur", "Selangor", "Negeri Sembilan", "Pahang", "Penang", "Johor", "Melaka", "Perak", "Kedah", "Perlis", "Kelantan", "Terengganu", "Putrajaya", "Other"];
// A typical par-72 layout used as a starting point when adding a course.
const TYPICAL_18 = [4, 4, 3, 5, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 5, 4];

/** Add a new course or fix an existing one (par per hole). */
export default function CourseEditor({ course, onSaved, onCancel }) {
  const [name, setName] = useState(course?.name || "");
  const [state, setState] = useState(course?.state || "Selangor");
  const [holes, setHoles] = useState(course?.holes?.length === 9 ? 9 : 18);
  const [pars, setPars] = useState(course?.holes?.map(h => h.par) || TYPICAL_18);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const shown = pars.slice(0, holes);
  const total = shown.reduce((a, b) => a + b, 0);

  const save = async () => {
    setErr(""); setBusy(true);
    try {
      const body = { name, state, holes: shown.map(par => ({ par })) };
      const r = course?.id ? await api(`/courses/${course.id}`, { method: "PUT", body }) : await api("/courses", { method: "POST", body });
      onSaved(r.id);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="stack">
      {err && <div className="error">{err}</div>}
      <div className="field"><label>Course name</label><input value={name} maxLength={160} onChange={e => setName(e.target.value)} placeholder="e.g. Sunway Golf & Country Club" /></div>
      <div className="field">
        <label>State</label>
        <select value={state} onChange={e => setState(e.target.value)}>{STATES.map(s => <option key={s}>{s}</option>)}</select>
      </div>
      <div className="field"><label>Holes</label><Seg value={holes} onChange={setHoles} options={[[9, "9 holes"], [18, "18 holes"]]} /></div>
      <div className="field">
        <label>Par for each hole (total par {total})</label>
        <div className="pargrid">
          {shown.map((p, i) => (
            <div key={i}>
              {i + 1}
              <select value={p} onChange={e => setPars(pars.map((x, j) => (j === i ? Number(e.target.value) : x)))}>
                {[3, 4, 5, 6].map(n => <option key={n}>{n}</option>)}
              </select>
            </div>
          ))}
        </div>
        <div className="small muted" style={{ marginTop: 6 }}>Check these against the club scorecard. Your fixes help everyone.</div>
      </div>
      <div className="row">
        <button className="btn ghost" onClick={onCancel}>Cancel</button>
        <button className="btn block" disabled={busy || !name.trim()} onClick={save}>{busy ? "Saving…" : course?.id ? "Save changes" : "Add course"}</button>
      </div>
    </div>
  );
}
