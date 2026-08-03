// Applicant-facing application endpoints: get a presigned URL to upload a
// résumé straight to S3, apply to a job with the resulting key, and view
// your own applications and their status.
//
// The résumé file itself never passes through this server (or CloudFront's
// API origin, which rejects large proxied POST bodies) -- see /presign
// below and client/src/pages/JobDetail.jsx for the upload flow.
const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { getResumeUploadUrl } = require('../utils/s3');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
];

// POST /api/applications/presign -- a logged-in applicant requests a
// presigned S3 PUT URL for their résumé. The browser uploads directly to
// the returned URL, then calls POST / below with the returned key.
router.post('/presign', requireAuth, asyncHandler(async (req, res) => {
  const { filename, contentType } = req.body;

  if (!filename) {
    return res.status(400).json({ error: 'filename is required' });
  }
  if (contentType && !ALLOWED_MIME_TYPES.includes(contentType)) {
    return res.status(400).json({ error: 'Only PDF or DOCX résumés are allowed' });
  }

  const { url, key } = await getResumeUploadUrl(req.user.id, filename, contentType);
  res.json({ url, key });
}));

// POST /api/applications -- a logged-in applicant applies to a job.
// Expects a JSON body: { jobId, resumeS3Key }, where resumeS3Key is the
// key returned by /presign once the résumé has been uploaded to S3.
router.post('/', requireAuth, asyncHandler(async (req, res) => {
  const { jobId, resumeS3Key } = req.body;
  const userId = req.user.id;

  if (!jobId || !resumeS3Key) {
    return res.status(400).json({ error: 'jobId and resumeS3Key are required' });
  }

  const jobResult = await pool.query('SELECT id FROM jobs WHERE id = $1', [jobId]);
  if (jobResult.rows.length === 0) {
    return res.status(404).json({ error: 'Job not found' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO applications (user_id, job_id, resume_s3_key, status)
       VALUES ($1, $2, $3, 'submitted')
       RETURNING id, job_id, status, created_at`,
      [userId, jobId, resumeS3Key]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    // Postgres unique_violation -- the (user_id, job_id) UNIQUE constraint
    // means this applicant already applied to this job.
    if (err.code === '23505') {
      return res.status(409).json({ error: 'You have already applied to this job' });
    }
    throw err;
  }
}));

// GET /api/applications/me -- the logged-in applicant's own applications,
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
