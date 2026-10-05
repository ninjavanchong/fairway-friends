import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import { addRecent, getMe, getName, setMe, setName as saveName } from "../identity.js";
import { Stepper } from "../components/ui.jsx";

export default function Join() {
  const { code: raw } = useParams();
  const code = raw.toUpperCase();
  const nav = useNavigate();
  const [round, setRound] = useState(null);
  const [err, setErr] = useState("");
  const [name, setName] = useState(getName());
  const [handicap, setHandicap] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const me = getMe(code);
    if (me?.playerId) { nav(`/r/${code}`, { replace: true }); return; }
    api(`/rounds/${code}`).then(setRound).catch(e => setErr(e.message));
  }, [code, nav]);

  const enter = async body => {
    setBusy(true); setErr("");
    try {
      const { player } = await api(`/rounds/${code}/join`, { method: "POST", body });
      setMe(code, { playerId: player.id, name: player.name });
      saveName(player.name);
      addRecent({ code, course: round?.courseName || "Round" });
      nav(`/r/${code}`, { replace: true });
    } catch (e) { setErr(e.message); setBusy(false); }
  };

  if (err && !round) {
    return <div className="card stack"><h2>Hmm…</h2><div className="error">{err}</div><button className="btn" onClick={() => nav("/")}>Back home</button></div>;
  }
  if (!round) return <p className="muted center">Finding your round…</p>;

  const setup = round.status === "setup";
  return (
    <div className="stack">
      <div className="card paper">
        <div className="small muted">You're invited to</div>
        <h1 style={{ marginBottom: 4 }}>{round.courseName}</h1>
        <div className="row wrap">
          <span className="pill">{round.game.name}</span>
          <span className="pill grey">{round.holes} holes</span>
          <span className="pill grey">{round.players.length} joined</span>
        </div>
      </div>
      {err && <div className="error">{err}</div>}

      {round.players.length > 0 && (
        <div className="card stack">
          <h3>Already on the list? Tap your name</h3>
          <div className="choice">
            {round.players.map(p => (
              <button key={p.id} className="opt" disabled={busy} onClick={() => enter({ playerId: p.id })}>
                <b>{p.name}</b>
              </button>
            ))}
          </div>
        </div>
      )}

      <form className="card stack" onSubmit={e => { e.preventDefault(); if (name.trim()) enter({ name: name.trim(), handicap }); }}>
        <h3>{round.players.length ? "New here? Join with your name" : "Join with your name"}</h3>
        <div className="field">
          <label>Your name</label>
          <input value={name} maxLength={40} onChange={e => setName(e.target.value)} placeholder="e.g. Aisha" autoFocus />
        </div>
        {setup && (
          <div className="row">
            <div style={{ flex: 1 }}>
              <b>Handicap</b>
              <div className="small muted">Strokes you get for the round. Not sure? Leave 0, the host can set it.</div>
            </div>
            <Stepper value={handicap} onChange={setHandicap} label="Handicap" />
          </div>
        )}
        <button className="btn block" type="submit" disabled={busy || !name.trim()}>⛳ Join the round</button>
      </form>
    </div>
  );
}
