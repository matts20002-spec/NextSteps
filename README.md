# Student Job Application Portal

A small, deliberately simple full-stack app used as a **teaching tool** in an
AWS cloud computing course. Students with little or no cloud background
build/deploy this app to learn how a typical web app maps onto AWS managed
services: CloudFront, S3, an Application Load Balancer, ECS Fargate, RDS,
SES, Secrets Manager, and KMS.

The code favors **clarity over cleverness** on purpose — plain SQL instead
of an ORM, a hand-rolled JWT auth layer instead of Cognito, hardcoded email
templates instead of a template engine. Students are expected to read this
code, not just run it.

## Project overview

Students can browse job postings, register an account, apply to a job with
a résumé upload, and track their application status. A single admin account
manages job postings, reviews applicants, downloads résumés, and moves an
applicant forward (interview) or rejects them — both of which trigger an
email via SES.

Application status is intentionally limited to three states, in this fixed
order:

```
Submitted → Interview → Rejected
```

`Submitted` is set automatically when a student applies. `Interview` and
`Rejected` are set **only** as a side effect of the admin clicking the
matching "send email" button — there's no separate status dropdown. This is
a simplification for teaching purposes; a real ATS would have more states
(e.g. "Under Review", "Offer", "Accepted") and a more flexible workflow.

## Architecture summary

This repo contains only the **application code and Dockerfile** — no AWS
infrastructure-as-code. In the course, students deploy it themselves onto:

```
Browser
  │
  ▼
CloudFront (CDN)
  │
  ├──► S3 (static React build: HTML/JS/CSS)
  │
  └──► Application Load Balancer
          │
          ▼
       ECS Fargate (this backend, containerized via server/Dockerfile)
          │
          ├──► RDS PostgreSQL (users, jobs, applications)
          ├──► S3 (résumé file storage)
          ├──► SES (interview / rejection emails)
          ├──► Secrets Manager (DATABASE_URL, JWT_SECRET, etc. injected as env vars)
          └──► KMS (encrypts the above secrets + RDS storage at rest)
```

- **Frontend**: a Vite-built React app. It's built to static files
  (`client/dist`) and uploaded to S3, then served through CloudFront —
  it does **not** run as a container in production.
- **Backend**: an Express API, containerized with `server/Dockerfile`,
  intended to run as an ECS Fargate task behind an ALB.
- **Auth**: fully custom — `bcryptjs` for password hashing, `jsonwebtoken`
  for stateless session tokens. No Cognito, no third-party auth provider.
- **AWS credentials**: the app never handles AWS access keys directly. It
  relies on the AWS SDK's default credential provider chain, which in
  production means the ECS task's IAM role, and locally means your AWS CLI
  profile / environment variables.

## Project layout

```
server/           Express + PostgreSQL backend (the API / ECS Fargate image)
  src/
    index.js       App entry point
    db.js          Shared pg connection pool
    routes/        auth.js, jobs.js, applications.js, admin.js
    middleware/    auth.js (JWT verification)
    utils/         s3.js (résumé upload/download), email.js (SES templates)
  scripts/
    seedAdmin.js   Creates/updates the one built-in admin account from env vars (safe to re-run)
  sql/
    schema.sql     Table definitions -- auto-applied locally via docker-compose.yml, see below
    seed_jobs.sql  A few sample job postings for local dev -- also auto-applied locally
  Dockerfile        Backend image for ECS Fargate

client/           React (Vite) frontend, built to static files for S3
  src/
    pages/          Student pages (job list, job detail, login, register, my applications)
    pages/admin/    Admin pages (job CRUD, applicant list + actions)
    api/client.js   Small fetch() wrapper
    auth/           React context holding the logged-in user + JWT
  Dockerfile        OPTIONAL — builds + previews the static bundle in nginx

docker-compose.yml  Local Postgres + backend, for development only
```

## Local setup

### Prerequisites

