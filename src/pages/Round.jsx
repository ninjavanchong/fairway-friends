import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { api, useRound } from "../api.js";
import { addRecent, getMe, setMe } from "../identity.js";
import { timeAgo } from "../util.js";
import { Confetti, Logo, Sheet, ShareSheet, useToast } from "../components/ui.jsx";
import Lobby from "./Lobby.jsx";
import ScoreTab from "./ScoreTab.jsx";
import BoardTab from "./BoardTab.jsx";
import SettleTab from "./SettleTab.jsx";

function RulesSheet({ round, onClose }) {
  return (
    <Sheet title={`How ${round.game.name} works`} onClose={onClose}>
      <div className="explain">
        <ul>{round.rules.map((l, i) => <li key={i}>{l}</li>)}</ul>
      </div>
      <p className="small muted" style={{ marginTop: 10 }}>
        Handicap = strokes you get for the round. Net score = your strokes minus your handicap.
      </p>
    </Sheet>
  );
}

function HistorySheet({ code, onClose }) {
  const [edits, setEdits] = useState(null);
  useEffect(() => { api(`/rounds/${code}/edits`).then(d => setEdits(d.edits)).catch(() => setEdits([])); }, [code]);
  return (
    <Sheet title="Score history" onClose={onClose}>
      {!edits && <p className="muted">Loading…</p>}
      {edits && edits.length === 0 && <p className="muted">No scores entered yet.</p>}
      <div className="list">
        {edits?.map(e => (
          <div key={e.id} className="li" style={{ alignItems: "flex-start" }}>
            <div className="grow small">
              <b>{e.edited_by || "Someone"}</b>{" "}
              {e.old_strokes == null ? <>entered <b>{e.new_strokes}</b> for</> : e.new_strokes == null ? <>cleared the score for</> : <>changed <b>{e.old_strokes} → {e.new_strokes}</b> for</>}{" "}
              <b>{e.player}</b> on hole {e.hole_no}
            </div>
            <span className="small muted">{timeAgo(e.edited_at)}</span>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

export default function Round() {
  const { code: raw } = useParams();
  const code = raw.toUpperCase();
  const me = getMe(code);
  const { round, error, mutate } = useRound(code);
  const [tab, setTab] = useState("score");
  const [sheet, setSheet] = useState(null);
  const [toast, setToast] = useToast();
  const [burst, setBurst] = useState(0);

  useEffect(() => { if (round && me) addRecent({ code, course: round.courseName }); }, [round?.code]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!me?.playerId) return <Navigate to={`/j/${code}`} replace />;
  if (error) return <div className="card stack"><h2>Round not found</h2><div className="error">{error}</div><Link className="btn" to="/">Back home</Link></div>;
  if (!round) return <p className="muted center">Loading your round…</p>;

  const iAm = round.players.find(p => p.id === me.playerId);
  if (!iAm) {
    // The player row is gone (removed by the host): rejoin by name.
    setMe(code, null);
    return <Navigate to={`/j/${code}`} replace />;
  }

  const actions = {
    me,
    toast: setToast,
    celebrate: () => setBurst(b => b + 1),
    run: async (fn, okMsg) => {
      try { const r = await fn(); if (okMsg) setToast(okMsg); return r; }
      catch (e) { setToast(e.message); return null; }
    },
    setScore: (playerId, hole, strokes) => mutate(() => api(`/rounds/${code}/scores`, { method: "PUT", body: { playerId, hole, strokes, by: me.name } })),
    patch: body => mutate(() => api(`/rounds/${code}`, { method: "PATCH", body })),
    updatePlayer: (pid, body) => mutate(() => api(`/rounds/${code}/players/${pid}`, { method: "PUT", body })),
    removePlayer: pid => mutate(() => api(`/rounds/${code}/players/${pid}`, { method: "DELETE" })),
    addPlayer: async (name, handicap = 0) => mutate(async () => {
      await api(`/rounds/${code}/join`, { method: "POST", body: { name, handicap } });
      return api(`/rounds/${code}`);
    }),
  };

  const setup = round.status === "setup";
  const statusPill = setup ? <span className="pill gold">Lobby</span> : round.status === "active" ? <span className="pill">Live</span> : <span className="pill grey">Finished</span>;

  return (
    <div>
      <div className="topbar">
        <Link to="/" className="brand" aria-label="Home"><Logo /></Link>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "var(--serif)", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{round.courseName}</div>
          <div className="row small muted" style={{ gap: 6 }}>{statusPill} <span>{round.game.name} · {round.holes}H</span></div>
        </div>
        <div className="spacer" />
        <button className="iconbtn" onClick={() => setSheet("share")} aria-label="Invite players">📲</button>
        <button className="iconbtn" onClick={() => setSheet("rules")} aria-label="Game rules">📖</button>
        {!setup && <button className="iconbtn" onClick={() => setSheet("history")} aria-label="Score history">🕘</button>}
      </div>

      {setup ? (
        <Lobby round={round} a={actions} openShare={() => setSheet("share")} />
      ) : (
        <>
          {tab === "score" && <ScoreTab round={round} a={actions} goBoard={() => setTab("board")} />}
          {tab === "board" && <BoardTab round={round} a={actions} />}
          {tab === "money" && <SettleTab round={round} a={actions} />}
          <nav className="tabbar" aria-label="Round sections">
            <div className="inner">
              {[["score", "✏️", "Score"], ["board", "🏆", "Leaderboard"], ["money", "💰", "Settle up"]].map(([k, ic, label]) => (
                <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}><span>{ic}</span>{label}</button>
              ))}
            </div>
          </nav>
        </>
      )}

      {sheet === "share" && <ShareSheet round={round} onClose={() => setSheet(null)} toast={setToast} />}
      {sheet === "rules" && <RulesSheet round={round} onClose={() => setSheet(null)} />}
      {sheet === "history" && <HistorySheet code={code} onClose={() => setSheet(null)} />}
      <Confetti burst={burst} />
      {toast}
    </div>
  );
}
