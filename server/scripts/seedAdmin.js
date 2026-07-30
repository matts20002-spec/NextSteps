// Creates the single built-in admin account from ADMIN_EMAIL / ADMIN_PASSWORD
// environment variables. There is no public admin-registration endpoint --
// this script is the only way an admin account gets created.
//
// Usage: npm run seed:admin   (run once after the schema has been applied)
require('dotenv').config();

const bcrypt = require('bcryptjs');
const { pool } = require('../src/db');

const SALT_ROUNDS = 10;

async function seedAdmin() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in the environment to seed the admin account.');
    process.exitCode = 1;
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);
  // Admin's username is just "admin" -- students only ever log in with the
  // email/password from their own .env, so the username itself isn't important.
  const adminUsername = 'admin';

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [ADMIN_EMAIL]);

    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE users SET password_hash = $1, is_admin = TRUE WHERE email = $2`,
        [passwordHash, ADMIN_EMAIL]
      );
      console.log(`Admin account already existed for ${ADMIN_EMAIL} -- password updated.`);
    } else {
      await pool.query(
        `INSERT INTO users (username, email, password_hash, is_admin)
         VALUES ($1, $2, $3, TRUE)`,
        [adminUsername, ADMIN_EMAIL, passwordHash]
      );
      console.log(`Admin account created for ${ADMIN_EMAIL}.`);
    }
  } finally {
    await pool.end();
  }
}

seedAdmin().catch((err) => {
  console.error('Failed to seed admin account:', err);
  process.exitCode = 1;
});
