import { Mark } from "../components/ui.jsx";
import { fmtToPar, metricOf, scoreClass, toParClass, toParOf } from "../util.js";

function countsFor(scores, pars, id) {
  const c = { eagle: 0, birdie: 0, par: 0, bogey: 0, dbl: 0 };
  for (const [h, s] of Object.entries(scores[id] || {})) {
    const k = scoreClass(s, pars[Number(h) - 1]);
    if (k) c[k]++;
  }
  return c;
}

export default function BoardTab({ round, a }) {
  const { standings, players, holes, pars, scores, game } = round;
  const parts = standings.participants;
  const scramble = game.unit === "team" && game.teamCount === "single";
  const complete = standings.complete;
  const winners = parts.filter(p => p.pos === 1);
  const started = parts.some(p => p.thru > 0 || p.holesPlayed > 0);
  const scopeLen = standings.scope.length;

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
  const names = ids => players.filter(x => ids.includes(x.id)).map(x => x.name).join(" & ");
  const head = parts[0] ? metricOf(round, parts[0]).head : "SCORE";
  const showHolesWon = game.style !== "holewins";
  const net = game.useHandicap !== false;

  return (
    <div className="stack">
      {complete && started && (
        <div className="winner">
          <div style={{ fontSize: "2rem" }}>🏆</div>
          <h2>{standings.match ? standings.match.label : winners.length > 1 ? `${winners.map(w => w.name).join(" & ")} tie for the win` : `${winners[0].name} wins!`}</h2>
          {round.status === "active" && (
            <button className="btn small" style={{ marginTop: 10 }} onClick={() => a.run(() => a.patch({ status: "finished" }), "Round finished")}>Finish round</button>
          )}
        </div>
      )}

      {standings.match && !complete && <div className="matchbanner">{standings.match.label}</div>}

      <div className="card lbcard">
        <div className="row" style={{ marginBottom: 8 }}>
          <h3 style={{ margin: 0, flex: 1 }}>{game.name}</h3>
          <span className="pill grey">{net ? "net (after handicap)" : "gross"}</span>
        </div>
        {standings.rotating && <div className="small muted" style={{ marginBottom: 6 }}>Partners swap every {game.swapEvery} holes.</div>}
        {!started && <p className="muted small">No scores yet. Head to the Score tab.</p>}
        <div className="lbhead">
          <span>POS</span><span>PLAYER</span><span className="c">THRU</span><span className="c">TO PAR</span><span className="c">{head}</span>
        </div>
        {parts.map(p => {
          const m = metricOf(round, p);
          const tp = toParOf(round, p);
          const done = p.thru >= scopeLen && !standings.match;
          return (
            <div key={p.key} className="lbrow">
              <div className={`pos ${p.pos === 1 && started ? "p1" : ""}`}>{started ? p.pos : "–"}</div>
              <div style={{ minWidth: 0 }}>
                <div className="name">{p.name}</div>
                <div className="small muted lbsub">
                  {p.memberIds.length > 1 && !standings.rotating ? names(p.memberIds) + " · " : ""}
                  {p.grossTotal ? `gross ${p.grossTotal}` : "no score yet"}
                  {showHolesWon && p.holesPlayed ? ` · ${p.holesWon ?? 0} won` : ""}
                </div>
              </div>
              <div className="c">{standings.match ? p.thru : done ? "F" : p.holesPlayed}</div>
              <div className={`c topar ${tp == null ? "" : toParClass(tp)}`}>{tp == null ? "–" : fmtToPar(tp)}</div>
              <div className="c metric">{m.value}</div>
            </div>
          );
        })}
        <div className="small muted" style={{ marginTop: 8 }}>
          THRU = holes played (F = finished). TO PAR = strokes against par{net ? ", after handicap" : ""}.
          {" "}{head === "POINTS" ? "POINTS = game points." : head === "HOLES" ? "HOLES = holes won." : head === "MATCH" ? "MATCH = holes up." : head === "NET" ? "NET = strokes minus handicap." : "GROSS = strokes taken."}
          {showHolesWon ? " \"won\" = holes won outright." : ""}
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
                    return <td key={h}>{s != null ? <Mark cls={scoreClass(s, pars[h - 1])}>{s}</Mark> : ""}</td>;
                  })}
                  {hasSplit && <><td className="tot">{sum(r.id, 1, 9)}</td><td className="tot">{sum(r.id, 10, 18)}</td></>}
                  <td className="tot">{sum(r.id, 1, holes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="legend">
          <span><Mark cls="eagle">2</Mark> Eagle or better</span>
          <span><Mark cls="birdie">3</Mark> Birdie</span>
          <span><Mark cls="par">4</Mark> Par</span>
          <span><Mark cls="bogey">5</Mark> Bogey</span>
          <span><Mark cls="dbl">6</Mark> Double bogey+</span>
        </div>
        <div className="small muted" style={{ marginTop: 6 }}>Gross strokes, as taken.</div>
      </div>

      {!scramble && started && (
        <div className="card">
          <h3>Round stats</h3>
          <div className="sheetwrap">
            <table className="sc stats">
              <thead><tr><th>Player</th><th>Eagle+</th><th>Birdie</th><th>Par</th><th>Bogey</th><th>Dbl+</th></tr></thead>
              <tbody>
                {rows.map(r => {
                  const c = countsFor(scores, pars, r.id);
                  return <tr key={r.id}><td>{r.name}</td><td>{c.eagle}</td><td>{c.birdie}</td><td>{c.par}</td><td>{c.bogey}</td><td>{c.dbl}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
