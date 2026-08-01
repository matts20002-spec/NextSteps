# NextStep

## Overview

NextStep is hiring heavily over the next few months and decided to build
its own job application portal instead of continuing to rely on external
job boards, mainly to cut cost and keep direct control over the hiring
pipeline and applicant data.

This is the first version. It's a deliberate MVP: things like email
verification, password reset, and a full admin-role system were left out
to ship fast and start hiring sooner, not because nobody thought of them.
Candidates register, browse job postings, and apply with a resume upload.
A single built-in admin account manages postings and moves applicants
forward.

## How it works

Candidates register an account, browse job postings, and apply to a job
with a resume upload. Each application has one of three statuses, in this
fixed order: `submitted`, `interview`, `rejected`. `submitted` is set
automatically when a candidate applies. `interview` and `rejected` change
only as a side effect of the admin clicking a "send email" action on an
applicant, which sends the email via SES and updates the status at the same
time. There's no separate status dropdown.

There is one built-in admin account, created from `ADMIN_EMAIL` /
`ADMIN_PASSWORD` (see the env var tables below). The admin logs in at the
same login page as candidates and is routed to `/admin` to manage job
postings and review applicants.

## Architecture (production)

```
User Browser -> CloudFront -> S3 (static frontend)
                    |
            API Requests (HTTPS)
                    |
        Application Load Balancer -> ECS Fargate (backend)
                    |
    +------+------+---------+---------+
    RDS    S3    Secrets    SES       KMS
 (Postgres)(resumes) Manager (email) (encryption)
```

- **CloudFront**: CDN in front of the S3 frontend bucket, and the entry
  point for the whole app. Routes `/api/*` to the ALB, everything else to S3.
- **S3 (static frontend)**: hosts the built React app (`client/static`).
- **Application Load Balancer**: routes HTTPS API traffic to the ECS
  service and terminates TLS.
- **ECS Fargate (backend)**: runs the Express API as a container, one task
  definition, no autoscaling needed at current hiring volume.
- **RDS (Postgres)**: stores users, jobs, and applications.
- **S3 (resumes)**: stores uploaded resume files, accessed by the backend
  via IAM role, not public.
- **Secrets Manager**: holds the database credentials (`DB_HOST`, `DB_USER`,
  `DB_PASSWORD`) and other secrets injected into the ECS task as
  environment variables.
- **SES**: sends interview and rejection emails on behalf of the admin.
- **KMS**: encrypts data at rest for RDS and S3 via their default
  encryption settings.

## Local deployment

Two steps:

1. Start the database and backend:

```bash
cp .env.example .env
docker compose up --build
```

This starts Postgres, the backend, and the frontend (nginx) as three
Compose services. The backend applies its own schema and seed data, and
creates the admin account from `ADMIN_EMAIL` / `ADMIN_PASSWORD`, on every
startup, against whatever PostgreSQL database it's pointed at -- local or
RDS -- so there's no separate manual schema or admin-seeding step, on a
fresh volume or a fresh RDS instance alike (see `server/src/schema.js` and
`server/src/seedAdmin.js`).

2. The frontend container is built and started by the same command, via
   the `frontend` service in `docker-compose.yml`. It's an nginx container
   that serves the built React app and reverse-proxies `/api/*` to the
   `backend` service over the internal Docker network (see
   `client/nginx.conf`), so the app works with zero extra configuration.

Open `http://localhost`. Register a candidate account, or log in as the
admin with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from your `.env`.

### Env vars

The app connects to Postgres with discrete params rather than a single
`DATABASE_URL`, since in production the RDS-managed Secrets Manager secret
exposes host/user/password as separate fields, not a pre-built URL, and the
database name is a separate plain value outside that secret entirely (see
`server/src/db.js`).

