import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { addRecent, getName, setMe, setName as saveName } from "../identity.js";
import CourseEditor from "../components/CourseEditor.jsx";
import GamePicker from "../components/GamePicker.jsx";
import MoneyForm from "../components/MoneyForm.jsx";
import { Seg, Sheet } from "../components/ui.jsx";

const STEPS = ["Course", "Game", "Money", "Go"];
const DEFAULT_PARS = [4, 4, 3, 5, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 5, 4];

export default function NewRound() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [hostName, setHostName] = useState(getName());
  const [q, setQ] = useState("");
  const [courses, setCourses] = useState([]);
  const [course, setCourse] = useState(null); // full course w/ holes
  const [holes, setHoles] = useState(18);
  const [nine, setNine] = useState("front");
  const [editor, setEditor] = useState(null); // null | "new" | course
  const [game, setGame] = useState({ type: "stroke", useHandicap: true });
  const [bets, setBets] = useState({ mode: "none", stake: 10, split: [100], step: 0.1 });
  const [meal, setMeal] = useState({ enabled: false, total: 0, method: "equal", pcts: [0, 10, 30, 60], paidBy: null, step: 0.1 });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      api(`/courses?q=${encodeURIComponent(q)}`).then(d => setCourses(d.courses)).catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const choose = async id => {
    const d = await api(`/courses/${id}`);
    setCourse(d.course);
    if (d.course.holes.length === 9) setHoles(9);
  };

  const basePars = course ? course.holes.map(h => h.par) : DEFAULT_PARS;
  const courseHoles = basePars.length;
  const pars = holes === 18 ? basePars.slice(0, 18) : (courseHoles >= 18 && nine === "back" ? basePars.slice(9, 18) : basePars.slice(0, 9));
  const parTotal = pars.reduce((a, b) => a + b, 0);

  const canNext = step === 0 ? hostName.trim().length > 0 : true;

  const create = async () => {
    setErr(""); setBusy(true);
    try {
      saveName(hostName.trim());
      const r = await api("/rounds", {
        method: "POST",
        body: {
          hostName: hostName.trim(),
          courseId: course?.id || null,
          courseName: course?.name || "Casual round",
          holes, pars, game, bets, meal,
        },
      });
      setMe(r.code, { playerId: r.hostPlayerId, name: hostName.trim() });
      addRecent({ code: r.code, course: course?.name || "Casual round", game: game.type === "custom" ? game.name : game.type });
      nav(`/r/${r.code}`, { replace: true });
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="stack">
      <div className="steps">{STEPS.map((_, i) => <i key={i} className={i <= step ? "on" : ""} />)}</div>
      <h1>{["Where are you playing?", "Pick a game", "Any bets or a meal on the line?", "Ready to tee off"][step]}</h1>
      {err && <div className="error">{err}</div>}

      {step === 0 && (
        <>
          <div className="field">
            <label>Your name</label>
            <input value={hostName} maxLength={40} onChange={e => setHostName(e.target.value)} placeholder="So friends know who's hosting" autoFocus />
          </div>
          <div className="card stack">
            <label>Course</label>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search e.g. Saujana, Kinrara, Horizon Hills…" />
            <div className="coursepick" role="listbox">
              {courses.length === 0 && <div className="muted small" style={{ padding: 12 }}>No match. Add it below.</div>}
              {courses.map(c => (
                <button key={c.id} className={course?.id === c.id ? "sel" : ""} onClick={() => choose(c.id)}>
                  <b>{c.name}</b>
                  <div className="small muted">{c.state} · {c.holes} holes · par {c.par}</div>
                </button>
              ))}
            </div>
            <div className="row wrap">
              <button className="btn ghost small" onClick={() => setEditor("new")}>＋ Course not listed? Add it</button>
              {course && <button className="btn ghost small" onClick={() => setEditor(course)}>✎ Fix pars</button>}
            </div>
            {!course && <div className="small muted">Skip this to play a casual round with standard pars. You can still score everything.</div>}
          </div>
          <div className="card stack">
            <div className="row wrap">
              <b style={{ flex: 1 }}>{course ? course.name : "Casual round"}</b>
              <span className="pill">par {parTotal}</span>
            </div>
            <div className="row wrap">
              <span style={{ flex: 1 }}>How many holes?</span>
              <Seg value={holes} onChange={setHoles} options={[[9, "9"], [18, "18"]]} />
            </div>
            {holes === 9 && courseHoles >= 18 && (
              <div className="row wrap">
                <span style={{ flex: 1 }}>Which nine?</span>
                <Seg value={nine} onChange={setNine} options={[["front", "Front 9"], ["back", "Back 9"]]} />
              </div>
            )}
          </div>
        </>
      )}

      {step === 1 && <GamePicker game={game} onChange={setGame} holes={holes} />}

      {step === 2 && (
        <>
          <p className="muted">All optional. You can change this any time, even after the round.</p>
          <MoneyForm bets={bets} meal={meal} onChange={({ bets: b, meal: m }) => { setBets(b); setMeal(m); }} />
        </>
      )}

      {step === 3 && (
        <div className="card paper stack">
          <div><b>{course?.name || "Casual round"}</b> · {holes} holes · par {parTotal}</div>
          <div>Game: <b>{game.type === "custom" ? game.name || "Custom Game" : game.type}</b>{game.useHandicap === false ? " (no handicap)" : ""}</div>
          <div>Bet: <b>{bets.mode === "none" ? "none" : bets.mode === "pot" ? `RM${bets.stake} pot` : `RM${bets.stake} per point`}</b></div>
          <div>Meal split: <b>{meal.enabled ? "on" : "off"}</b></div>
          <p className="muted small">Next you'll get a QR code for your friends to scan, and you can set handicaps and teams before the first tee.</p>
        </div>
      )}

      <div className="row" style={{ marginTop: 8 }}>
        {step > 0 ? <button className="btn ghost" onClick={() => setStep(step - 1)}>← Back</button> : <button className="btn ghost" onClick={() => nav("/")}>Cancel</button>}
        <div className="spacer" />
        {step < 3
          ? <button className="btn" disabled={!canNext} onClick={() => setStep(step + 1)}>{step === 2 ? "Review →" : "Next →"}</button>
          : <button className="btn alt" disabled={busy} onClick={create}>{busy ? "Creating…" : "⛳ Create round"}</button>}
      </div>

      {editor && (
        <Sheet title={editor === "new" ? "Add a course" : "Fix course pars"} onClose={() => setEditor(null)}>
          <CourseEditor
            course={editor === "new" ? null : editor}
            onCancel={() => setEditor(null)}
            onSaved={async id => { setEditor(null); await choose(id); setQ(""); }}
          />
        </Sheet>
      )}
    </div>
  );
}
