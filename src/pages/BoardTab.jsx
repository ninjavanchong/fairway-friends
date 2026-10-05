import { scoreClass } from "../util.js";

export default function BoardTab({ round, a }) {
  const { standings, players, holes, pars, scores, game } = round;
  const parts = standings.participants;
  const scramble = game.unit === "team" && game.teamCount === "single";
  const complete = standings.complete;
  const winners = parts.filter(p => p.pos === 1);
  const started = parts.some(p => p.thru > 0);

  // Rows for the hole-by-hole card.
  const rows = scramble
    ? parts.map(p => ({ id: p.memberIds[0], name: p.name }))
    : players.map(p => ({ id: p.id, name: p.name }));
  const sum = (id, from, to) => {
    let t = 0, n = 0;
    for (let h = from; h <= to; h++) { const s = scores[id]?.[h]; if (s != null) { t += s; n++; } }
    return n ? t : "–";
  };
  const parSum = (from, to) => pars.slice(from - 1, to).reduce((x, y) => x + y, 0);
  const cols = Array.from({ length: holes }, (_, i) => i + 1);
  const hasSplit = holes === 18;

  const nameOf = p => p.memberIds.length > 1
    ? players.filter(x => p.memberIds.includes(x.id)).map(x => x.name).join(" & ")
    : "";

  return (
    <div className="stack">
      {complete && round.status !== "setup" && started && (
        <div className="winner">
          <div style={{ fontSize: "2rem" }}>🏆</div>
          <h2>{standings.match ? standings.match.label : winners.length > 1 ? `${winners.map(w => w.name).join(" & ")} tie for the win` : `${winners[0].name} wins!`}</h2>
          {round.status === "active" && (
            <button className="btn small" style={{ marginTop: 10 }} onClick={() => a.run(() => a.patch({ status: "finished" }), "Round finished")}>Finish round</button>
          )}
        </div>
      )}

      {standings.match && !complete && <div className="matchbanner">{standings.match.label}</div>}

      <div className="card">
        <div className="row">
          <h3 style={{ margin: 0, flex: 1 }}>{game.name}</h3>
          <span className="pill grey">{game.useHandicap === false ? "gross" : "net"}</span>
        </div>
        {!started && <p className="muted small" style={{ marginTop: 8 }}>No scores yet. Head to the Score tab.</p>}
        <div>
          {parts.map(p => (
            <div key={p.key} className="lb-row">
              <div className={`pos ${p.pos === 1 && started ? "p1" : ""}`}>{started ? p.pos : "–"}</div>
              <div style={{ minWidth: 0 }}>
                <div className="name" style={{ fontWeight: 800 }}>{p.name}</div>
                {nameOf(p) && <div className="small muted">{nameOf(p)}</div>}
              </div>
              <div>
                <div className="lb-val">{p.label}</div>
                <div className="lb-sub">{standings.match ? `thru ${p.thru}` : `thru ${p.thru}/${standings.scope.length}`}{p.gross != null && game.useHandicap !== false && p.thru ? ` · gross ${p.gross}` : ""}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Scorecard</h3>
        <div className="sheetwrap">
          <table className="sc">
            <thead>
              <tr>
                <th>Hole</th>
                {cols.map(h => <th key={h}>{h}</th>)}
                {hasSplit && <><th>OUT</th><th>IN</th></>}
                <th>TOT</th>
              </tr>
              <tr>
                <th>Par</th>
                {cols.map(h => <th key={h}>{pars[h - 1]}</th>)}
                {hasSplit && <><th>{parSum(1, 9)}</th><th>{parSum(10, 18)}</th></>}
                <th>{parSum(1, holes)}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  {cols.map(h => {
                    const s = scores[r.id]?.[h];
                    return <td key={h} className={scoreClass(s, pars[h - 1])}>{s ?? ""}</td>;
                  })}
                  {hasSplit && <><td className="tot">{sum(r.id, 1, 9)}</td><td className="tot">{sum(r.id, 10, 18)}</td></>}
                  <td className="tot">{sum(r.id, 1, holes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="small muted" style={{ marginTop: 8 }}>Gross strokes. Red circle = birdie, gold = eagle or better.</div>
      </div>
    </div>
  );
}
