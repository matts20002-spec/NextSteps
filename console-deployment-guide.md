# NextStep Production Deployment Guide (AWS Console)

A complete, ordered walkthrough for deploying NextStep to AWS from a clean
account. Follow the sections in order, each one only depends on resources
created in an earlier section, nothing later in this guide requires going
back to change something earlier.

Written for an instructor with AWS Console experience. Steps are detailed
enough to follow without needing outside documentation, but this assumes
familiarity with what a VPC, security group, or task definition fundamentally
is.

---

## Contents

0. Tear down existing resources (if redoing a previous attempt)
1. Naming conventions and values you'll collect along the way
2. VPC and networking
3. Security groups (all three, in dependency order)
4. Secrets Manager: application secrets
5. RDS: PostgreSQL database
6. S3: résumé bucket and frontend bucket
7. SES: email sending identity
8. ECR: push the backend image
9. IAM: execution role and task role
10. Application Load Balancer and target group
11. ECS: cluster, task definition, and service
12. Verify the backend independently
13. Frontend: build and upload to S3
14. CloudFront distribution
15. KMS (encryption notes)
16. Full end-to-end verification
17. Teardown checklist (for next time)

---

## 0. Tear down existing resources (if redoing a previous attempt)

If you deployed a previous attempt and want a clean slate, delete in this
order, each one before the one above it in the AWS resource dependency
chain, otherwise deletion will fail with a "resource in use" error:

1. ECS: delete the service first (scale to 0, then delete), then the cluster
2. Application Load Balancer: delete the load balancer, then the target
   group (deleting the ALB does not automatically delete its target group)
3. CloudFront: disable the distribution, wait for it to finish disabling
   (can take several minutes), then delete it
4. S3: empty both buckets (frontend and résumés), then delete the buckets
5. RDS: delete the database instance (skip the final snapshot if this is
   genuinely disposable test data), this also deletes its managed secret
   automatically
6. ECR: delete the repository (and its images)
7. Secrets Manager: delete the `nextstep/app-secrets` secret (this one has a
   default 7-30 day recovery window, use "force delete without recovery" if
   you want it gone immediately and plan to recreate it with the same name)
8. IAM: delete the two roles (execution role, task role) and any inline
   policies on them
9. Security groups: delete all three (db, ecs, alb), in that order, security
   groups referencing each other block deletion until the referencing rule
   is gone, deleting the one nothing else depends on first (db-sg) avoids
   that
10. VPC: delete the VPC last, this cleans up subnets, route tables, the
    internet gateway, and the NAT gateway together (NAT gateways can take a
    few minutes to fully delete, and are billed until they're gone, don't
    skip this one)

---

## 1. Naming conventions and values you'll collect along the way

Using consistent names throughout avoids confusion later. This guide uses:

| Resource | Name |
|---|---|
| VPC | `nextstep-vpc` |
| Security groups | `nextstep-alb-sg`, `nextstep-ecs-sg`, `nextstep-db-sg` |
| RDS instance | `nextstep-db` |
| RDS database name | `nextstep` |
| RDS master username | `nextstep_admin` |
| App secrets | `nextstep/app-secrets` |
| Résumé bucket | `nextstep-resumes-<unique-suffix>` |
| Frontend bucket | `nextstep-frontend-<unique-suffix>` |
| ECR repository | `nextstep-backend` |
| ECS cluster | `nextstep-cluster` |
| ECS task family | `nextstep-backend-task` |
| ECS service | `nextstep-backend-service` |
| ALB | `nextstep-alb` |
| Target group | `nextstep-tg` |
| IAM roles | `nextstep-ecs-execution-role`, `nextstep-ecs-task-role` |

Adjust to your own naming scheme if you prefer, but pick one before starting
and stay consistent, most of the copy-paste mistakes in a first deployment
come from typos between similarly-named resources.

You'll be collecting these actual values as you go, worth keeping a scratch
note open:

