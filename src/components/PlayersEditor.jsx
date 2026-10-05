import { useState } from "react";
import { Seg, Stepper, TeamChips } from "./ui.jsx";

const KEYS = ["A", "B", "C", "D", "E", "F"];

export function teamCountFor(round) {
  if (round.game.type === "match") return 2;
  return Math.max(2, Math.min(6, Math.ceil(round.players.length / 2)));
}

/** Players, handicaps, teams and (for team games) partner swaps. Works before and during a round. */
export default function PlayersEditor({ round, a }) {
  const [name, setName] = useState("");
  const g = round.game;
  const players = round.players;
  const showTeams = g.unit === "team" || g.type === "match";
  const canSwap = g.unit === "team" && g.teamCount !== "single" && g.type !== "match";
  const tc = teamCountFor(round);
  const scopeLen = round.standings.scope.length;
  const swap = canSwap ? g.swapEvery || 0 : 0;
  const segments = swap ? Math.ceil(scopeLen / swap) : 1;
  const firstHole = round.standings.scope[0] || 1;
  const live = round.status !== "setup";

  const effective = (p, s) => {
    for (let i = s; i >= 1; i--) {
      const plan = g.teamPlan?.[i];
      if (plan && Object.prototype.hasOwnProperty.call(plan, p.id)) return plan[p.id];
    }
    return p.team || null;
  };
  const patchGame = patch => a.run(() => a.patch({ game: { ...g, ...patch } }));
  const setSeg = (s, pid, team) => {
    const cur = {};
    players.forEach(p => { cur[p.id] = effective(p, s); });
    cur[pid] = team;
    patchGame({ teamPlan: { ...(g.teamPlan || {}), [s]: cur } });
  };
  const autoRotate = () => {
    const ids = players.map(p => p.id);
    const plan = {};
    for (let s = 1; s < segments; s++) {
      const m = {};
      if (ids.length === 4) {
        const pairings = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]][s % 3];
        pairings.forEach((pair, ti) => pair.forEach(i => { m[ids[i]] = KEYS[ti]; }));
      } else {
        [...ids].sort(() => Math.random() - 0.5).forEach((id, i) => { m[id] = KEYS[i % tc]; });
      }
      plan[s] = m;
    }
    // Segment 1 of the schedule (index 0) stays on the base teams; make sure those are A/B for 4 players.
    patchGame({ teamPlan: plan });
  };
  const shuffle = async () => {
    const ids = [...players].sort(() => Math.random() - 0.5).map(p => p.id);
    for (let i = 0; i < ids.length; i++) await a.updatePlayer(ids[i], { team: KEYS[i % tc] });
  };
  const add = async e => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    setName("");
    await a.run(() => a.addPlayer(n, 0));
  };
  const remove = p => {
    if (live && !window.confirm(`Remove ${p.name}? Their scores for this round will be deleted.`)) return;
    a.run(() => a.removePlayer(p.id));
  };

  return (
    <div className="stack">
      {canSwap && (
        <div className="card sky stack">
          <div className="row wrap">
            <div style={{ flex: 1 }}>
              <b>Swap partners</b>
              <div className="small muted">Teams change every few holes, e.g. a new partner every 6.</div>
            </div>
            <Seg value={swap} onChange={v => patchGame({ swapEvery: v })} options={[[0, "Never"], [3, "3"], [6, "6"], [9, "9"]]} />
          </div>
          {swap > 0 && <button className="btn ghost small" onClick={autoRotate}>🔄 Auto-set the rotation</button>}
        </div>
      )}

      <div className="card">
        <div className="row" style={{ marginBottom: 6 }}>
          <h3 style={{ margin: 0, flex: 1 }}>Players ({players.length}){swap ? ` · holes ${firstHole}-${firstHole + swap - 1}` : ""}</h3>
          {showTeams && <button className="btn ghost small" onClick={shuffle}>🎲 Shuffle teams</button>}
        </div>
        <div className="small muted" style={{ marginBottom: 6 }}>
          Handicap = strokes a player gets for the round (net = gross − handicap). You can change anything, any time.
        </div>
        <div className="list">
          {players.map(p => (
            <div key={p.id} className="li" style={{ flexWrap: "wrap" }}>
              <div className="grow">
                <div className="name">{p.name} {p.id === a.me.playerId && <span className="pill">you</span>}</div>
                {showTeams && <div style={{ marginTop: 4 }}><TeamChips value={p.team} count={tc} onChange={t => a.run(() => a.updatePlayer(p.id, { team: t }))} /></div>}
              </div>
              {g.useHandicap !== false && (
                <div style={{ textAlign: "center" }}>
                  <Stepper value={p.handicap} onChange={h => a.run(() => a.updatePlayer(p.id, { handicap: h }))} label={`${p.name} handicap`} />
                  <div className="small muted">handicap</div>
                </div>
              )}
              {p.id !== a.me.playerId && <button className="iconbtn" aria-label={`Remove ${p.name}`} onClick={() => remove(p)}>✕</button>}
            </div>
          ))}
        </div>
        <form className="row" onSubmit={add} style={{ marginTop: 10 }}>
          <input value={name} maxLength={40} onChange={e => setName(e.target.value)} placeholder="Add a friend by name (you can score for them)" aria-label="Add a player" />
          <button className="btn small" type="submit" disabled={!name.trim()}>Add</button>
        </form>
      </div>

      {swap > 0 && Array.from({ length: segments - 1 }, (_, i) => i + 1).map(s => {
        const from = firstHole + s * swap, to = Math.min(firstHole + (s + 1) * swap - 1, firstHole + scopeLen - 1);
        return (
          <div key={s} className="card">
            <h3>New partners: holes {from}-{to}</h3>
            <div className="list">
              {players.map(p => (
                <div key={p.id} className="li">
                  <div className="grow name">{p.name}</div>
                  <TeamChips value={effective(p, s)} count={tc} onChange={t => setSeg(s, p.id, t)} />
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {round.setupErrors.length > 0 && <div className="warn">{round.setupErrors.map((e, i) => <div key={i}>• {e}</div>)}</div>}
    </div>
  );
}
