import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPin, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';

// Single job posting, plus (for logged-in students) an apply form that
// uploads a résumé file straight to the /api/applications endpoint, which
// forwards it to S3.
export default function JobDetail() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();

  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const [resumeFile, setResumeFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    api
      .get(`/jobs/${jobId}`)
      .then(setJob)
      .catch((err) => setError(err.message));
  }, [jobId]);

  async function handleApply(e) {
    e.preventDefault();
    if (!resumeFile) {
      setError('Please choose a résumé file (PDF or DOCX) to upload.');
      return;
    }

    setSubmitting(true);
    setError('');

    const formData = new FormData();
    formData.append('jobId', jobId);
    formData.append('resume', resumeFile);

    try {
      await api.postForm('/applications', formData, token);
      setApplied(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !job) return <p className="error"><AlertCircle size={16} />{error}</p>;
  if (!job) return <p>Loading...</p>;

  return (
    <div>
      <h1>{job.title}</h1>
      <p className="job-location">
        <MapPin size={14} />
        {job.location}
      </p>
      <p className="job-description">{job.description}</p>

      <hr />

      {applied ? (
        <p className="success">
          <CheckCircle2 size={18} />
          Application submitted! Check "My Applications" for status updates.
        </p>
      ) : !user ? (
        <p>
          <button onClick={() => navigate('/login')}>Log in to apply</button>
        </p>
      ) : user.isAdmin ? (
        <p>Admin accounts cannot apply to jobs.</p>
      ) : (
        <form onSubmit={handleApply} className="form">
          <h2>Apply for this position</h2>
          <label>
            Résumé (PDF or DOCX)
            <span className="file-input">
              <Upload size={16} />
              <input
                type="file"
                accept=".pdf,.docx"
                onChange={(e) => setResumeFile(e.target.files[0])}
              />
            </span>
          </label>
          {error && (
            <p className="error">
              <AlertCircle size={16} />
              {error}
            </p>
          )}
          <button type="submit" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Application'}
          </button>
        </form>
      )}
    </div>
  );
}