- [ ] VPC ID
- [ ] Public subnet IDs (x2), private subnet IDs (x2)
- [ ] `nextstep-alb-sg` ID
- [ ] `nextstep-ecs-sg` ID
- [ ] `nextstep-db-sg` ID
- [ ] `nextstep/app-secrets` ARN
- [ ] RDS endpoint hostname
- [ ] RDS managed secret ARN (auto-created, holds only username and password)
- [ ] Résumé bucket name
- [ ] Frontend bucket name
- [ ] SES verified sender address
- [ ] ECR repository URI
- [ ] Execution role ARN, task role ARN
- [ ] ALB DNS name, target group ARN
- [ ] CloudFront domain name

---

## 2. VPC and networking

1. VPC Console > Create VPC
2. Resources to create: **VPC and more**
3. Name tag: `nextstep-vpc`
4. Availability Zones: 2
5. Number of public subnets: 2
6. Number of private subnets: 2
7. NAT gateways: **1 (in 1 AZ)**, a single shared NAT gateway, not one per AZ
8. VPC endpoints: none, leave default (S3 gateway endpoint is optional here,
   skip it for this pass, it's a later optimization, not required to
   function)
9. Create VPC. This auto-creates route tables, an internet gateway attached
   to the public subnets, and a NAT gateway route for both private subnets,
   no manual route table editing needed
10. Once created, note the VPC ID and all four subnet IDs (VPC Console >
    Subnets, filter by this VPC, the tags show which are public vs. private)

RDS and the ECS service go in the private subnets. The ALB goes in the
public subnets. Nothing else in this guide touches VPC configuration again.

---

## 3. Security groups (all three, in dependency order)

Creating these now, together, in the order below, means each one already
exists by the time the next one needs to reference it. This is the single
biggest source of back-and-forth in a first attempt, doing this section
out of order or scattered across later steps is exactly what caused it last
time.

### 3a. `nextstep-alb-sg` (no dependencies, create first)

1. EC2 Console > Security Groups > Create security group
2. Name: `nextstep-alb-sg`, VPC: `nextstep-vpc`
3. Inbound rules:
   - Type: HTTP, Port 80, Source: `0.0.0.0/0`
   - Type: HTTPS, Port 443, Source: `0.0.0.0/0`
4. Outbound rules: leave the default (all traffic allowed)
5. Create

### 3b. `nextstep-ecs-sg` (depends on alb-sg existing)

1. Create security group
2. Name: `nextstep-ecs-sg`, VPC: `nextstep-vpc`
3. Inbound rules:
   - Type: Custom TCP, Port 3000 (or whatever port the backend container
     actually listens on, confirm against `server/Dockerfile`'s `EXPOSE`
     line), Source: **security group** `nextstep-alb-sg`
4. Outbound rules: leave the default (all traffic allowed, this is what lets
   ECS tasks reach RDS, S3, SES, ECR, and Secrets Manager through the NAT
   gateway)
5. Create

### 3c. `nextstep-db-sg` (depends on ecs-sg existing)

1. Create security group
2. Name: `nextstep-db-sg`, VPC: `nextstep-vpc`
3. Inbound rules:
   - Type: PostgreSQL, Port 5432, Source: **security group** `nextstep-ecs-sg`
4. Outbound rules: leave the default
5. Create

All three exist now, fully wired, before anything that needs them (RDS, the
ALB, the ECS service) gets created. Nothing later in this guide requires
editing a security group rule.

---

## 4. Secrets Manager: application secrets

Creating this now, early, means it's ready by the time the IAM roles and
task definition need to reference its ARN.

1. Secrets Manager Console > Store a new secret
2. Secret type: **Other type of secret**
3. Key/value pairs:
   - `JWT_SECRET`: generate with `openssl rand -base64 32` (run this locally,
     paste the output in)
   - `ADMIN_EMAIL`: the email address the instructor will use to log into
     the admin account
   - `ADMIN_PASSWORD`: a real password, not a placeholder, this becomes the
     actual admin login
4. Secret name: `nextstep/app-secrets`
5. Create, note the ARN shown on the secret's detail page

This secret does not include database credentials, RDS manages its own
separately in the next section.

---

## 5. RDS: PostgreSQL database

1. RDS Console > Create database
2. Engine: PostgreSQL. Templates: Free tier or Dev/Test
3. DB instance identifier: `nextstep-db`
4. Credentials management: select **Manage master credentials in AWS
   Secrets Manager**. Set a master username: `nextstep_admin` (this
   username itself is not sensitive and will be entered as a plain value
   later, only the password is stored as a secret)
