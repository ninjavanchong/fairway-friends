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
