// Entry point for the NextStep API.
//
// This process is what eventually runs in an ECS Fargate task, behind an
// Application Load Balancer, in the target production architecture. Locally
// it's just `node src/index.js` (or `npm run dev`) talking to a Postgres
// instance on your machine or in Docker.
require('dotenv').config();

const express = require('express');
const cors = require('cors');

const { applySchema } = require('./schema');
const { seedAdmin } = require('./seedAdmin');
const authRoutes = require('./routes/auth');
const jobRoutes = require('./routes/jobs');
const applicationRoutes = require('./routes/applications');
const adminRoutes = require('./routes/admin');

const app = express();

app.use(cors());
app.use(express.json());

// Simple health check -- useful for the ALB target group health check later.
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/admin', adminRoutes);

// Catch-all error handler. Any uncaught route error lands here instead of
// crashing the process (see utils/asyncHandler.js).
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3000;

// Schema application must complete before the server accepts requests --
// otherwise the first request against a fresh database (e.g. a brand new
// RDS instance, which has no docker-entrypoint-initdb.d equivalent) would
// hit "relation does not exist" errors. See schema.js.
//
// Admin seeding runs right after, for the same reason: ECS runs the
// Dockerfile's CMD directly with no external command chain to seed the
// admin account beforehand, so the app has to do it itself on startup, and
// only after the schema (and therefore the users table) exists. See
// seedAdmin.js.
applySchema()
  .then(() => seedAdmin())
  .then(() => {
    app.listen(PORT, () => {
      console.log(`NextStep API listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start up:', err);
    process.exit(1);
  });
