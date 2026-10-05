// Money maths: game bets, meal split and "who pays whom".
// Everything is computed in integer sen (RM x 100) so nothing drifts.

export const MEAL_METHODS = ["equal", "loser_pays", "winner_free", "by_rank", "by_gap"];

const toCents = rm => Math.round((Number(rm) || 0) * 100);

export function normalizeBets(b = {}) {
  const mode = ["pot", "per_point"].includes(b?.mode) ? b.mode : "none";
  const split = Array.isArray(b?.split) && b.split.length
    ? b.split.map(n => Math.max(0, Number(n) || 0)).slice(0, 12)
    : [100];
  return {
    mode,
    stake: Math.max(0, Math.min(100000, Number(b?.stake) || 0)),
    split,
    step: [0.1, 1].includes(Number(b?.step)) ? Number(b.step) : 0.1,
  };
}

export function normalizeMeal(m = {}) {
  const method = MEAL_METHODS.includes(m?.method) ? m.method : "equal";
  const pcts = Array.isArray(m?.pcts) && m.pcts.length
    ? m.pcts.map(n => Math.max(0, Number(n) || 0)).slice(0, 12)
    : [0, 10, 30, 60];
  return {
    enabled: !!m?.enabled,
    total: Math.max(0, Math.min(1000000, Number(m?.total) || 0)),
    method,
    pcts,
    paidBy: m?.paidBy ? Number(m.paidBy) : null,
    step: [0.1, 1].includes(Number(m?.step)) ? Number(m.step) : 0.1,
  };
}

/** Group players by finishing position, with the slots (1-based ranks) each group occupies. */
function groupSlots(players, posOf) {
  const sorted = [...players].sort((a, b) => posOf(a) - posOf(b));
  const groups = [];
  let slot = 1;
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j < sorted.length && posOf(sorted[j]) === posOf(sorted[i])) j++;
    const members = sorted.slice(i, j);
    groups.push({ pos: posOf(sorted[i]), members, slots: members.map((_, k) => slot + k) });
    slot += members.length;
    i = j;
  }
  return groups;
}

/** Split `totalCents` in proportion to `weights`, rounded to `stepCents`, summing exactly. */
export function allocate(totalCents, weights, stepCents) {
  const n = weights.length;
  const sumW = weights.reduce((a, b) => a + b, 0);
  if (!n) return [];
  const w = sumW > 0 ? weights : weights.map(() => 1);
  const sw = w.reduce((a, b) => a + b, 0);
  const exact = w.map(x => (totalCents * x) / sw);
  const units = exact.map(x => Math.floor(x / stepCents + 1e-9));
  let used = units.reduce((a, b) => a + b, 0) * stepCents;
  const fr = exact.map((x, i) => ({ i, f: x / stepCents - units[i] })).sort((a, b) => b.f - a.f);
  let left = totalCents - used;
  const out = units.map(u => u * stepCents);
  let k = 0;
  while (left >= stepCents && k < 10000) {
    out[fr[k % n].i] += stepCents; left -= stepCents; k++;
  }
  if (left > 0) { // total isn't a multiple of the step: the leftover goes to the largest share
    const big = out.indexOf(Math.max(...out));
    out[big] += left;
  }
  return out;
}

/** Round a set of net amounts (sum = 0) to the step while keeping the sum exactly 0. */
function roundNets(nets, stepCents) {
  const ids = Object.keys(nets);
  const pos = ids.filter(id => nets[id] > 0), neg = ids.filter(id => nets[id] < 0);
  const rounded = {};
  const posTotal = pos.reduce((a, id) => a + nets[id], 0);
  const negTotal = -neg.reduce((a, id) => a + nets[id], 0);
  // Use the smaller side's rounded total so both sides balance.
  const target = Math.round(Math.min(posTotal, negTotal) / stepCents) * stepCents;
  const p = allocate(target, pos.map(id => nets[id]), stepCents);
  const q = allocate(target, neg.map(id => -nets[id]), stepCents);
  pos.forEach((id, i) => { rounded[id] = p[i]; });
  neg.forEach((id, i) => { rounded[id] = -q[i]; });
  ids.forEach(id => { if (rounded[id] === undefined) rounded[id] = 0; });
  return rounded;
}

