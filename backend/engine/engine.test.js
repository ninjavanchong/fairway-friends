import test from "node:test";
import assert from "node:assert/strict";
import { computeStandings, strokesOnHole, pointsForDiff, validateSetup, normalizeGame } from "./games.js";
import { computeSettlement, computeMeal, allocate, transfersFrom } from "./settle.js";

const pars18 = Array(18).fill(4);
const pars9 = Array(9).fill(4);
const mk = (id, name, handicap = 0, team = null) => ({ id, name, handicap, team });
const sc = arr => Object.fromEntries(arr.map((s, i) => [i + 1, s]));

test("handicap strokes are handed out from hole 1", () => {
  assert.equal(strokesOnHole(20, 1, 18), 2);
  assert.equal(strokesOnHole(20, 3, 18), 1);
  assert.equal(strokesOnHole(10, 10, 18), 1);
  assert.equal(strokesOnHole(10, 11, 18), 0);
  assert.equal(strokesOnHole(0, 1, 18), 0);
});

test("stableford point table", () => {
  assert.equal(pointsForDiff(-1), 3);
  assert.equal(pointsForDiff(0), 2);
  assert.equal(pointsForDiff(1), 1);
  assert.equal(pointsForDiff(2), 0);
  assert.equal(pointsForDiff(-2), 4);
});

test("stroke play: net = gross - handicap", () => {
  const players = [mk(1, "Aisha", 12), mk(2, "Ben", 4)];
  const scores = { 1: sc(Array(18).fill(5)), 2: sc([...Array(9).fill(4), ...Array(9).fill(5)]) };
  const r = computeStandings({ game: { type: "stroke" }, holes: 18, pars: pars18, players, scores });
  const a = r.participants.find(p => p.name === "Aisha"), b = r.participants.find(p => p.name === "Ben");
  assert.equal(a.total, 78); assert.equal(a.gross, 90); assert.equal(a.toPar, 6);
  assert.equal(b.total, 77); assert.equal(b.toPar, 5);
  assert.equal(r.participants[0].name, "Ben");
  assert.equal(r.complete, true);
});

test("stroke play ties share a position", () => {
  const players = [mk(1, "A"), mk(2, "B"), mk(3, "C")];
  const scores = { 1: sc(Array(9).fill(4)), 2: sc(Array(9).fill(4)), 3: sc(Array(9).fill(5)) };
  const r = computeStandings({ game: { type: "stroke" }, holes: 9, pars: pars9, players, scores });
  assert.deepEqual(r.participants.map(p => p.pos), [1, 1, 3]);
});

test("stableford with a handicap shot on hole 1", () => {
  const players = [mk(1, "A", 1)];
  // hole1: 5 -> net 4 = par = 2pts; hole2: 5 bogey=1; hole3: 3 birdie=3; hole4: 7 double+=0
  const r = computeStandings({ game: { type: "stableford" }, holes: 18, pars: pars18, players, scores: { 1: sc([5, 5, 3, 7]) } });
  assert.equal(r.participants[0].total, 6);
  assert.equal(r.participants[0].thru, 4);
});

test("match play closes out early (10&8)", () => {
  const players = [mk(1, "A"), mk(2, "B")];
  const scores = { 1: sc(Array(10).fill(3)), 2: sc(Array(10).fill(4)) };
  const r = computeStandings({ game: { type: "match" }, holes: 18, pars: pars18, players, scores });
  assert.equal(r.match.finished, true);
  assert.match(r.match.label, /A wins 10&8/);
  assert.equal(r.participants[0].name, "A");
});

test("match play: all square and in-progress label", () => {
  const players = [mk(1, "A"), mk(2, "B")];
  const scores = { 1: sc([4, 3, 5]), 2: sc([4, 4, 4]) };
  const r = computeStandings({ game: { type: "match" }, holes: 18, pars: pars18, players, scores });
  assert.equal(r.match.up, 0); // halve, A wins, B wins
  assert.match(r.match.label, /All square thru 3/);
  assert.equal(r.complete, false);
});

