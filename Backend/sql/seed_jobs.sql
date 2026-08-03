-- Sample job postings, so a fresh database gives you something to click
-- through immediately instead of an empty job board. The backend applies
-- this itself on startup, but only when the jobs table is empty (see
-- server/src/schema.js), so it runs once against any target -- local or a
-- fresh RDS deployment -- without inserting duplicate rows on later
-- restarts. It's also picked up locally via Postgres's
-- /docker-entrypoint-initdb.d mechanism (see docker-compose.yml), which is
-- a harmless no-op alongside the backend's own application since the jobs
-- table won't be empty by the time the backend runs its check.
INSERT INTO jobs (title, description, location) VALUES
  (
    'Backend Engineering Intern',
    'Help build and maintain our Node.js/Express APIs. You''ll work alongside senior engineers on real features, learn how our services talk to PostgreSQL, and ship code that goes to production.',
    'Remote'
  ),
  (
    'Frontend Engineering Intern',
    'Join our React team to build clean, accessible UI for internal and customer-facing tools. Good fit if you enjoy turning designs into working, responsive interfaces.',
    'New York, NY'
  ),
  (
    'Cloud Infrastructure Intern',
    'Work with our platform team on AWS -- containers, load balancing, managed databases, and observability. Great opportunity to learn production cloud architecture hands-on.',
    'Austin, TX'
  );