/** Game bets. Returns net sen per player id. */
export function computeBets(betsIn, standings, players) {
  const bets = normalizeBets(betsIn);
  const nets = Object.fromEntries(players.map(p => [p.id, 0]));
  const notes = [];
  if (bets.mode === "none" || bets.stake <= 0 || players.length < 2) return { bets, nets, notes, pot: 0 };

  const partOf = new Map();
  for (const part of standings.participants) for (const id of part.memberIds) partOf.set(id, part);
  const ok = players.filter(p => partOf.has(p.id));
  const stake = toCents(bets.stake);
  const step = Math.round(bets.step * 100);

  if (bets.mode === "pot") {
    const pot = stake * ok.length;
    const pctSum = bets.split.reduce((a, b) => a + b, 0) || 100;
    const groups = groupSlots(ok, p => partOf.get(p.id).pos);
    for (const g of groups) {
      const pct = g.slots.reduce((a, s) => a + (bets.split[s - 1] || 0), 0);
      const prizeExact = (pot * pct) / pctSum;
      const each = allocate(Math.round(prizeExact), g.members.map(() => 1), 1);
      g.members.forEach((m, i) => { nets[m.id] += each[i]; });
    }
    ok.forEach(p => { nets[p.id] -= stake; });
    notes.push(`Pot: ${ok.length} players × RM${bets.stake.toFixed(2)} = RM${(pot / 100).toFixed(2)}`);
    // Fix any rounding drift so the pot nets to exactly zero.
    const drift = Object.values(nets).reduce((a, b) => a + b, 0);
    if (drift !== 0) {
      const top = groups[0]?.members[0];
      if (top) nets[top.id] -= drift;
    }
    return { bets, nets: roundNets(nets, step), notes, pot };
  }

  // per_point: every pair on different sides settles the gap at `stake` RM per point/stroke/hole.
  for (let i = 0; i < ok.length; i++) {
    for (let j = i + 1; j < ok.length; j++) {
      const a = partOf.get(ok[i].id), b = partOf.get(ok[j].id);
      if (a.key === b.key) continue;
      const av = isFinite(a.rankValue) ? a.rankValue : 0, bv = isFinite(b.rankValue) ? b.rankValue : 0;
      const diff = av - bv; // >0: a better
      const amt = Math.round(Math.abs(diff) * stake);
      if (diff > 0) { nets[ok[i].id] += amt; nets[ok[j].id] -= amt; }
      else if (diff < 0) { nets[ok[j].id] += amt; nets[ok[i].id] -= amt; }
    }
  }
  notes.push(`RM${bets.stake.toFixed(2)} per ${standings.spec.style === "strokes" ? "stroke" : standings.spec.style === "match" ? "hole" : "point"} of difference, paid to everyone you beat.`);
  return { bets, nets: roundNets(nets, step), notes, pot: 0 };
}

/** Meal split. Returns shares (sen) per player id. */
export function computeMeal(mealIn, standings, players) {
  const meal = normalizeMeal(mealIn);
  const shares = Object.fromEntries(players.map(p => [p.id, 0]));
  if (!meal.enabled || meal.total <= 0 || !players.length) return { meal, shares, total: 0 };

  const partOf = new Map();
  for (const part of standings.participants) for (const id of part.memberIds) partOf.set(id, part);
  const posOf = p => partOf.get(p.id)?.pos ?? 999;
  const groups = groupSlots(players, posOf);
  const lastPos = groups.length ? groups[groups.length - 1].pos : 1;
  const allTied = groups.length <= 1;

  let weights;
  if (meal.method === "equal" || allTied) {
    weights = players.map(() => 1);
  } else if (meal.method === "loser_pays") {
    weights = players.map(p => (posOf(p) === lastPos ? 1 : 0));
  } else if (meal.method === "winner_free") {
    weights = players.map(p => (posOf(p) === 1 ? 0 : 1));
  } else if (meal.method === "by_rank") {
    const wmap = new Map();
    for (const g of groups) {
      const w = g.slots.reduce((a, s) => a + (meal.pcts[s - 1] || 0), 0) / g.members.length;
      g.members.forEach(m => wmap.set(m.id, w));
    }
    weights = players.map(p => wmap.get(p.id) || 0);
  } else { // by_gap
    const best = Math.max(...players.map(p => { const v = partOf.get(p.id)?.rankValue; return isFinite(v) ? v : 0; }));
    weights = players.map(p => {
      const v = partOf.get(p.id)?.rankValue;
      return 1 + Math.max(0, best - (isFinite(v) ? v : 0));
    });
  }
  const step = Math.round(meal.step * 100);
  const out = allocate(toCents(meal.total), weights, step);
  players.forEach((p, i) => { shares[p.id] = out[i]; });
  return { meal, shares, total: toCents(meal.total) };
}

/** Fewest-payments settlement from net balances (sen). */
export function transfersFrom(nets, nameOf) {
  const cred = [], debt = [];
  for (const [id, v] of Object.entries(nets)) {
    if (v > 0) cred.push({ id, v }); else if (v < 0) debt.push({ id, v: -v });
  }
  cred.sort((a, b) => b.v - a.v); debt.sort((a, b) => b.v - a.v);
  const out = [];
  let i = 0, j = 0;
  while (i < cred.length && j < debt.length) {
    const amt = Math.min(cred[i].v, debt[j].v);
    if (amt > 0) out.push({ from: Number(debt[j].id), to: Number(cred[i].id), fromName: nameOf(debt[j].id), toName: nameOf(cred[i].id), cents: amt });
    cred[i].v -= amt; debt[j].v -= amt;
    if (cred[i].v === 0) i++;
    if (debt[j].v === 0) j++;
  }
  return out;
}

export function computeSettlement({ bets, meal, standings, players }) {
  const b = computeBets(bets, standings, players);
  const m = computeMeal(meal, standings, players);
  const nets = { ...b.nets };
  const mealNets = Object.fromEntries(players.map(p => [p.id, 0]));
  const payer = m.meal.paidBy && players.some(p => p.id === m.meal.paidBy) ? m.meal.paidBy : null;
  if (m.meal.enabled && m.total > 0 && payer) {
    for (const p of players) mealNets[p.id] = -m.shares[p.id];
    mealNets[payer] += Object.values(m.shares).reduce((a, c) => a + c, 0);
    for (const p of players) nets[p.id] += mealNets[p.id];
  }
  const byId = Object.fromEntries(players.map(p => [p.id, p.name]));
  const transfers = transfersFrom(nets, id => byId[id]);
  return {
    betNets: b.nets,
    betNotes: b.notes,
    pot: b.pot,
    mealShares: m.shares,
    mealTotal: m.total,
    mealPaidBy: payer,
    nets,
    transfers,
    betsOn: b.bets.mode !== "none" && b.bets.stake > 0,
    mealOn: m.meal.enabled && m.total > 0,
  };
}