test("team best ball counts the lower score on each hole", () => {
  const players = [mk(1, "P1", 0, "A"), mk(2, "P2", 0, "A"), mk(3, "P3", 0, "B"), mk(4, "P4", 0, "B")];
  const scores = { 1: sc(Array(9).fill(4)), 2: sc(Array(9).fill(6)), 3: sc(Array(9).fill(5)), 4: sc(Array(9).fill(5)) };
  const r = computeStandings({ game: { type: "bestball" }, holes: 9, pars: pars9, players, scores });
  assert.equal(r.participants[0].name, "Team A");
  assert.equal(r.participants[0].total, 36);
  assert.equal(r.participants[1].total, 45);
});

test("scramble: one team score, team handicap = average", () => {
  const players = [mk(1, "P1", 10, "A"), mk(2, "P2", 20, "A"), mk(3, "P3", 0, "B"), mk(4, "P4", 0, "B")];
  const scores = { 1: sc(Array(9).fill(4)), 2: sc(Array(9).fill(4)), 3: sc(Array(9).fill(4)), 4: sc(Array(9).fill(4)) };
  const r = computeStandings({ game: { type: "scramble" }, holes: 9, pars: pars9, players, scores });
  const a = r.participants.find(p => p.name === "Team A");
  assert.equal(a.gross, 36);
  assert.equal(a.total, 36 - 15); // team handicap 15 over 9 holes
  assert.equal(r.participants[0].name, "Team A");
});

test("custom game: hole wins with split ties", () => {
  const players = [mk(1, "A"), mk(2, "B")];
  const game = { type: "custom", style: "holewins", unit: "player", useHandicap: false, holeWinPoints: 2, tie: "split" };
  const scores = { 1: sc([3, 4, 5]), 2: sc([4, 4, 4]) };
  const r = computeStandings({ game, holes: 9, pars: pars9, players, scores });
  const a = r.participants.find(p => p.name === "A"), b = r.participants.find(p => p.name === "B");
  assert.equal(a.total, 3); // win (2) + half of tie (1)
  assert.equal(b.total, 3);
});

test("custom game: front 9 only", () => {
  const players = [mk(1, "A"), mk(2, "B")];
  const game = { type: "custom", style: "strokes", scope: "front", useHandicap: false };
  const scores = { 1: sc(Array(18).fill(4)), 2: sc(Array(18).fill(5)) };
  const r = computeStandings({ game, holes: 18, pars: pars18, players, scores });
  assert.equal(r.scope.length, 9);
  assert.equal(r.participants[0].thru, 9);
});

test("validation", () => {
  assert.ok(validateSetup({ type: "match" }, [mk(1, "A"), mk(2, "B"), mk(3, "C")]).length);
  assert.equal(validateSetup({ type: "match" }, [mk(1, "A"), mk(2, "B")]).length, 0);
  assert.ok(validateSetup({ type: "bestball" }, [mk(1, "A"), mk(2, "B")]).length);
  assert.equal(normalizeGame({ type: "scramble" }).teamCount, "single");
});

// ---------- money ----------
function pots(posList, bets, meal) {
  const players = posList.map((_, i) => mk(i + 1, `P${i + 1}`));
  const standings = {
    spec: { style: "strokes" },
    participants: posList.map((pos, i) => ({ key: `p:${i + 1}`, memberIds: [i + 1], pos, rankValue: -pos })),
  };
  return computeSettlement({ bets, meal: meal || {}, standings, players });
}

test("pot split 60/30/10", () => {
  const r = pots([1, 2, 3, 4], { mode: "pot", stake: 10, split: [60, 30, 10] });
  assert.deepEqual(r.betNets, { 1: 1400, 2: 200, 3: -600, 4: -1000 });
  assert.equal(Object.values(r.betNets).reduce((a, b) => a + b, 0), 0);
  assert.equal(r.transfers.reduce((a, t) => a + t.cents, 0), 1600);
});

test("pot tie for first splits the prize slots", () => {
  const r = pots([1, 1, 3], { mode: "pot", stake: 10, split: [60, 30, 10] });
  // pot 30; slots 1+2 = 90% of 30 = 27 -> 13.50 each; 3rd gets 10% = 3
  assert.deepEqual(r.betNets, { 1: 350, 2: 350, 3: -700 });
});

test("head to head tie returns stakes", () => {
  const r = pots([1, 1], { mode: "pot", stake: 20, split: [100] });
  assert.deepEqual(r.betNets, { 1: 0, 2: 0 });
});

