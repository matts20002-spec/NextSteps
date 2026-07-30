-- Optional sample job postings for local development, so a fresh
-- `docker compose up` gives you something to click through immediately
-- instead of an empty job board. This is NOT run against a real AWS/RDS
-- deployment -- it's only picked up locally via Postgres's
-- /docker-entrypoint-initdb.d mechanism (see docker-compose.yml).
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
