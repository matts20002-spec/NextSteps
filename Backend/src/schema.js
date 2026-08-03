// Applies server/sql/schema.sql (and, only on an empty jobs table,
// server/sql/seed_jobs.sql) against the shared pool. This is what makes a
// fresh RDS database work: locally, Postgres's docker-entrypoint-initdb.d
// mechanism applies these same files on first container start, but RDS has
// no equivalent, so the application applies them itself, every startup,
// against whichever database it's pointed at.
//
// schema.sql is written entirely with IF NOT EXISTS guards, so re-running
// it against an already-initialized database (including one initialized
// locally via docker-entrypoint-initdb.d) is a no-op. seed_jobs.sql has no
// such guard -- it's only ever meant to run once -- so it's only executed
// when the jobs table is empty, to avoid inserting duplicate rows on every
// restart.
const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

const SCHEMA_PATH = path.join(__dirname, '../sql/schema.sql');
const SEED_JOBS_PATH = path.join(__dirname, '../sql/seed_jobs.sql');

async function applySchema() {
  const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
  await pool.query(schemaSql);

  const { rows } = await pool.query('SELECT COUNT(*) FROM jobs');
  if (Number(rows[0].count) === 0) {
    const seedJobsSql = fs.readFileSync(SEED_JOBS_PATH, 'utf8');
    await pool.query(seedJobsSql);
  }
}

module.exports = { applySchema };