test("per point pays the gap to everyone you beat", () => {
  // P1 -1, P2 -4 (rankValue = -pos in the helper): P1 beats P2 by 3 units
  const players = [mk(1, "A"), mk(2, "B")];
  const standings = { spec: { style: "strokes" }, participants: [
    { key: "p:1", memberIds: [1], pos: 1, rankValue: -2 },
    { key: "p:2", memberIds: [2], pos: 2, rankValue: -5 },
  ] };
  const r = computeSettlement({ bets: { mode: "per_point", stake: 2 }, meal: {}, standings, players });
  assert.deepEqual(r.betNets, { 1: 600, 2: -600 });
  assert.equal(r.transfers[0].cents, 600);
  assert.equal(r.transfers[0].fromName, "B");
});

test("meal by rank percentages", () => {
  const players = [1, 2, 3, 4].map(i => mk(i, `P${i}`));
  const standings = { participants: [1, 2, 3, 4].map(i => ({ key: `p:${i}`, memberIds: [i], pos: i, rankValue: -i })) };
  const m = computeMeal({ enabled: true, total: 100, method: "by_rank", pcts: [0, 10, 30, 60] }, standings, players);
  assert.deepEqual(m.shares, { 1: 0, 2: 1000, 3: 3000, 4: 6000 });
});

test("meal equal split keeps the exact total", () => {
  const players = [1, 2, 3].map(i => mk(i, `P${i}`));
  const standings = { participants: [1, 2, 3].map(i => ({ key: `p:${i}`, memberIds: [i], pos: i, rankValue: -i })) };
  const m = computeMeal({ enabled: true, total: 100, method: "equal", step: 0.1 }, standings, players);
  assert.equal(Object.values(m.shares).reduce((a, b) => a + b, 0), 10000);
  assert.ok(Object.values(m.shares).every(v => v === 3330 || v === 3340));
});

test("meal: loser pays all; tie for last splits it", () => {
  const players = [1, 2, 3].map(i => mk(i, `P${i}`));
  const standings = { participants: [
    { key: "p:1", memberIds: [1], pos: 1, rankValue: 0 },
    { key: "p:2", memberIds: [2], pos: 2, rankValue: -3 },
    { key: "p:3", memberIds: [3], pos: 2, rankValue: -3 },
  ] };
  const m = computeMeal({ enabled: true, total: 60, method: "loser_pays" }, standings, players);
  assert.deepEqual(m.shares, { 1: 0, 2: 3000, 3: 3000 });
});

test("combined settlement: meal payer is repaid, bets net together", () => {
  const players = [1, 2].map(i => mk(i, `P${i}`));
  const standings = { spec: { style: "strokes" }, participants: [
    { key: "p:1", memberIds: [1], pos: 1, rankValue: -1 },
    { key: "p:2", memberIds: [2], pos: 2, rankValue: -3 },
  ] };
  const r = computeSettlement({
    bets: { mode: "per_point", stake: 5 },
    meal: { enabled: true, total: 40, method: "equal", paidBy: 1 },
    standings, players,
  });
  // bets: P2 owes P1 RM10. meal: P2 owes P1 RM20 (half of RM40). total RM30.
  assert.equal(r.nets[1], 3000); assert.equal(r.nets[2], -3000);
  assert.equal(r.transfers.length, 1);
});

test("allocate and transfers helpers", () => {
  assert.deepEqual(allocate(1000, [1, 1, 1, 1], 10), [250, 250, 250, 250]);
  const t = transfersFrom({ 1: 500, 2: 500, 3: -300, 4: -700 }, id => `P${id}`);
  assert.equal(t.reduce((a, x) => a + x.cents, 0), 1000);
  assert.ok(t.length <= 3);
});

test("match play with fewer than two sides does not crash (lobby)", () => {
  const r = computeStandings({ game: { type: "match" }, holes: 18, pars: pars18, players: [mk(1, "Host")], scores: {} });
  assert.equal(r.match.finished, false);
  assert.match(r.match.label, /Waiting/);
  const r2 = computeStandings({ game: { type: "match" }, holes: 18, pars: pars18, players: [mk(1, "A", 0, "A"), mk(2, "B", 0, "A")], scores: {} });
  assert.equal(r2.complete, false);
});

test("team games with no teams yet do not crash", () => {
  for (const type of ["bestball", "scramble"]) {
    const r = computeStandings({ game: { type }, holes: 9, pars: pars9, players: [mk(1, "A"), mk(2, "B")], scores: {} });
    assert.equal(r.participants.length, 0);
  }
});
