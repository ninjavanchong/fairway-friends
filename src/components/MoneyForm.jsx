import { useEffect, useState } from "react";
import { Seg } from "./ui.jsx";

const POT_SPLITS = [
  [[100], "Winner takes all"],
  [[60, 40], "60 / 40"],
  [[60, 30, 10], "60 / 30 / 10"],
  [[50, 30, 20], "50 / 30 / 20"],
];
const RANK_SPLITS = [
  [[0, 10, 30, 60], "Last pays most (0/10/30/60)"],
  [[0, 0, 40, 60], "Bottom two pay (0/0/40/60)"],
  [[10, 20, 30, 40], "Gentle (10/20/30/40)"],
  [[0, 0, 0, 100], "Last pays all"],
];
const METHODS = [
  ["equal", "Split equally", "Everyone pays the same."],
  ["loser_pays", "Loser pays", "Last place pays the whole bill (tied losers share it)."],
  ["winner_free", "Winner eats free", "The winner pays nothing; everyone else splits it."],
  ["by_rank", "By finishing position", "Set a % for each position, e.g. last pays 60%."],
  ["by_gap", "By how far behind", "The further behind the winner, the bigger your share."],
];

const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

const parsePcts = t => t.split(/[ ,/]+/).filter(Boolean).map(Number).filter(n => Number.isFinite(n) && n >= 0);

function PctInput({ value, onChange }) {
  const [text, setText] = useState(value.join(", "));
  // A quick-split button changed the value from outside: show it.
  useEffect(() => { if (!same(parsePcts(text), value)) setText(value.join(", ")); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="field">
      <label>Percent for 1st, 2nd, 3rd… (comma separated)</label>
      <input
        value={text}
        inputMode="decimal"
        onChange={e => {
          setText(e.target.value);
          const nums = e.target.value.split(/[ ,\/]+/).filter(Boolean).map(Number).filter(n => Number.isFinite(n) && n >= 0);
          if (nums.length) onChange(nums);
        }}
      />
      <div className="small muted">Adds up to {value.reduce((a, b) => a + b, 0)}. Amounts are shared in proportion, so it doesn't need to be exactly 100.</div>
    </div>
  );
}

export default function MoneyForm({ bets, meal, onChange, players }) {
  const setBets = patch => onChange({ bets: { ...bets, ...patch }, meal });
  const setMeal = patch => onChange({ bets, meal: { ...meal, ...patch } });
  const setStep = step => onChange({ bets: { ...bets, step }, meal: { ...meal, step } });
  const mode = bets.mode || "none";

  return (
    <div className="stack">
      <div className="card paper stack">
        <div>
          <h3>🎯 Friendly bet on the game</h3>
          <div className="small muted">The app only works out who owes who. No payments are made here.</div>
        </div>
        <Seg value={mode} onChange={v => setBets({ mode: v, stake: bets.stake || (v === "pot" ? 10 : 1) })} options={[["none", "No bet"], ["pot", "Pot"], ["per_point", "Per point"]]} />
        {mode === "pot" && (
          <>
            <div className="field">
              <label>Everyone puts in (RM)</label>
              <input type="number" inputMode="decimal" min="0" value={bets.stake ?? 10} onChange={e => setBets({ stake: Number(e.target.value) })} />
            </div>
            <div className="field">
              <label>Pot is split by finish</label>
              <div className="choice">
                {POT_SPLITS.map(([s, label]) => (
                  <button key={label} type="button" className={`opt ${same(bets.split || [100], s) ? "sel" : ""}`} onClick={() => setBets({ split: s })}>
                    <b>{label}</b>
                  </button>
                ))}
              </div>
            </div>
            <PctInput value={bets.split || [100]} onChange={v => setBets({ split: v })} />
          </>
        )}
        {mode === "per_point" && (
          <div className="field">
            <label>RM per stroke / point / hole of difference</label>
            <input type="number" inputMode="decimal" min="0" step="0.5" value={bets.stake ?? 1} onChange={e => setBets({ stake: Number(e.target.value) })} />
            <div className="small muted">Every player pays the gap to everyone who beat them. Beat a friend by 3 strokes at RM2 = they pay you RM6.</div>
          </div>
        )}
      </div>

      <div className="card paper stack">
        <div className="row">
          <div style={{ flex: 1 }}>
            <h3>🍜 Who pays for the meal?</h3>
            <div className="small muted">Split the after-round makan bill by how everyone played.</div>
          </div>
          <Seg value={!!meal.enabled} onChange={v => setMeal({ enabled: v })} options={[[false, "Off"], [true, "On"]]} />
        </div>
        {meal.enabled && (
          <>
            <div className="field">
              <label>Total bill (RM)</label>
              <input type="number" inputMode="decimal" min="0" value={meal.total ?? ""} placeholder="You can enter this after the round" onChange={e => setMeal({ total: Number(e.target.value) })} />
            </div>
            <div className="field">
              <label>How to split it</label>
              <div className="choice">
                {METHODS.map(([v, t, d]) => (
                  <button key={v} type="button" className={`opt ${meal.method === v ? "sel" : ""}`} onClick={() => setMeal({ method: v })}>
                    <b>{t}</b><span className="tag">{d}</span>
                  </button>
                ))}
              </div>
            </div>
            {meal.method === "by_rank" && (
              <>
                <div className="field">
                  <label>Quick splits</label>
                  <div className="choice">
                    {RANK_SPLITS.map(([s, label]) => (
                      <button key={label} type="button" className={`opt ${same(meal.pcts || [], s) ? "sel" : ""}`} onClick={() => setMeal({ pcts: s })}><b>{label}</b></button>
                    ))}
                  </div>
                </div>
                <PctInput value={meal.pcts || [0, 10, 30, 60]} onChange={v => setMeal({ pcts: v })} />
              </>
            )}
            {players && (
              <div className="field">
                <label>Who paid the restaurant? (they get paid back)</label>
                <select value={meal.paidBy || ""} onChange={e => setMeal({ paidBy: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">Not sure yet: just show each person's share</option>
                  {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
          </>
        )}
      </div>

      {(mode !== "none" || meal.enabled) && (
        <div className="field">
          <label>Round amounts to</label>
          <Seg value={meal.step === 1 || bets.step === 1 ? 1 : 0.1} onChange={setStep} options={[[0.1, "10 sen"], [1, "RM 1"]]} />
        </div>
      )}
    </div>
  );
}
