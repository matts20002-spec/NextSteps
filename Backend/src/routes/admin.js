// Admin-only endpoints for reviewing applicants and moving them through the
// hiring flow. Every route here requires both requireAuth and requireAdmin.
//
// Status changes are deliberately NOT a free-form "set status" endpoint --
// the only two application_status can move to are triggered as a
// side-effect of sending an email ("Interview" and "Rejected" are set only
// by clicking the matching email-send button). A richer status workflow is
// MVP-scope out for now.
const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { getResumeDownloadUrl } = require('../utils/s3');
const { sendInterviewInvitation, sendRejection } = require('../utils/email');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.use(requireAuth, requireAdmin);

// GET /api/admin/jobs/:jobId/applicants -- everyone who applied to a job,
// with enough applicant info for the admin to review and take action.
router.get('/jobs/:jobId/applicants', asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT
       applications.id,
       applications.status,
       applications.resume_s3_key,
       applications.created_at,
       users.id AS user_id,
       users.username,
       users.email
     FROM applications
     JOIN users ON users.id = applications.user_id
     WHERE applications.job_id = $1
     ORDER BY applications.created_at ASC`,
    [req.params.jobId]
  );
  res.json(result.rows);
}));

// GET /api/admin/applications/:id/resume -- a short-lived S3 presigned URL
// the admin's browser can use to download the résumé directly from S3.
router.get('/applications/:id/resume', asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT resume_s3_key FROM applications WHERE id = $1', [req.params.id]);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Application not found' });
  }

  const url = await getResumeDownloadUrl(result.rows[0].resume_s3_key);
  res.json({ url });
}));

// Shared helper: looks up the applicant/job info an email template needs, and
// exists so the interview + rejection routes below don't repeat this join.
async function getApplicationEmailContext(applicationId) {
  const result = await pool.query(
    `SELECT
       applications.id,
       users.username,
       users.email,
       jobs.title AS job_title
     FROM applications
     JOIN users ON users.id = applications.user_id
     JOIN jobs ON jobs.id = applications.job_id
     WHERE applications.id = $1`,
    [applicationId]
  );
  return result.rows[0];
}

// POST /api/admin/applications/:id/send-interview
// Sends the interview invitation email, then marks the application's
// status as 'interview'. Email is sent first: if SES fails, we don't want
// the status to silently change without the applicant actually being
// notified.
router.post('/applications/:id/send-interview', asyncHandler(async (req, res) => {
  const context = await getApplicationEmailContext(req.params.id);
  if (!context) {
    return res.status(404).json({ error: 'Application not found' });
  }

  try {
    await sendInterviewInvitation({ toEmail: context.email, studentName: context.username, jobTitle: context.job_title });
  } catch (err) {
    console.error('SES send-interview error:', err);
    return res.status(502).json({ error: 'Failed to send interview email' });
  }

  const result = await pool.query(
    `UPDATE applications SET status = 'interview', updated_at = NOW() WHERE id = $1 RETURNING id, status`,
    [req.params.id]
  );
  res.json(result.rows[0]);
}));

// POST /api/admin/applications/:id/send-rejection
// Sends the rejection email, then marks the application's status as
// 'rejected'.
router.post('/applications/:id/send-rejection', asyncHandler(async (req, res) => {
  const context = await getApplicationEmailContext(req.params.id);
  if (!context) {
    return res.status(404).json({ error: 'Application not found' });
  }

  try {
    await sendRejection({ toEmail: context.email, studentName: context.username, jobTitle: context.job_title });
  } catch (err) {
    console.error('SES send-rejection error:', err);
    return res.status(502).json({ error: 'Failed to send rejection email' });
  }

  const result = await pool.query(
    `UPDATE applications SET status = 'rejected', updated_at = NOW() WHERE id = $1 RETURNING id, status`,
    [req.params.id]
  );
  res.json(result.rows[0]);
}));

module.exports = router;