5. Instance class: smallest available (`db.t3.micro` / `db.t4g.micro`)
6. Storage: default
7. Connectivity:
   - VPC: `nextstep-vpc`
   - Subnet group: create new, restricted to the two private subnets
   - Public access: **No**
   - VPC security group: choose existing, select `nextstep-db-sg` (already
     created in step 3c, do not create a new one here)
8. Additional configuration: initial database name: `nextstep`
9. Create database. Provisioning takes several minutes
10. Once available, RDS Console > `nextstep-db` > Connectivity & security
    tab, note:
    - The **endpoint** (hostname)
    - The **port** (5432 by default)
    - The **master credentials ARN** (under Configuration tab), this is the
      secret RDS auto-created, note it, it holds only `username` and
      `password` as JSON keys, nothing else

### Applying the schema

No manual step needed here. The backend applies `server/sql/schema.sql` and
`server/sql/seed_jobs.sql` itself at startup, idempotently, before it starts
accepting requests, this runs identically whether it's talking to the local
Docker Postgres container or a real RDS instance, since it's the
application doing it, not something depending on Postgres's
`docker-entrypoint-initdb.d` mechanism (which only exists for locally-run
Postgres containers and has no RDS equivalent).

The first time the ECS service starts against this fresh RDS database in
step 11, the tables and seed jobs get created automatically as part of that
startup. Nothing to run separately, and nothing to remember to do before
moving on to step 6.

---

## 6. S3: résumé bucket and frontend bucket

### Résumé bucket

1. S3 Console > Create bucket
2. Name: `nextstep-resumes-<unique-suffix>`
3. Block all public access: keep enabled
4. Default encryption: enable, SSE-KMS, AWS-managed key (`aws/s3`) is fine
   for now
5. Create
6. **Required: Permissions tab > Cross-origin resource sharing (CORS) >
   Edit.** The frontend uploads résumés directly to this bucket from the
   browser using a presigned URL, so without CORS configured, the upload
   fails with a browser CORS error, this step is easy to miss since the
   bucket otherwise appears to work fine (downloads, console access) without
   it, the failure only shows up when a real browser upload is attempted.
   Add:
   ```json
   [
     {
       "AllowedHeaders": ["*"],
       "AllowedMethods": ["PUT", "GET"],
       "AllowedOrigins": ["https://<cloudfront-domain>"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3000
     }
   ]
   ```
   The CloudFront domain isn't known yet at this point in the guide (it's
   created in step 14), come back and fill in the real value once it exists,
   or set `AllowedOrigins` to `["*"]` temporarily to unblock testing and
   tighten it to the real domain once known, don't leave it as `"*"`
   permanently

### Frontend bucket

1. Create bucket
2. Name: `nextstep-frontend-<unique-suffix>`
3. Block all public access: keep enabled (CloudFront will access it via
   Origin Access Control, set up in step 14, not through public access)
4. Default encryption: same as above
5. Create

Note both bucket names, needed later for the IAM policy, the ECS task
definition, and the frontend upload/CloudFront steps.

---

## 7. SES: email sending identity

1. SES Console > Verified identities > Create identity
2. Choose Domain (recommended) or Email address for a quicker setup
3. Domain: add the DKIM CNAME records shown to your DNS provider, wait for
   verification (up to 72 hours, usually faster). Email address: click the
   verification link sent to that address
4. Note the verified sender address or domain, this is `SES_SENDER_EMAIL`
5. SES Console > Account dashboard: check sending status. If still in
   sandbox mode (the default for a new account), **two separate things are
   restricted**, not just one:
   - Only verified identities can be used as a sender
   - Only verified identities can **receive** mail at all, sandbox mode
     rejects sending to any unverified recipient, regardless of who the
     sender is

   This means testing the actual interview-invite / rejection email flow
   end to end requires **verifying a second identity**, a real inbox you
   have access to, register a test candidate account using that same
   verified address, and admin-sent emails to it will actually arrive. This
   isn't a separate configuration step, it's the same "Create identity" flow
   above, run a second time for a different email address

   Request production access here (Account dashboard) if this deployment
   needs to email real, unverified candidate addresses without each one
   being manually verified first (approval typically takes a few hours to
   two business days)

