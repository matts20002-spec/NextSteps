import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Send } from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import Illustration from '../components/Illustration.jsx';

// An applicant's own applications and their current status.
export default function MyApplications() {
  const { token } = useAuth();
  const [applications, setApplications] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/applications/me', token)
      .then(setApplications)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p className="error">{error}</p>;

  return (
    <div>
      <h1>My Applications</h1>

      {applications.length === 0 ? (
        <div className="empty-state">
          {/* TODO: replace with generated illustration once available. Prompt:
              "Flat vector illustration, professional corporate style, blue
              and teal color palette (#1B4965, #5FA8A0), clean geometric
              shapes, minimal detail, no text or letters in the image,
              plenty of negative space, subtle and trustworthy tone, a
              single document or paper airplane mid-flight toward a target,
              sense of anticipation" */}
          <Illustration
            name="empty-student-applications"
            alt="A paper airplane in flight"
            fallbackIcon={Send}
          />
          <p>You haven't applied to any jobs yet. Browse open positions to get started.</p>
          <Link to="/">
            <button>Browse Jobs</button>
          </Link>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Location</th>
                <th>Status</th>
                <th>Applied</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id}>
                  <td>
                    <Link to={`/jobs/${app.job_id}`}>{app.job_title}</Link>
                  </td>
                  <td>{app.job_location}</td>
                  <td>
                    <StatusBadge status={app.status} />
                  </td>
                  <td>{new Date(app.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
