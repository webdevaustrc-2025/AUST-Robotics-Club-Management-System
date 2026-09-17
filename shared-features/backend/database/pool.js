// shared-features/backend/database/pool.js
// Shared Neon PostgreSQL connection pool.
// Owner: Shared/Core
// Used by: Event Management, Administration
// Rule (AGENTS.md §27): modules must reuse this pool.
// Do not create competing DB connections inside modules.
//
// Public API (do not change casually — other modules depend on this):
//   query(text, params)  -> Promise<pg.QueryResult>
//   healthCheck()        -> Promise<boolean>
//   pool                 -> pg.Pool

import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example to .env and configure your Neon connection string.'
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Parameterized query helper. Always use this instead of string concatenation.
// Good:  query('SELECT * FROM evt_events WHERE event_id = $1', [id])
// Bad:   query(`SELECT * FROM evt_events WHERE event_id = ${id}`)
export async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  if (process.env.NODE_ENV !== 'production') {
    const ms = Date.now() - start;
    console.log('[db]', { ms, rows: result.rowCount, text });
  }
  return result;
}

// Simple health check. Confirms the DB is reachable.
export async function healthCheck() {
  const result = await query('SELECT 1 AS ok');
  return result.rows[0]?.ok === 1;
}

export default pool;