---

## 8. ECR: push the backend image

1. ECR Console > Create repository, name: `nextstep-backend`, private
2. Use the repository's "View push commands" button, run the shown
   `docker login`, `docker build`, `docker tag`, `docker push` commands
   locally against `server/Dockerfile`
3. Confirm the image appears with a tag (e.g. `latest`)
4. Note the full image URI shown in the repository

---

## 9. IAM: execution role and task role

Both roles are created now, before the task definition in step 11, since
the task definition needs to reference both by ARN, and both roles need the
resource ARNs collected in earlier steps (S3 bucket names, the two secret
ARNs) to write their policies correctly.

### Execution role: `nextstep-ecs-execution-role`

Used by ECS itself to pull the image and inject secrets at container start,
not used by your application code.

1. IAM Console > Roles > Create role
2. Trusted entity type: AWS service > Elastic Container Service > Elastic
   Container Service Task
3. Attach AWS-managed policy: `AmazonECSTaskExecutionRolePolicy`
4. Add an inline policy for reading both secrets:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": "secretsmanager:GetSecretValue",
         "Resource": [
           "<RDS-managed secret ARN from step 5>",
           "<nextstep/app-secrets ARN from step 4>"
         ]
       }
     ]
   }
   ```
5. Name: `nextstep-ecs-execution-role`, create, note the ARN

### Task role: `nextstep-ecs-task-role`

Used by your running application code, S3, SES, and any direct secret reads
performed at runtime.

1. Create role, same trusted entity setup as above
2. Skip attaching any AWS-managed policy, add a custom inline policy:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "ResumeBucketAccess",
         "Effect": "Allow",
         "Action": ["s3:GetObject", "s3:PutObject"],
         "Resource": "arn:aws:s3:::nextstep-resumes-<suffix>/*"
       },
       {
         "Sid": "SendEmail",
         "Effect": "Allow",
         "Action": ["ses:SendEmail", "ses:SendRawEmail"],
         "Resource": "*"
       },
       {
         "Sid": "SecretsRead",
         "Effect": "Allow",
         "Action": "secretsmanager:GetSecretValue",
         "Resource": [
           "<RDS-managed secret ARN from step 5>",
           "<nextstep/app-secrets ARN from step 4>"
         ]
       }
     ]
   }
   ```
   The `s3:GetObject`/`PutObject` actions are scoped to `.../*` (objects
   inside the bucket), not the bucket ARN itself, those are different
   resources in IAM. SES doesn't support restricting to one identity as
   simply as S3 does, `Resource: "*"` here is normal
3. Name: `nextstep-ecs-task-role`, create, note the ARN

---

## 10. Application Load Balancer and target group

Creating the ALB and its target group here, as their own standalone step,
before the ECS service exists, avoids the awkward "create it inline during
service creation, then go back and fix the subnets" problem from a
previous attempt.

### Target group (create first, the ALB's listener will reference it)

1. EC2 Console > Target Groups > Create target group
2. Target type: **IP** (required for Fargate)
3. Name: `nextstep-tg`
4. Protocol: HTTP, Port: 3000 (must match the container's actual listening
   port)
5. VPC: `nextstep-vpc`
6. Health check path: a real backend route that returns a success status,
   e.g. `/api/jobs`
7. Create. Don't register any targets manually, the ECS service will do
   that automatically in step 11

### Load balancer

1. EC2 Console > Load Balancers > Create load balancer > Application Load
   Balancer
2. Name: `nextstep-alb`
3. Scheme: **internet-facing**
4. VPC: `nextstep-vpc`. Mappings: select the **two public subnets only**,
   do not include the private subnets
5. Security group: remove the default, attach `nextstep-alb-sg` (created in
   step 3a)
6. Listener: HTTP, port 80, default action: forward to `nextstep-tg`. Add an
   HTTPS listener on 443 later once an ACM certificate exists, HTTP-only is
   fine to get the full stack working first
7. Create, note the ALB's DNS name once provisioned

---

## 11. ECS: cluster, task definition, and service

### Cluster

1. ECS Console > Clusters > Create cluster
2. Name: `nextstep-cluster`, infrastructure: AWS Fargate
3. Create

### Task definition

