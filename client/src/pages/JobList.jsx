import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, ArrowRight, Users } from 'lucide-react';
import { api } from '../api/client.js';
import Illustration from '../components/Illustration.jsx';

// Public landing page: every open job posting, newest first.
export default function JobList() {
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/jobs')
      .then(setJobs)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="hero">
        <div className="hero-copy">
          <h1>Open Positions</h1>
          <p>Browse current openings and apply directly -- no account needed to look around.</p>
        </div>
        {/* TODO: replace with generated illustration once available. Prompt:
            "Flat vector illustration, professional corporate style, blue and
            teal color palette (#1B4965, #5FA8A0), clean geometric shapes,
            minimal detail, no text or letters in the image, plenty of
            negative space, subtle and trustworthy tone, a diverse group of
            professionals reviewing documents at a modern desk, subtle sense
            of opportunity and career growth" */}
        <Illustration name="hero-job-browse" alt="Professionals reviewing job applications" fallbackIcon={Users} />
      </div>

      {loading && <p>Loading job postings...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && jobs.length === 0 && (
        <p>No open positions right now -- check back soon.</p>
      )}

      <div className="card-list">
        {jobs.map((job) => (
          <Link key={job.id} to={`/jobs/${job.id}`} className="card job-card">
            <div className="job-card-top">
              <div>
                <h2>{job.title}</h2>
                <p className="job-location">
                  <MapPin size={14} />
                  {job.location}
                </p>
              </div>
            </div>
            <p className="job-snippet">{job.description}</p>
            <span className="job-card-cta">
              View & apply <ArrowRight size={15} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
