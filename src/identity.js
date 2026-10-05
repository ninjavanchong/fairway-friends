// Who am I in each round? Stored in this browser only. No accounts.
const safe = fn => { try { return fn(); } catch { return null; } };

export const getMe = code => safe(() => JSON.parse(localStorage.getItem(`ff:me:${code}`)));
export const setMe = (code, me) => safe(() => localStorage.setItem(`ff:me:${code}`, JSON.stringify(me)));
export const getName = () => safe(() => localStorage.getItem("ff:name")) || "";
export const setName = n => safe(() => localStorage.setItem("ff:name", n));

export function getRecent() {
  return safe(() => JSON.parse(localStorage.getItem("ff:recent") || "[]")) || [];
}
export function addRecent(entry) {
  const list = getRecent().filter(r => r.code !== entry.code);
  list.unshift({ ...entry, at: Date.now() });
  safe(() => localStorage.setItem("ff:recent", JSON.stringify(list.slice(0, 12))));
}
