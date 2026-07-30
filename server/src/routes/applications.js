// Student-facing application endpoints: apply to a job (with résumé upload)
// and view your own applications and their status.
const express = require('express');
const multer = require('multer');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { uploadResume } = require('../utils/s3');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

// Keep uploads in memory (not on disk) since we immediately stream them to
// S3 -- this is a small teaching app so we don't need a temp-file step.
// 5MB is plenty for a résumé PDF/DOCX.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    ];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Only PDF or DOCX résumés are allowed'));
    }
    cb(null, true);
  },
});

// POST /api/applications -- a logged-in student applies to a job.
// Expects multipart/form-data with fields: jobId, resume (file).
router.post('/', requireAuth, upload.single('resume'), async (req, res) => {
  const { jobId } = req.body;
  const userId = req.user.id;

  if (!jobId || !req.file) {
    return res.status(400).json({ error: 'jobId and a resume file are required' });
  }

  try {
    const jobResult = await pool.query('SELECT id FROM jobs WHERE id = $1', [jobId]);
    if (jobResult.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const resumeKey = await uploadResume(userId, req.file.originalname, req.file.buffer, req.file.mimetype);

    const result = await pool.query(
      `INSERT INTO applications (user_id, job_id, resume_s3_key, status)
       VALUES ($1, $2, $3, 'submitted')
       RETURNING id, job_id, status, created_at`,
      [userId, jobId, resumeKey]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    // Postgres unique_violation -- the (user_id, job_id) UNIQUE constraint
    // means this student already applied to this job.
    if (err.code === '23505') {
      return res.status(409).json({ error: 'You have already applied to this job' });
    }
    console.error('Apply error:', err);
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

// GET /api/applications/me -- the logged-in student's own applications,
// joined with job info so the UI can show the job title/location alongside status.
router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT
       applications.id,
       applications.status,
       applications.created_at,
       applications.updated_at,
       jobs.id AS job_id,
       jobs.title AS job_title,
       jobs.location AS job_location
     FROM applications
     JOIN jobs ON jobs.id = applications.job_id
     WHERE applications.user_id = $1
     ORDER BY applications.created_at DESC`,
    [req.user.id]
  );
  res.json(result.rows);
}));

module.exports = router;
