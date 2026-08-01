-- Database schema for NextStep.
--
-- This is intentionally plain SQL (no ORM) so anyone working on this can
-- see exactly what tables and constraints exist. The backend applies this
-- file itself on every startup (see server/src/schema.js), against any
-- PostgreSQL target -- local or RDS -- so there's no manual step. Every
-- statement here must stay guarded with IF NOT EXISTS (or equivalent)
-- since it now runs on every container start, not just once.

-- Applicants (and the one admin) all live in a single users table.
-- is_admin distinguishes the single built-in admin account, which the
-- backend creates itself on startup (see server/src/seedAdmin.js) --
-- there is no public "become an admin" endpoint.
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(50) UNIQUE NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Job postings created and managed by the admin.
CREATE TABLE IF NOT EXISTS jobs (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  location    VARCHAR(200) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- An applicant's application to a job. resume_s3_key points at the
-- PDF/DOCX file the applicant uploaded to S3 (we only store the key, not
-- the file itself, in the database).
--
-- status is intentionally a simple 3-value flow for the MVP:
--   submitted  -> the default the moment an applicant applies
--   interview  -> set only when the admin clicks "Send Interview Invitation"
--   rejected   -> set only when the admin clicks "Send Rejection"
-- CREATE TYPE has no "IF NOT EXISTS" option, so guard it manually to keep
-- this script safe to re-run against the same database.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'application_status') THEN
    CREATE TYPE application_status AS ENUM ('submitted', 'interview', 'rejected');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS applications (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id         INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  resume_s3_key  TEXT NOT NULL,
  status         application_status NOT NULL DEFAULT 'submitted',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- an applicant can only apply once per job
  UNIQUE (user_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_applications_job_id ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
