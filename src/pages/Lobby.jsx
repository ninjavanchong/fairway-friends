import { useState } from "react";
import { InviteBody } from "../components/ui.jsx";
import PlayersEditor from "../components/PlayersEditor.jsx";
import SettingsSheet from "../components/SettingsSheet.jsx";

export default function Lobby({ round, a }) {
  const [edit, setEdit] = useState(null);
  const errs = round.setupErrors;

  return (
    <div className="stack">
      <div className="card paper">
        <h2>Waiting room</h2>
        <p className="muted small" style={{ marginBottom: 0 }}>
          Friends scan this QR code to join. Or skip the scanning: add everyone by name below and enter all the scores yourself.
        </p>
      </div>

      <div className="card"><InviteBody round={round} toast={a.toast} /></div>

      <PlayersEditor round={round} a={a} />

      <div className="card sand">
        <div className="row wrap">
          <div style={{ flex: 1 }}>
            <b>{round.game.name}</b>
            <div className="small muted">
              {round.bets.mode === "none" ? "No bet" : round.bets.mode === "pot" ? `RM${round.bets.stake} pot` : `RM${round.bets.stake} per point`}
              {round.meal.enabled ? " · meal split on" : ""}
            </div>
          </div>
          <button className="btn ghost small" onClick={() => setEdit("game")}>Change</button>
        </div>
      </div>

      {errs.length > 0 && <div className="warn">{errs.map((e, i) => <div key={i}>• {e}</div>)}</div>}
      <button className="btn alt block" disabled={errs.length > 0} onClick={() => a.run(() => a.patch({ status: "active" }), "Round started. Good luck! ⛳")}>
        ⛳ Start round
      </button>
      {edit && <SettingsSheet round={round} a={a} start={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}
