// Entry point for the Job Application Portal API.
//
// This process is what eventually runs in an ECS Fargate task, behind an
// Application Load Balancer, in the course's target architecture. Locally
// it's just `node src/index.js` (or `npm run dev`) talking to a Postgres
// instance on your machine or in Docker.
require('dotenv').config();

const express = require('express');
const cors = require('cors');

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

// Catch-all error handler. Multer file-filter errors (e.g. wrong file type)
// and any other uncaught errors land here instead of crashing the process.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Job Application Portal API listening on port ${PORT}`);
});
