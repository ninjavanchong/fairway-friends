export const rm = cents => `RM ${(Math.abs(cents) / 100).toFixed(2).replace(/\.00$/, "")}`;
export const rmSigned = cents => (cents > 0 ? "+" : cents < 0 ? "−" : "") + rm(cents);

export function scoreName(strokes, par) {
  if (strokes == null) return "";
  const d = strokes - par;
  if (strokes === 1) return "Hole in one!";
  if (d <= -3) return "Albatross!";
  if (d === -2) return "Eagle!";
  if (d === -1) return "Birdie!";
  if (d === 0) return "Par";
  if (d === 1) return "Bogey";
  if (d === 2) return "Double bogey";
  return `+${d}`;
}
export const scoreClass = (strokes, par) => {
  if (strokes == null) return "";
  const d = strokes - par;
  return d <= -2 ? "eagle" : d === -1 ? "birdie" : d === 0 ? "par" : d === 1 ? "bogey" : "dbl";
};

export function timeAgo(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export const TEAM_KEYS = ["A", "B", "C", "D", "E", "F"];

// "-2", "E", "+3"
export const fmtToPar = n => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
export const toParClass = n => (n < 0 ? "under" : n > 0 ? "over" : "even");

// Metric shown in the last leaderboard column, and what it's called.
export function metricOf(round, p) {
  const s = round.standings, g = round.game;
  if (s.match) return { head: "MATCH", value: p.total > 0 ? `${p.total} UP` : p.total < 0 ? "–" : (s.match.played ? "AS" : "–") };
  if (g.style === "points") return { head: "POINTS", value: String(p.total) };
  if (g.style === "holewins") return { head: "HOLES", value: String(p.total) };
  return { head: g.useHandicap === false ? "GROSS" : "NET", value: p.thru ? String(p.total) : "–" };
}
export function toParOf(round, p) {
  if (!p.holesPlayed) return null;
  return round.game.useHandicap === false ? p.toParGross : p.toParNet;
}

// Public link a friend opens (or scans) to join. Works under a sub-path such as GitHub Pages.
export const joinUrl = code => `${location.origin}${import.meta.env.BASE_URL}j/${code}`;

// Public link a friend opens (or scans) to join. Works under a sub-path such as GitHub Pages.
export const joinUrl = code => `${location.origin}${import.meta.env.BASE_URL}j/${code}`;

// Public link a friend opens (or scans) to join. Works under a sub-path such as GitHub Pages.
export const joinUrl = code => `${location.origin}${import.meta.env.BASE_URL}j/${code}`;
