// Registration and login for applicants. There is no email verification
// step and no password reset flow -- both are MVP scope cuts, deferred
// until after initial launch so we could get hiring started faster.
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const router = express.Router();

const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = '7d';

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, isAdmin: user.is_admin },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

// POST /api/auth/register
// Creates a brand-new applicant account. Accounts are active immediately --
// there is no email verification step and no way for an applicant to sign
// up as an admin (the admin account only comes from the seed script).
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'username, email, and password are required' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, is_admin)
       VALUES ($1, $2, $3, FALSE)
       RETURNING id, username, email, is_admin`,
      [username, email, passwordHash]
    );

    const user = result.rows[0];
    const token = signToken(user);
    res.status(201).json({ token, user: { id: user.id, username: user.username, email: user.email, isAdmin: user.is_admin } });
  } catch (err) {
    // Postgres unique_violation -- username or email already taken.
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username or email is already registered' });
    }
    console.error('Register error:', err);
    res.status(500).json({ error: 'Failed to register' });
  }
});

// POST /api/auth/login
// Accepts either a username or an email in `identifier`, plus `password`.
router.post('/login', async (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ error: 'identifier and password are required' });
  }

  try {
    const result = await pool.query(
      `SELECT id, username, email, password_hash, is_admin
       FROM users
       WHERE username = $1 OR email = $1`,
      [identifier]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken(user);
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, isAdmin: user.is_admin } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Failed to log in' });
  }
});

module.exports = router;
