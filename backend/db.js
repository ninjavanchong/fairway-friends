// OceanBase (MySQL-wire) connection pool + transaction helper.
// DATABASE_URL is injected by the Substrait platform: mysql://user:pass@host:2881/db
import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL || "mysql://root:root@localhost:3306/app";

let _pool = null;
let _initError = null;

function parseDbUrl(raw) {
  const u = new URL(raw.replace(/^jdbc:/, ""));
  return {
    host: u.hostname,
    port: Number(u.port) || 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ""),
  };
}

function getPool() {
  if (_initError) throw _initError;
  if (_pool) return _pool;
  try {
    _pool = mysql.createPool({
      ...parseDbUrl(url),
      connectionLimit: 20,
      waitForConnections: true,
      queueLimit: 1000,
      connectTimeout: 10_000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 30_000,
      timezone: "Z",
      decimalNumbers: true,
    });
    // OceanBase session runs in local time (+08); force UTC per-connection so
    // server-generated timestamps (CURRENT_TIMESTAMP defaults) read back correctly.
    _pool.on("connection", conn => conn.query("SET time_zone = '+00:00'"));
    return _pool;
  } catch (e) {
    _initError = new Error(`Database pool init failed: ${e.message}`);
    throw _initError;
  }
}

export const pool = {
  query: (...args) => getPool().query(...args),
  getConnection: () => getPool().getConnection(),
};

export async function tx(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (e) {
    try { await conn.rollback(); } catch { /* connection may be gone */ }
    throw e;
  } finally {
    conn.release();
  }
}

// mysql2 returns TINYINT(1) as 0/1, not real booleans.
export function boolify(row, cols) {
  if (!row) return row;
  for (const col of cols) {
    if (row[col] !== null && row[col] !== undefined) row[col] = !!row[col];
  }
  return row;
}
