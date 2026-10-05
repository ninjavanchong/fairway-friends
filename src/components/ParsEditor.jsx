// Par-per-hole grid plus an optional layout name (e.g. which nines are being played).
export function ParsGrid({ pars, onChange }) {
  const total = pars.reduce((a, b) => a + b, 0);
  return (
    <div className="field">
      <label>Par for each hole (total par {total})</label>
      <div className="pargrid">
        {pars.map((p, i) => (
          <div key={i}>
            {i + 1}
            <select value={p} onChange={e => onChange(pars.map((x, j) => (j === i ? Number(e.target.value) : x)))}>
              {[3, 4, 5, 6].map(n => <option key={n}>{n}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LayoutName({ value, onChange }) {
  return (
    <div className="field">
      <label>Which nines are you playing? (optional)</label>
      <input value={value} maxLength={100} onChange={e => onChange(e.target.value)} placeholder="e.g. Bunga Raya + Palm, or East 9 + West 9" />
      <div className="small muted">Big clubs have several 9-hole loops. Name the ones you're on and fix the pars below if they differ.</div>
    </div>
  );
}