- Node.js 20+
- Docker (for running Postgres locally, and optionally the backend itself)
- An AWS account is **not** required just to run the app locally, *except*
  for the résumé-upload and email-sending features, which call real S3/SES
  APIs. To exercise those locally you'll need AWS credentials on your
  machine (e.g. `aws configure`, or `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`
  environment variables) with access to a real S3 bucket and a verified SES
  identity — see the SES sandbox notes below.

### Option A: full stack via Docker Compose (fastest)

```bash
cp .env.example .env   # project root -- fill in the values, see below
docker compose up --build
```

That's it. On a **fresh** setup this single command:

1. Starts Postgres and automatically runs `server/sql/schema.sql` and
   `server/sql/seed_jobs.sql` against it (Postgres's official image runs
   any `.sql` file mounted into `/docker-entrypoint-initdb.d/`, but only
   the first time it initializes an empty data directory — see the
   comments in `docker-compose.yml`).
2. Starts the backend, which seeds the admin account from `ADMIN_EMAIL` /
   `ADMIN_PASSWORD` every time it boots (safe to repeat — see
   `server/scripts/seedAdmin.js`), then starts the API on port 3000.

You'll have a couple of sample job postings and a working admin login
without touching `psql` at all.

> **Upgrading from an older checkout?** If you already ran `docker compose
> up` before this seeding setup existed, Postgres's data directory is no
> longer "fresh," so step 1 above won't retroactively fire. Run
> `docker compose down -v` (this deletes the local dev database volume
> only — nothing in AWS) and then `docker compose up --build` again.

The root `.env` (copied from `.env.example`) is read directly by
`docker compose` to fill in `${AWS_REGION}`, `${ADMIN_EMAIL}`, etc. in
`docker-compose.yml`. This is a **different file** from `server/.env`
(below) — Docker Compose itself only ever reads the one at the project
root.

### Option B: Postgres in Docker, backend/frontend run natively

Useful when you're actively editing backend code and want faster restarts
than rebuilding a container each time.

```bash
docker compose up db
```

This still auto-applies the schema + sample jobs as described above. Then:

```bash
cd server
cp .env.example .env   # fill in the values, see table below
npm install
npm run seed:admin      # creates the admin account (run once)
npm run dev              # starts the API on http://localhost:3000
```

`server/.env.example` fields:

| Variable            | Purpose                                                              |
|---------------------|------------------------------------------------------------------------|
| `DATABASE_URL`      | Postgres connection string (default matches the `docker compose up db` above) |
| `AWS_REGION`        | Region your S3 bucket / SES identity live in                          |
| `S3_BUCKET_NAME`    | S3 bucket for résumé uploads                                          |
| `SES_SENDER_EMAIL`  | Verified SES identity to send "from" (see relationship to `ADMIN_EMAIL` below) |
| `JWT_SECRET`        | Any long random string, used to sign login tokens                     |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Used by `npm run seed:admin` to create the admin account  |
| `PORT`              | Port the API listens on (defaults to 3000)                             |

**How `ADMIN_EMAIL`, `SES_SENDER_EMAIL`, and student emails relate** — these
are three logically separate settings that are easy to conflate:

- `ADMIN_EMAIL` is just the **login identifier** for the one built-in admin
  account. It doesn't have to be a real inbox.
- `SES_SENDER_EMAIL` is the **"From" address** on every interview/rejection
  email SES sends. It must be a verified SES identity. It's common (and
  fine) to set this to the same address as `ADMIN_EMAIL` for simplicity,
  but nothing in the code requires that.
- Each **student's registered email** (the one they sign up with) is the
  **"To" address** when the admin sends them an email. While SES is in
  sandbox mode, that address must *also* be a verified SES identity, or
  sending will fail — see the sandbox notes below for what this means in
  practice.

Then, in a separate terminal, run the frontend:

```bash
cd client
npm install
npm run dev
```

Starts the Vite dev server (usually `http://localhost:5173`). It proxies
`/api/*` requests to `http://localhost:3000` (see `client/vite.config.js`),
so the two dev servers work together without any CORS configuration.

Open the printed Vite URL, register a student account, and browse jobs. Log
in as the admin using `ADMIN_EMAIL` / `ADMIN_PASSWORD` to reach `/admin`.

