import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { getRecent } from "../identity.js";

const when = iso => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short", year: "numeric" });
};

export default function History() {
  const [rounds, setRounds] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    const codes = getRecent().map(r => r.code);
    if (!codes.length) { setRounds([]); return; }
    api("/rounds/summaries", { method: "POST", body: { codes } }).then(d => setRounds(d.rounds)).catch(e => setErr(e.message));
  }, []);

  return (
    <div className="stack">
      <h1>Round history</h1>
      <p className="muted small">Every round you've opened on this phone. Tap one to see scores or settle up, even hours later.</p>
      {err && <div className="error">{err}</div>}
      {!rounds && !err && <p className="muted">Loading…</p>}
      {rounds && rounds.length === 0 && (
        <div className="card center stack"><div style={{ fontSize: "2rem" }}>⛳</div><b>No rounds yet</b><Link className="btn" to="/new">Start your first round</Link></div>
      )}
      {rounds?.map(r => (
        <Link key={r.code} to={`/r/${r.code}`} className="card histcard">
          <div className="row">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="name" style={{ fontFamily: "var(--serif)", fontWeight: 700, fontSize: "1.1rem" }}>{r.courseName}</div>
              <div className="small muted">{when(r.createdAt)}{r.name ? ` · ${r.name}` : ""}</div>
            </div>
            <span className={`pill ${r.status === "active" ? "" : r.status === "setup" ? "gold" : "grey"}`}>{r.status === "active" ? "Live" : r.status === "setup" ? "Lobby" : "Finished"}</span>
          </div>
          <div className="small" style={{ marginTop: 6 }}>{r.gameName} · {r.holes} holes · {r.players.join(", ")}</div>
          {r.leader && <div style={{ marginTop: 6 }}>{r.leader.complete ? "🏆" : "▶"} <b>{r.leader.name}</b> <span className="muted">{r.leader.label}</span></div>}
          {r.moneyOn && <div className="small" style={{ marginTop: 4 }}>💰 {r.owed ? `${r.owed} payment${r.owed > 1 ? "s" : ""} to settle` : "Bets & meal set up"}</div>}
        </Link>
      ))}
    </div>
  );
}
