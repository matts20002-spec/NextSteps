// Job posting endpoints.
//
// Listing/viewing jobs is public (no login required) so applicants can
// browse openings before creating an account. Creating/editing/deleting a
// job is restricted to the admin account.
const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

// GET /api/jobs -- public list of all job postings, newest first.
router.get('/', asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT id, title, description, location, created_at, updated_at
     FROM jobs
     ORDER BY created_at DESC`
  );
  res.json(result.rows);
}));

// GET /api/jobs/:id -- public single job posting.
router.get('/:id', asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT id, title, description, location, created_at, updated_at
     FROM jobs
     WHERE id = $1`,
    [req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json(result.rows[0]);
}));

// POST /api/jobs -- admin only, create a new job posting.
router.post('/', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { title, description, location } = req.body;

  if (!title || !description || !location) {
    return res.status(400).json({ error: 'title, description, and location are required' });
  }

  const result = await pool.query(
    `INSERT INTO jobs (title, description, location)
     VALUES ($1, $2, $3)
     RETURNING id, title, description, location, created_at, updated_at`,
    [title, description, location]
  );
  res.status(201).json(result.rows[0]);
}));

// PUT /api/jobs/:id -- admin only, edit an existing job posting.
router.put('/:id', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { title, description, location } = req.body;

  if (!title || !description || !location) {
    return res.status(400).json({ error: 'title, description, and location are required' });
  }

  const result = await pool.query(
    `UPDATE jobs
     SET title = $1, description = $2, location = $3, updated_at = NOW()
     WHERE id = $4
     RETURNING id, title, description, location, created_at, updated_at`,
    [title, description, location, req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json(result.rows[0]);
}));

// DELETE /api/jobs/:id -- admin only, delete a job posting.
// Deleting a job also deletes its applications (see ON DELETE CASCADE in schema.sql).
router.delete('/:id', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const result = await pool.query(`DELETE FROM jobs WHERE id = $1 RETURNING id`, [req.params.id]);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.status(204).send();
}));

module.exports = router;
