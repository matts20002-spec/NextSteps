// Standalone entry point for re-running the admin-seed logic on demand
// (e.g. via a one-off ECS task), without restarting the whole service.
//
// index.js already calls seedAdmin() itself on every startup (see
// src/seedAdmin.js), so running this script is not required for
// correctness -- it exists purely as a manual safety net.
require('dotenv').config();

const { seedAdmin } = require('../src/seedAdmin');
const { pool } = require('../src/db');

seedAdmin()
  .catch((err) => {
    console.error('Failed to seed admin account:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