## Building and running the Docker image locally

**Backend:**

```bash
cd server
docker build -t job-portal-backend .
docker run -p 3000:3000 --env-file .env job-portal-backend
```

Or use the full local stack (Postgres + backend together) as in Option A
above:

```bash
docker compose up --build
```

**Frontend** (optional — mainly to sanity-check the production build):

```bash
cd client
docker build -t job-portal-frontend .
docker run -p 8080:80 job-portal-frontend
```

Then visit `http://localhost:8080`. Remember: this container is a local
convenience only. In the real deployment, `npm run build` output
(`client/dist`) is uploaded directly to S3 and served via CloudFront — the
frontend is never actually run as a container in production.

## Design system & illustrations

The UI follows a deliberately restrained "professional / corporate" visual
style — think internal HR tool, not consumer app:

- **Colors, fonts, spacing**: all defined as CSS custom properties in
  `client/src/styles.css` (deep blue `--color-primary`, muted teal
  `--color-accent`, a 4/8/16/24/32/48px spacing scale). Headings use
  **Sora**, body/UI text uses **Inter** (loaded via Google Fonts in
  `client/index.html`).
- **Status pills**: `StatusBadge` (`client/src/components/StatusBadge.jsx`)
  is the app's one recurring visual element, shown identically in student
  and admin views — slate for `submitted`, teal-green for `interview`, muted
  red for `rejected`. Rejection is intentionally *not* styled as alarming or
  destructive (no bright red), since sending a rejection email is a normal
  business action, not a delete.
- **Icons**: [`lucide-react`](https://lucide.dev) throughout, used
  purposefully (status, upload/download, edit/delete, empty states) rather
  than as decoration.

### Illustrations (optional, dev-only)

Four illustrations (job-browse hero, two empty states, login/register) are
generated once via the OpenAI Images API and committed as static assets —
they are **not** generated at runtime, so the deployed app never needs an
OpenAI API key. If they haven't been generated yet, `Illustration.jsx`
(`client/src/components/Illustration.jsx`) automatically falls back to a
plain `lucide-react` icon in the same spot, so the app looks intentional
either way — nothing is broken or blocked by skipping this step.

To generate (or regenerate) them:

```bash
cd client
OPENAI_API_KEY=sk-...  npm run generate:illustrations
```

This calls `client/scripts/generate-illustrations.js`, which writes PNGs
into `client/src/assets/illustrations/` (filenames and the exact prompt
used for each are documented in that folder's `README.md`, and repeated as
`// TODO` comments at each usage site in the page components). Only set
`OPENAI_API_KEY` in your shell for this one command — never commit it, and
it's not read anywhere else in the app. If you already have the generated
files in the repo, you can skip this entirely.

## SES sandbox notes (important for the course)

By default, a new AWS account's SES is in **sandbox mode**, which restricts
you to sending email only:
- **from** a verified identity (`SES_SENDER_EMAIL` must be verified in the
  SES console), **and**
- **to** verified identities as well — SES will reject email to any address
  that hasn't also been verified.

Since each student deploys this app into their own AWS account and nobody
is requesting SES production access for a course exercise, the practical
workflow is:

1. Verify your own email address (or a couple of addresses) as SES
   identities in the AWS Console (SES → Verified identities).
2. Set `SES_SENDER_EMAIL` to one of those verified addresses.
3. When registering student accounts to test the app, use those same
   verified email addresses. Since there's no email verification step on
   registration, you can register as many "students" as you like, as long
   as each one's email is a verified SES identity — otherwise the
   admin's "Send Interview Invitation" / "Send Rejection" buttons will fail
   with an SES rejection.

This is a sandbox-mode limitation, not a bug in the app.

## Notes on the status flow

The `Submitted → Interview → Rejected` flow is intentionally minimal. A real
hiring pipeline would likely need more states (e.g. "Under Review",
"Offer Extended", "Accepted", "Withdrawn") and a way to move backward or
sideways, not just forward through email actions. That complexity is left
out on purpose so the course can focus on the AWS deployment concepts
rather than product/business logic.
