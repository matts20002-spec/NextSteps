// Creates the single built-in admin account from ADMIN_EMAIL / ADMIN_PASSWORD
// environment variables. There is no public admin-registration endpoint --
// this is the only way an admin account gets created.
//
// Called directly from index.js on every startup (see the comment there for
// why), the same way schema.js's applySchema() is -- ECS runs the
// Dockerfile's CMD directly with no opportunity to chain a separate seeding
// script beforehand, so this can't be a step external to the app itself.
const bcrypt = require('bcryptjs');
const { pool } = require('./db');

const SALT_ROUNDS = 10;

async function seedAdmin() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.warn('ADMIN_EMAIL and ADMIN_PASSWORD are not set -- skipping admin account seeding.');
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);
  // Admin's username is just "admin" -- whoever seeds this only ever logs in
  // with the email/password from their own .env, so the username itself
  // isn't important.
  const adminUsername = 'admin';

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
}

module.exports = { seedAdmin };
