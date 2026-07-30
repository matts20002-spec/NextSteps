# Generated illustrations

This folder is populated by `client/scripts/generate-illustrations.js` (a
dev-only, one-time script -- see the root README). It's empty in a fresh
checkout until someone runs that script with an `OPENAI_API_KEY`.

Expected filenames (the `Illustration` component matches on these
substrings, so the exact extension doesn't matter):

| Filename                       | Used on                          |
|---------------------------------|-----------------------------------|
| `hero-job-browse.png`           | Job listing page hero             |
| `empty-admin-jobs.png`          | Admin dashboard, no jobs yet      |
| `empty-student-applications.png`| "My Applications", none yet       |
| `auth-gateway.png`              | Login / Register pages            |

Until a given file exists, `Illustration.jsx` falls back to a lucide-react
icon in the same spot, so the app looks intentional either way.
