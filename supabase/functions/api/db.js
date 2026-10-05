// Postgres access with a tiny mysql2-style surface: pool.query(sql, params) -> [rows], tx(fn).
// SQL uses ? placeholders; they are rewritten to $1, $2... here. Runs under Deno (npm:postgres)
// and Node (postgres) so the same code is testable locally.
import postgres from "postgres";

let _sql = null;
function getSql() {
  if (_sql) return _sql;
  const url = globalThis.Deno?.env?.get("SUPABASE_DB_URL") ?? globalThis.process?.env?.DATABASE_URL;
  if (!url) throw new Error("No database URL: set SUPABASE_DB_URL (Edge Function) or DATABASE_URL (local)");
  _sql = postgres(url, { max: 3, prepare: false, idle_timeout: 20, connect_timeout: 10, onnotice: () => {} });
  return _sql;
}

const toPg = text => { let i = 0; return text.replace(/\?/g, () => `$${++i}`); };

async function run(client, text, params = []) {
  try {
    const rows = await client.unsafe(toPg(text), params);
    return [Array.from(rows)];
  } catch (e) {
    if (e.code === "23505") e.code = "ER_DUP_ENTRY"; // unique violation, same name the route code already checks
    throw e;
  }
}

export const pool = { query: (text, params) => run(getSql(), text, params) };

export async function tx(fn) {
  return getSql().begin(t => fn({ query: (text, params) => run(t, text, params) }));
}
