import { useState } from "react";
import MoneyForm from "../components/MoneyForm.jsx";
import { Sheet } from "../components/ui.jsx";
import { rm, rmSigned } from "../util.js";

export default function SettleTab({ round, a }) {
  const { settlement: s, players, standings, bets, meal } = round;
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState(null);
  const nameOf = id => players.find(p => p.id === Number(id))?.name || "?";
  const posOf = id => standings.participants.find(p => p.memberIds.includes(Number(id)))?.pos;
  const any = s.betsOn || s.mealOn;

  const openEdit = () => { setDraft({ bets, meal }); setEdit(true); };
  const save = async () => { setEdit(false); await a.run(() => a.patch({ bets: draft.bets, meal: draft.meal }), "Saved"); };

  const lines = [];
  lines.push(`⛳ ${round.courseName}: ${round.game.name}`);
  const ranked = standings.participants.map(p => `${p.pos}. ${p.name} ${p.label}`);
  lines.push(...ranked);
  if (s.transfers.length) {
    lines.push("", "💰 Settle up:");
    s.transfers.forEach(t => lines.push(`${t.fromName} → ${t.toName}  ${rm(t.cents)}`));
  }
  if (s.mealOn) {
    lines.push("", `🍜 Meal ${rm(s.mealTotal)}:`);
    players.forEach(p => lines.push(`${p.name} ${rm(s.mealShares[p.id])}`));
  }
  const text = lines.join("\n");

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); a.toast("Summary copied"); }
    } catch { /* dismissed */ }
  };

  return (
    <div className="stack">
      {!any && (
        <div className="card sand stack">
          <h3>No bet or meal set up</h3>
          <p className="small" style={{ margin: 0 }}>Add a friendly bet and/or split the makan bill by how everyone played.</p>
          <button className="btn" onClick={openEdit}>Set up bets & meal</button>
        </div>
      )}

      {s.transfers.length > 0 && (
        <div className="card paper">
          <h3>Who pays whom</h3>
          {s.transfers.map((t, i) => (
            <div key={i} className="xfer">
              <b>{t.fromName}</b><span className="arrow">pays</span><b>{t.toName}</b>
              <span className="amt">{rm(t.cents)}</span>
            </div>
          ))}
        </div>
      )}
      {any && s.transfers.length === 0 && <div className="card sky">Everyone is square. Nobody owes anything.</div>}

      {s.betsOn && (
        <div className="card">
          <h3>🎯 Game bet</h3>
          {s.betNotes.map((n, i) => <div key={i} className="small muted">{n}</div>)}
          <div className="list" style={{ marginTop: 6 }}>
            {players.map(p => (
              <div key={p.id} className="li">
                <div className="grow"><span className="name">{p.name}</span> <span className="small muted">#{posOf(p.id) ?? "–"}</span></div>
                <span className={`net ${s.betNets[p.id] >= 0 ? "pos" : "neg"}`}>{s.betNets[p.id] === 0 ? "even" : rmSigned(s.betNets[p.id])}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {s.mealOn && (
        <div className="card">
          <h3>🍜 Meal: {rm(s.mealTotal)}</h3>
          <div className="small muted">
            {meal.method === "equal" && "Split equally."}
            {meal.method === "loser_pays" && "Last place pays."}
            {meal.method === "winner_free" && "Winner eats free."}
            {meal.method === "by_rank" && `By finishing position (${meal.pcts.join("/")}%).`}
            {meal.method === "by_gap" && "The further behind, the more you pay."}
          </div>
          <div className="list" style={{ marginTop: 6 }}>
            {players.map(p => (
              <div key={p.id} className="li">
                <div className="grow"><span className="name">{p.name}</span> {s.mealPaidBy === p.id && <span className="pill gold">paid the bill</span>}</div>
                <span className="net">{rm(s.mealShares[p.id])}</span>
              </div>
            ))}
          </div>
          {!s.mealPaidBy && <div className="small muted" style={{ marginTop: 8 }}>Pick who paid the restaurant in "Edit bets & meal" to see who pays them back.</div>}
        </div>
      )}

      {any && <button className="btn" onClick={share}>📤 Share summary</button>}
      {any && <div className="shareline">{text}</div>}
      <button className="btn ghost" onClick={openEdit}>✎ Edit bets & meal</button>
      {round.status === "finished"
        ? <button className="btn ghost" onClick={() => a.run(() => a.patch({ status: "active" }), "Round reopened")}>Reopen round</button>
        : <button className="btn alt" onClick={() => a.run(() => a.patch({ status: "finished" }), "Round finished 🏁")}>🏁 Finish round</button>}

      {edit && draft && (
        <Sheet title="Bets & meal" onClose={() => setEdit(false)}>
          <div className="stack">
            <MoneyForm bets={draft.bets} meal={draft.meal} players={players} onChange={({ bets: b, meal: m }) => setDraft({ bets: b, meal: m })} />
            <button className="btn block" onClick={save}>Save</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
