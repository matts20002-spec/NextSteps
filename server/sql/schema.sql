-- Database schema for the Student Job Application Portal.
--
-- This is intentionally plain SQL (no ORM) so students can see exactly
-- what tables and constraints exist. Run this once against a fresh
-- PostgreSQL database before starting the server (see README).

-- Students (and the one admin) all live in a single users table.
-- is_admin distinguishes the single built-in admin account, which is
-- created only by the seed script (scripts/seedAdmin.js) -- there is
-- no public "become an admin" endpoint.
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

-- A student's application to a job. resume_s3_key points at the PDF/DOCX
-- file the student uploaded to S3 (we only store the key, not the file
-- itself, in the database).
--
-- status is intentionally a simple 3-value flow for this teaching app:
--   submitted  -> the default the moment a student applies
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
  -- a student can only apply once per job
  UNIQUE (user_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_applications_job_id ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
