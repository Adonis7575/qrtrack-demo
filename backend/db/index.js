const fs = require('node:fs');
const path = require('node:path');

const SCHEMA = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

/**
 * Opens the database and applies the schema.
 *
 * - DATABASE_URL set   -> Postgres over `pg` (Neon in production).
 * - DATABASE_URL unset -> embedded PGlite (real Postgres in WASM) so local dev
 *                         needs no setup. `dataDir` of 'memory://' keeps it in RAM.
 *
 * Both expose the same tiny interface: query(text, params) -> { rows }, close().
 */
async function openDatabase({ url, dataDir } = {}) {
  const db = url ? openPostgres(url) : await openPglite(dataDir);
  await db.exec(SCHEMA);
  return db;
}

function openPostgres(url) {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: url,
    max: 5,
    idleTimeoutMillis: 30_000,
  });

  pool.on('error', (err) => console.error('[DB POOL]', err.message));

  return {
    kind: 'postgres',
    query: (text, params) => pool.query(text, params),
    exec: (sql) => pool.query(sql),
    close: () => pool.end(),
  };
}

async function openPglite(dataDir = path.join(__dirname, '..', '.data')) {
  const { PGlite } = require('@electric-sql/pglite');
  const pg = await PGlite.create(dataDir);

  return {
    kind: 'pglite',
    query: (text, params) => pg.query(text, params),
    exec: (sql) => pg.exec(sql),
    close: () => pg.close(),
  };
}

module.exports = { openDatabase };
