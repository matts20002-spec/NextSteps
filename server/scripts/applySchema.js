// Standalone entry point for applying schema.sql / seed_jobs.sql on demand,
// without waiting on the full server to boot.
//
// index.js also calls applySchema() itself on every startup, so running
// this script is not required for correctness -- it exists purely as a
// manual safety net. That second application is a no-op against an
// already-initialized database (see schema.js).
require('dotenv').config();

const { applySchema } = require('../src/schema');
const { pool } = require('../src/db');

applySchema()
  .catch((err) => {
    console.error('Failed to apply schema:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
