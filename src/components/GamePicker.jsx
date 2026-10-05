import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Explain, Seg } from "./ui.jsx";

let cachedGames = null;
export function useGames() {
  const [games, setGames] = useState(cachedGames);
  useEffect(() => {
    if (cachedGames) return;
    api("/games").then(d => { cachedGames = d.games; setGames(d.games); }).catch(() => {});
  }, []);
  return games;
}

const POINT_ROWS = [
  ["albatross", "Albatross (3 under)"],
  ["eagle", "Eagle (2 under)"],
  ["birdie", "Birdie (1 under)"],
  ["par", "Par"],
  ["bogey", "Bogey (1 over)"],
  ["double", "Double bogey or worse"],
];

function CustomBuilder({ game, onChange }) {
  const set = patch => onChange({ ...game, ...patch });
  return (
    <div className="stack" style={{ marginTop: 12 }}>
      <div className="field">
        <label>Game name</label>
        <input value={game.name || ""} maxLength={40} onChange={e => set({ name: e.target.value })} placeholder="e.g. Birdie Bonanza" />
      </div>
      <div className="field">
        <label>How is it scored?</label>
        <div className="choice">
          {[
            ["strokes", "Total strokes", "Add up every shot. Lowest total wins."],
            ["points", "Points per hole", "Earn points for birdies, pars etc. Most points wins."],
            ["holewins", "Win holes", "Win a hole (fewest strokes) to earn points. Most points wins."],
          ].map(([v, t, d]) => (
            <button key={v} type="button" className={`opt ${game.style === v ? "sel" : ""}`} onClick={() => set({ style: v })}>
              <b>{t}</b><span className="tag">{d}</span>
            </button>
          ))}
        </div>
      </div>
      {game.style === "points" && (
        <div className="field">
          <label>Points for each result</label>
          <div className="grid2">
            {POINT_ROWS.map(([k, label]) => (
              <div key={k}>
                <label style={{ fontWeight: 500 }}>{label}</label>
                <input type="number" inputMode="numeric" value={game.points?.[k] ?? 0} onChange={e => set({ points: { ...game.points, [k]: e.target.value === "" ? 0 : Number(e.target.value) } })} />
              </div>
            ))}
          </div>
        </div>
      )}
      {game.style === "holewins" && (
        <div className="grid2">
          <div className="field">
            <label>Points per hole won</label>
            <input type="number" inputMode="decimal" min="1" value={game.holeWinPoints ?? 1} onChange={e => set({ holeWinPoints: Number(e.target.value) || 1 })} />
          </div>
          <div className="field">
            <label>If holes are tied</label>
            <select value={game.tie || "split"} onChange={e => set({ tie: e.target.value })}>
              <option value="split">Share the points</option>
              <option value="none">Nobody scores</option>
            </select>
          </div>
        </div>
      )}
      <div className="field">
        <label>Who is playing against whom?</label>
        <Seg value={game.unit || "player"} onChange={v => set({ unit: v })} options={[["player", "Everyone alone"], ["team", "In teams"]]} />
      </div>
      {game.unit === "team" && (
        <div className="field">
          <label>How does a team score a hole?</label>
          <Seg value={game.teamCount || "best"} onChange={v => set({ teamCount: v })} options={[["best", "Best score counts"], ["sum", "Everyone counts"]]} />
        </div>
      )}
      <div className="field">
        <label>Which holes count?</label>
        <Seg value={game.scope || "all"} onChange={v => set({ scope: v })} options={[["all", "All"], ["front", "Front 9"], ["back", "Back 9"]]} />
      </div>
      <div className="field">
        <label>Your own rules or notes (shown to everyone)</label>
        <textarea maxLength={600} value={game.notes || ""} onChange={e => set({ notes: e.target.value })} placeholder="e.g. Loser of the last hole buys the drinks" />
      </div>
    </div>
  );
}

export default function GamePicker({ game, onChange, holes }) {
  const games = useGames();
  if (!games) return <p className="muted">Loading games…</p>;
  const current = games.find(g => g.id === game.type) || games[0];
  const pick = g => onChange(g.id === game.type ? game : { ...g.defaults });
  return (
    <div className="stack">
      <div className="choice">
        {games.map(g => (
          <div key={g.id}>
            <button type="button" className={`opt ${game.type === g.id ? "sel" : ""}`} onClick={() => pick(g)}>
              <b>{g.emoji} {g.name}</b>
              <span className="tag">{g.tagline}</span>
              {g.teams === "required" && <span className="pill grey" style={{ marginTop: 6 }}>Teams · {g.minPlayers}+ players</span>}
              {g.id === "match" && <span className="pill grey" style={{ marginTop: 6 }}>2 players or 2 teams</span>}
            </button>
            {game.type === g.id && g.id !== "custom" && (
              <details className="how" open>
                <summary>How it works</summary>
                <Explain game={g} lines={g.rules} />
              </details>
            )}
          </div>
        ))}
      </div>
      {game.type === "custom" && <CustomBuilder game={game} onChange={onChange} />}
      {game.type !== "custom" && (
        <div className="card sky stack">
          <div className="row wrap">
            <div style={{ flex: 1 }}>
              <b>Use handicaps</b>
              <div className="small muted">Off = everyone plays off scratch (gross scores).</div>
            </div>
            <Seg value={game.useHandicap !== false} onChange={v => onChange({ ...game, useHandicap: v })} options={[[true, "On"], [false, "Off"]]} />
          </div>
          {holes === 18 && current.id !== "scramble" && (
            <div className="row wrap">
              <div style={{ flex: 1 }}><b>Holes that count</b></div>
              <Seg value={game.scope || "all"} onChange={v => onChange({ ...game, scope: v })} options={[["all", "All 18"], ["front", "Front 9"], ["back", "Back 9"]]} />
            </div>
          )}
        </div>
      )}
      {game.type === "custom" && (
        <div className="card sky stack">
          <div className="row wrap">
            <div style={{ flex: 1 }}>
              <b>Use handicaps</b>
              <div className="small muted">Off = gross scores.</div>
            </div>
            <Seg value={game.useHandicap !== false} onChange={v => onChange({ ...game, useHandicap: v })} options={[[true, "On"], [false, "Off"]]} />
          </div>
        </div>
      )}
    </div>
  );
}
