import { useRef, useState } from "react";
import { scoreClass, scoreName, timeAgo } from "../util.js";

const strokesOnHole = (hcp, hole, holes) => {
  const h = Math.max(0, Math.round(Number(hcp) || 0));
  return Math.floor(h / holes) + (hole <= h % holes ? 1 : 0);
};

function editNote(info, player, entityName) {
  if (!info) return null;
  if (info.edits > 0) return { text: `✎ Edited by ${info.by} · ${timeAgo(info.at)}`, edited: true };
  if (info.by && info.by !== entityName) return { text: `Entered by ${info.by} · ${timeAgo(info.at)}`, edited: false };
  return null;
}

export default function ScoreTab({ round, a, goBoard }) {
  const { holes, pars, players, game } = round;
  const scramble = game.unit === "team" && game.teamCount === "single";

  // Entities that get a score box: players, or teams for a scramble.
  const entities = scramble
    ? [...new Set(players.map(p => p.team).filter(Boolean))].sort().map(t => {
        const members = players.filter(p => p.team === t);
        return { id: members[0].id, name: `Team ${t}`, sub: members.map(m => m.name).join(" & "), members, hcp: Math.round(members.reduce((x, m) => x + m.handicap, 0) / members.length) };
      })
    : players.map(p => ({ id: p.id, name: p.name, sub: "", members: [p], hcp: p.handicap }));

  const filled = (hole, ent) => round.scores[ent.id]?.[hole] != null;
  const [hole, setHole] = useState(() => {
    for (let h = 1; h <= holes; h++) if (!entities.every(e => filled(h, e))) return h;
    return holes;
  });
  const [local, setLocal] = useState({}); // optimistic values: "pid:hole" -> strokes|null
  const chain = useRef(Promise.resolve());
  const par = pars[hole - 1] || 4;

  const valueOf = (ent, h) => {
    const k = `${ent.id}:${h}`;
    return k in local ? local[k] : (round.scores[ent.id]?.[h] ?? null);
  };

  const set = (ent, strokes) => {
    const k = `${ent.id}:${hole}`;
    const clamped = strokes == null ? null : Math.max(1, Math.min(20, strokes));
    setLocal(l => ({ ...l, [k]: clamped }));
    if (clamped != null && clamped - par <= -1) a.celebrate();
    // One request at a time so replies can't arrive out of order.
    chain.current = chain.current
      .then(() => a.setScore(ent.id, hole, clamped))
      .catch(e => a.toast(e.message))
      .finally(() => setLocal(l => { const n = { ...l }; delete n[k]; return n; }));
  };

  const allDone = entities.every(e => valueOf(e, hole) != null);
  const finished = round.status === "finished";

  return (
    <div>
      {finished && <div className="warn">This round is finished. You can still fix a score if needed.</div>}
      <div className="holenav">
        <button className="iconbtn" disabled={hole <= 1} onClick={() => setHole(hole - 1)} aria-label="Previous hole">‹</button>
        <div className="holeinfo">
          <div className="big">Hole {hole}</div>
          <div className="muted small">Par {par}</div>
        </div>
        <button className="iconbtn" disabled={hole >= holes} onClick={() => setHole(hole + 1)} aria-label="Next hole">›</button>
      </div>
      <div className="holedots">
        {Array.from({ length: holes }, (_, i) => i + 1).map(h => (
          <button key={h} className={h === hole ? "cur" : entities.every(e => valueOf(e, h) != null) ? "done" : ""} onClick={() => setHole(h)} aria-label={`Go to hole ${h}`}>{h}</button>
        ))}
      </div>

      <div className="stack">
        {entities.map(ent => {
          const v = valueOf(ent, hole);
          const info = round.scoreInfo[ent.id]?.[hole];
          const note = !(`${ent.id}:${hole}` in local) ? editNote(info, ent, ent.name) : null;
          const got = game.useHandicap !== false ? strokesOnHole(ent.hcp, hole, holes) : 0;
          const cls = scoreClass(v, par);
          return (
            <div key={ent.id} className="card paper">
              <div className="scorecard">
                <div>
                  <div className="pname">{ent.name}{ent.id === a.me.playerId && <span className="pill" style={{ marginLeft: 6 }}>you</span>}</div>
                  <div className="psub">
                    {ent.sub && <>{ent.sub} · </>}
                    {game.useHandicap !== false && ent.hcp > 0 ? `handicap ${ent.hcp}${got ? ` · ${got} stroke${got > 1 ? "s" : ""} here` : ""}` : "scratch"}
                  </div>
                  <div className={`scorelabel ${cls}`}>{scoreName(v, par)}</div>
                </div>
                <div className="scorectl">
                  <button onClick={() => set(ent, v == null ? par - 1 : v - 1)} aria-label={`${ent.name} one less`}>−</button>
                  <div className={`scorenum ${v == null ? "empty" : cls}`} onClick={() => v == null && set(ent, par)} role="button" aria-label={`${ent.name} score`}>{v ?? "–"}</div>
                  <button onClick={() => set(ent, v == null ? par + 1 : v + 1)} aria-label={`${ent.name} one more`}>+</button>
                </div>
                {note && <div className={`editnote ${note.edited ? "edited" : ""}`}>{note.text}</div>}
              </div>
              {v != null && (
                <div style={{ marginTop: 6 }}>
                  <button className="btn ghost small" onClick={() => set(ent, null)}>Clear</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="row" style={{ marginTop: 14 }}>
        {hole > 1 ? <button className="btn ghost" onClick={() => setHole(hole - 1)}>← Hole {hole - 1}</button> : <span />}
        <div className="spacer" />
        {hole < holes
          ? <button className={`btn ${allDone ? "alt" : ""}`} onClick={() => setHole(hole + 1)}>Hole {hole + 1} →</button>
          : <button className="btn alt" onClick={goBoard}>See results 🏆</button>}
      </div>
      <p className="small muted center" style={{ marginTop: 12 }}>Tap the dash to enter par, then use − and +. Anyone can enter anyone's score; changes are logged.</p>
    </div>
  );
}