1. ECS Console > Task definitions > Create new task definition
2. Family: `nextstep-backend-task`
3. Launch type: AWS Fargate
4. Task size: 0.5 vCPU / 1 GB memory
5. Task role: `nextstep-ecs-task-role` (from step 9)
6. Execution role: `nextstep-ecs-execution-role` (from step 9)
7. Container definition:
   - Image URI: the ECR image from step 8
   - Port mappings: container port 3000
   - Environment variables, **plain values**:
     | Key | Value |
     |---|---|
     | `AWS_REGION` | your region, e.g. `us-east-2` |
     | `S3_BUCKET_NAME` | the résumé bucket name from step 6 |
     | `SES_SENDER_EMAIL` | the verified sender from step 7 |
     | `DB_HOST` | the RDS endpoint hostname from step 5 |
     | `DB_PORT` | `5432` |
     | `DB_NAME` | `nextstep` |
     | `DB_USER` | `nextstep_admin` |
     | `DB_SSL` | `true` |
   - Environment variables, **ValueFrom (Secrets Manager)**:
     | Key | ValueFrom |
     |---|---|
     | `DB_PASSWORD` | `<RDS-managed secret ARN>:password::` |
     | `JWT_SECRET` | `<nextstep/app-secrets ARN>:JWT_SECRET::` |
     | `ADMIN_EMAIL` | `<nextstep/app-secrets ARN>:ADMIN_EMAIL::` |
     | `ADMIN_PASSWORD` | `<nextstep/app-secrets ARN>:ADMIN_PASSWORD::` |

     The RDS-managed secret only contains `username` and `password`, that's
     why `DB_USER` above is a plain value, not a secret reference, and why
     there's no `DB_NAME` secret reference either, it was never in there.
     Each `ValueFrom` entry needs the JSON key placed directly after the
     secret's ARN with a single colon, then a trailing `::`, in that exact
     order, this is the most common typo in this step, double check each one
8. Create the task definition

### Service

1. `nextstep-cluster` > Create service
2. Launch type: Fargate, task definition: `nextstep-backend-task`
3. Service name: `nextstep-backend-service`
4. Desired tasks: 1
5. Networking: VPC `nextstep-vpc`, subnets: the two **private** subnets,
   security group: `nextstep-ecs-sg`. Public IP: not required
6. Load balancing: **use an existing load balancer**, select `nextstep-alb`,
   existing listener (port 80), existing target group: `nextstep-tg`. Do not
   create a new load balancer here, it was already created in step 10
7. Create service

---

## 12. Verify the backend independently

Before touching the frontend at all, confirm the backend, database, and
load balancer path work on their own:

1. ECS Console > `nextstep-cluster` > Tasks tab, confirm a task is running
   (not cycling/restarting)
2. EC2 Console > Target Groups > `nextstep-tg` > Health checks, confirm the
   target shows **healthy** (may take a minute or two after the service
   starts)
