import { useState } from "react";
import { InviteBody, Sheet, Stepper, TeamChips } from "../components/ui.jsx";
import GamePicker from "../components/GamePicker.jsx";
import MoneyForm from "../components/MoneyForm.jsx";

function teamCount(round) {
  if (round.game.type === "match") return 2;
  return Math.max(2, Math.min(6, Math.ceil(round.players.length / 2)));
}

export default function Lobby({ round, a }) {
  const [name, setName] = useState("");
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState(null);
  const showTeams = round.game.unit === "team" || round.game.type === "match";
  const tc = teamCount(round);

  const add = async e => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    setName("");
    await a.run(() => a.addPlayer(n, 0));
  };

  const shuffle = async () => {
    const ids = [...round.players].sort(() => Math.random() - 0.5).map(p => p.id);
    const keys = ["A", "B", "C", "D", "E", "F"].slice(0, tc);
    for (let i = 0; i < ids.length; i++) await a.updatePlayer(ids[i], { team: keys[i % keys.length] });
  };

  const openEdit = () => { setDraft({ game: round.game, bets: round.bets, meal: round.meal }); setEdit(true); };
  const saveEdit = async () => {
    setEdit(false);
    await a.run(() => a.patch({ game: draft.game, bets: draft.bets, meal: draft.meal }), "Saved");
  };

  const errs = round.setupErrors;

  return (
    <div className="stack">
      <div className="card paper">
        <h2>Waiting room</h2>
        <p className="muted small" style={{ marginBottom: 0 }}>Friends scan this QR code to join. Or skip the scanning: add everyone by name below and enter all the scores yourself. Set handicaps {showTeams ? "and teams " : ""}then tee off.</p>
      </div>

      <div className="card"><InviteBody round={round} toast={a.toast} /></div>

      <div className="card">
        <div className="row" style={{ marginBottom: 6 }}>
          <h3 style={{ margin: 0, flex: 1 }}>Players ({round.players.length})</h3>
          {showTeams && <button className="btn ghost small" onClick={shuffle}>🎲 Shuffle teams</button>}
        </div>
        <div className="small muted" style={{ marginBottom: 6 }}>
          Handicap = the strokes a player gets for this round (net = gross − handicap). It locks once the round starts.
        </div>
        <div className="list">
          {round.players.map(p => (
            <div key={p.id} className="li" style={{ flexWrap: "wrap" }}>
              <div className="grow">
                <div className="name">{p.name} {p.id === a.me.playerId && <span className="pill">you</span>}</div>
                {showTeams && <div style={{ marginTop: 4 }}><TeamChips value={p.team} count={tc} onChange={t => a.run(() => a.updatePlayer(p.id, { team: t }))} /></div>}
              </div>
              {round.game.useHandicap !== false && (
                <div style={{ textAlign: "center" }}>
                  <Stepper value={p.handicap} onChange={h => a.run(() => a.updatePlayer(p.id, { handicap: h }))} label={`${p.name} handicap`} />
                  <div className="small muted">handicap</div>
                </div>
              )}
              {p.id !== a.me.playerId && <button className="iconbtn" aria-label={`Remove ${p.name}`} onClick={() => a.run(() => a.removePlayer(p.id))}>✕</button>}
            </div>
          ))}
        </div>
        <form className="row" onSubmit={add} style={{ marginTop: 10 }}>
          <input value={name} maxLength={40} onChange={e => setName(e.target.value)} placeholder="Add a friend by name (you can score for them)" aria-label="Add a player" />
          <button className="btn small" type="submit" disabled={!name.trim()}>Add</button>
        </form>
      </div>

      <div className="card sand">
        <div className="row wrap">
          <div style={{ flex: 1 }}>
            <b>{round.game.name}</b>
            <div className="small muted">
              {round.bets.mode === "none" ? "No bet" : round.bets.mode === "pot" ? `RM${round.bets.stake} pot` : `RM${round.bets.stake} per point`}
              {round.meal.enabled ? " · meal split on" : ""}
            </div>
          </div>
          <button className="btn ghost small" onClick={openEdit}>Change</button>
        </div>
      </div>

      {errs.length > 0 && <div className="warn">{errs.map((e, i) => <div key={i}>• {e}</div>)}</div>}
      <button className="btn alt block" disabled={errs.length > 0} onClick={() => a.run(() => a.patch({ status: "active" }), "Round started. Good luck! ⛳")}>
        ⛳ Start round
      </button>

      {edit && draft && (
        <Sheet title="Game & money" onClose={() => setEdit(false)}>
          <div className="stack">
            <GamePicker game={draft.game} onChange={g => setDraft({ ...draft, game: g })} holes={round.holes} />
            <h2 style={{ marginTop: 10 }}>Bets & meal</h2>
            <MoneyForm bets={draft.bets} meal={draft.meal} players={round.players} onChange={({ bets, meal }) => setDraft({ ...draft, bets, meal })} />
            <button className="btn block" onClick={saveEdit}>Save</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
