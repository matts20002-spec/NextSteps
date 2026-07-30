// A single shared PostgreSQL connection pool, used by every route.
//
// We use the plain `pg` library (not an ORM) on purpose: this app is a
// teaching tool, and students should be able to read the SQL directly in
// each route file instead of learning an ORM's query syntax on top of it.
const { Pool } = require('pg');

// `pg` understands a single DATABASE_URL connection string
// (e.g. postgres://user:pass@host:5432/dbname), which is the simplest
// thing to inject as one secret from AWS Secrets Manager in production.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  // Errors on idle clients (e.g. a dropped connection) shouldn't crash
  // the whole server -- just log them.
  console.error('Unexpected error on idle database client', err);
});

module.exports = { pool };
