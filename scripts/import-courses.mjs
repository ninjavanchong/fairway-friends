// One-off importer: builds backend/seed/courses.json (West Malaysia only) from
// golfingrecord.com's public scorecard pages (robots.txt allows /golf-scorecard).
// Only static facts are kept: course name, state, number of holes and par per
// hole. Imported courses are flagged verified:false and are editable in the app.
//
//   node scripts/import-courses.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../backend/seed/courses.json");
const BASE = "https://www.golfingrecord.com";
const STATES = ["Kuala Lumpur", "Selangor", "Negeri Sembilan", "Pahang", "Penang", "Johor"];
const sleep = ms => new Promise(r => setTimeout(r, ms));

const decode = s => s.replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").trim();

async function get(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "FairwayFriends-importer/1.0 (course par data for a personal scoring app)" } });
      if (r.ok) return await r.text();
    } catch { /* retry */ }
    await sleep(1500);
  }
  return null;
}

function displayName(anchor) {
  const parts = anchor.split(/\s+—\s+/);
  if (parts.length < 2) return anchor;
  const [course, club] = parts;
  if (club.toLowerCase().includes(course.toLowerCase())) return club;
  return `${club} (${course})`;
}

const seen = new Map();
for (const state of STATES) {
  const html = await get(`${BASE}/golf-scorecard/country/MY?state=${encodeURIComponent(state)}`);
  if (!html) { console.log("failed state", state); continue; }
  const links = [...html.matchAll(/<a href="(\/golf-scorecard\/[0-9a-f-]{36})">([^<]*)<\/a>/g)];
  const uniq = new Map(links.map(m => [m[1], decode(m[2])]));
  console.log(state, uniq.size, "links");
  for (const [href, text] of uniq) {
    if (seen.has(href)) continue;
    await sleep(350);
    const page = await get(BASE + href);
    if (!page) { console.log("  skip (fetch)", text); continue; }
    const rows = [...page.matchAll(/<tr><td>(\d+)<\/td><td>(\d+)<\/td>/g)];
    const first = rows.findIndex(r => r[1] === "1");
    const holes = [];
    for (let i = first; i >= 0 && i < rows.length; i++) {
      if (Number(rows[i][1]) !== holes.length + 1) break; // stop at the end of the first tee's table
      holes.push({ par: Number(rows[i][2]) });
    }
    if (![9, 18].includes(holes.length) || holes.some(h => h.par < 3 || h.par > 6)) { console.log("  skip (no full scorecard)", text); continue; }
    seen.set(href, { name: displayName(text), state, source: "golfingrecord.com", verified: false, holes });
  }
}

const list = [...seen.values()].sort((a, b) => a.state.localeCompare(b.state) || a.name.localeCompare(b.name));
const names = new Set();
const out = list.filter(c => (names.has(c.name.toLowerCase()) ? false : names.add(c.name.toLowerCase())));
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log("wrote", out.length, "courses to", OUT);