| Variable | Purpose | Example |
|---|---|---|
| `DB_HOST` | Postgres host | `db` |
| `DB_PORT` | Postgres port | `5432` |
| `DB_USER` | Postgres user | `postgres` |
| `DB_PASSWORD` | Postgres password | `postgres` |
| `DB_NAME` | Postgres database name | `job_portal` |
| `DB_SSL` | Enables TLS on the database connection | not needed locally, leave unset (`false`) |
| `JWT_SECRET` | Signs login JWTs | a long random string |
| `S3_BUCKET_NAME` | S3 bucket for resume uploads | `nextstep-resumes` |
| `AWS_REGION` | Region for the S3 bucket and SES identity | `us-east-1` |
| `SES_SENDER_EMAIL` | Verified SES "from" address for interview/rejection emails | `you@example.com` |
| `ADMIN_EMAIL` | Login identifier for the built-in admin account | `admin@example.com` |
| `ADMIN_PASSWORD` | Password for the built-in admin account | a strong password |

`VITE_API_URL` is not needed locally. The nginx proxy in the `frontend`
container handles routing `/api/*` to the backend, so the frontend calls
relative paths.

## Production deployment

This follows the architecture diagram above. Steps assume you're already
comfortable with the AWS console or CLI.

- **RDS PostgreSQL**: create an instance. No manual schema or admin-seeding
  step is needed -- the backend applies `server/sql/schema.sql` (and seed
  data) and creates the admin account from `ADMIN_EMAIL` / `ADMIN_PASSWORD`
  itself on startup, against whatever database it's pointed at, so a fresh
  RDS instance gets its tables and admin login created automatically on
  the very first boot (see `server/src/schema.js` and
  `server/src/seedAdmin.js`). Put the host, username, and password
  into Secrets Manager as `DB_HOST`, `DB_USER`, and `DB_PASSWORD` (the
  discrete fields RDS-managed secrets actually expose, rather than a
  pre-built connection string). `DB_NAME` isn't part of that secret, set it
  as a plain task-definition env var.
- **S3 (resumes)**: create a private bucket for resume uploads. Attach an
  IAM policy to the ECS task role granting it read/write access to that
  bucket only.
- **S3 + CloudFront (frontend)**: create a bucket for the static frontend
  build and a CloudFront distribution in front of it. Configure CloudFront
  to route `/api/*` to the ALB and everything else to the S3 origin.
- **SES**: verify a sending identity for `SES_SENDER_EMAIL`. New AWS
  accounts start in SES sandbox mode, which also requires every recipient
  address to be verified. You'll likely need to request SES production
  access before candidates outside your verified list can receive email.
- **Secrets Manager**: store `DB_HOST`, `DB_USER`, and `DB_PASSWORD` at
  minimum. Other values (`JWT_SECRET`, `ADMIN_PASSWORD`, etc.) can live
  here too instead of as plain task-definition env vars if you want them
  encrypted at rest.
- **ECS Fargate**: task definition needs these env vars: `DB_HOST`,
  `DB_USER`, `DB_PASSWORD` (from Secrets Manager), `DB_PORT`, `DB_NAME`,
  `DB_SSL=true`, `JWT_SECRET`, `S3_BUCKET_NAME`, `AWS_REGION`,
  `SES_SENDER_EMAIL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`. Build the image from
  `server/Dockerfile`.
- **ALB**: routes HTTPS traffic to the ECS service's target group.
  CloudFront points at this ALB for `/api/*`.
- **Frontend build**: build the frontend with `VITE_API_URL` set to the
  ALB's or a custom domain's HTTPS address, for example:

```bash
cd client
VITE_API_URL=https://api.yourdomain.com npm run build
```

  Upload the `client/static` output to the frontend S3 bucket.

  The backend URL can also be changed after deployment without a rebuild:
  edit `config.js` at the root of the uploaded static content (it sits
  alongside `index.html`) and set `API_URL` to the new address. This
  overrides `VITE_API_URL` at runtime, useful if the backend address
  changes later. See `client/src/api/config.js`.

- **KMS**: encryption at rest is applied via RDS's and S3's default
  encryption settings, both backed by a KMS key. No separate KMS setup is
  required beyond enabling default encryption on those resources.

This production path hasn't been walked end-to-end yet in this project.
Validate it before relying on it for real hiring.