3. Visit `http://<alb-dns-name>/api/jobs` directly in a browser. This should
   return JSON (a job list, possibly empty if seed data hasn't run yet), not
   an error, not a timeout, not a 404

If the target is unhealthy or this request fails, check task logs
(CloudWatch Logs, linked from the task detail page in ECS Console) before
proceeding, common causes at this stage: the `nextstep-ecs-sg` inbound rule
from `nextstep-alb-sg` is missing (health checks never reach the container),
or a database connection error appears in the logs (check `DB_SSL` is set,
and that the `ValueFrom` ARNs are formatted correctly)

Do not move on to the frontend until this step returns real JSON.

---

## 13. Frontend: build and upload to S3

The frontend build is a build-time step, the backend's URL gets baked into
the static JS bundle, so wait until the ALB (or a custom domain) address is
known and confirmed working (step 12) before building.

The Vite project outputs to `static/` (not the default `dist/`).

1. From `client/`, build with the production API URL as a build argument,
   **including the `/api` path suffix**:
   ```
   docker build --build-arg VITE_API_URL=http://<alb-dns-name>/api \
     --target build -t nextstep-frontend-build .
   ```
   (confirm the exact build stage name in `client/Dockerfile` if `build`
   isn't correct, and confirm the internal output path in the next step
   against the same file, rather than assuming)
2. Extract the built static files:
   ```
   docker create --name nextstep-extract nextstep-frontend-build
   docker cp nextstep-extract:/app/static ./static
   docker rm nextstep-extract
   ```
3. Upload the contents of `./static` to the frontend bucket from step 6:
   ```
   aws s3 sync static/ s3://nextstep-frontend-<suffix>/
   ```
   or via S3 Console > Upload

### Runtime-editable backend URL (config.js)

`client/public/config.js` ships with an empty default and gets copied into
the build output automatically:
```js
window.APP_CONFIG = {
  API_URL: ""
};
```
To change the backend URL after deployment without rebuilding, edit this
one file directly (locally then re-upload, or edit it in the S3 console)
with the full API URL **including `/api`**, then invalidate it in
CloudFront (step 14). Leaving it empty falls through to the build-time
`VITE_API_URL` value used above.

---

## 14. CloudFront distribution

1. CloudFront Console > Create distribution
2. Origin: the frontend S3 bucket
3. Origin access: **Origin Access Control**, CloudFront generates a bucket
   policy statement, apply it to the bucket when prompted (S3 Console >
   frontend bucket > Permissions > Bucket policy > paste it in), this is a
   required manual step, don't skip it, a missing bucket policy is the most
   common cause of a 403 when loading the site afterward
4. Default root object: `index.html`
5. Viewer protocol policy: redirect HTTP to HTTPS
6. Custom error responses: map both 403 and 404 to `/index.html` with a 200
   status, needed for client-side routing to survive a refresh or direct
   link
7. Custom domain: optional, needs an ACM certificate requested in
   `us-east-1` specifically
8. Create, note the CloudFront domain name

### Invalidating the cache after a change

Any time static content changes after the first deploy:

1. CloudFront Console > the distribution > Invalidations tab > Create
   invalidation
2. Object paths: `/config.js` for just that file, or `/*` for a full
   redeploy
3. Create, completes within a minute or two

---

## 15. KMS (optional: replacing the default encryption keys)

**Nothing to do here by default, encryption has already been happening the
whole time.** S3 got SSE-KMS enabled with the AWS-managed default key
(`aws/s3`) back in step 6, and RDS storage encryption was left on at
creation in step 5. This section isn't a required step in the encryption
path, it's placed here only because it's the natural point to mention the
optional next level: swapping those AWS-managed default keys for a
dedicated customer-managed key, which gives more control (key rotation
policy, more granular access permissions, ability to revoke) than the
defaults do.

To do that:

1. KMS Console > Create key > Symmetric, Encrypt and decrypt
2. Alias: `nextstep-key`
3. Key administrators/usage permissions: include the ECS task role and any
   IAM users/roles needing direct access
4. Reference this key's ARN when configuring encryption on RDS and the S3
   buckets instead of the AWS-managed defaults, this means going back and
   changing the encryption key setting on those resources, since it can't be
   changed on RDS after creation without a snapshot/restore, this is really
   a "decide before step 5" choice if you want a customer-managed key from
   the start, rather than something to bolt on after the fact

---

## 16. Full end-to-end verification

1. Visit the CloudFront domain, confirm the frontend loads
2. Register a candidate account, confirm the request in the browser's
   Network tab hits `.../api/auth/...` on the ALB successfully
3. Log in as admin (`ADMIN_EMAIL` / `ADMIN_PASSWORD` from
   `nextstep/app-secrets`)
4. Post a job, apply as the candidate with a résumé upload, confirm the file
   lands in the résumé S3 bucket
5. Send an interview invite and a rejection from the admin view, confirm SES
   delivers to a verified recipient address (or any address, if production
   access was granted)

---

## 17. Teardown checklist (for next time)

Same order as section 0, kept here for quick reference once you're actually
done with a given deployment rather than mid-troubleshooting:

ECS service and cluster, ALB and target group, CloudFront distribution
(disable first), both S3 buckets (empty then delete), RDS instance, ECR
repository, `nextstep/app-secrets` secret, both IAM roles, all three
security groups, then the VPC last.

RDS, the ALB, and the NAT gateway are the three resources that bill
continuously while they exist, even completely idle, those are the ones
worth deleting promptly between demos if this isn't staying up permanently.