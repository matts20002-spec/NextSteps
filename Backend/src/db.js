// A single shared PostgreSQL connection pool, used by every route.
//
// We use the plain `pg` library (not an ORM) on purpose: this is an MVP
// built to move fast, and reading SQL directly in each route file is
// simpler than introducing an ORM's query syntax on top of it.
const { Pool } = require('pg');

// Discrete connection params instead of a single DATABASE_URL: the RDS
// Secrets Manager secret exposes host/user/password as separate fields
// (not a pre-built URL), and the database name is a separate plain value
// outside that secret entirely. Building a connection string from those
// pieces isn't possible with plain environment variable references at the
// ECS task definition level, so the app takes the pieces directly instead.
//
// DB_SSL enables TLS for RDS (off by default so local Postgres in Docker
// Compose, which doesn't speak TLS, keeps working unchanged).
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  // Errors on idle clients (e.g. a dropped connection) shouldn't crash
  // the whole server -- just log them.
  console.error('Unexpected error on idle database client', err);
});

module.exports = { pool };
