import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPin, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';

// Single job posting, plus (for logged-in applicants) an apply form that
// uploads a résumé straight to S3 via a presigned URL (never through our
// own API), then submits the application referencing the resulting key.
// See server/src/routes/applications.js for the /presign endpoint.
export default function JobDetail() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();

  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const [resumeFile, setResumeFile] = useState(null);
  // 'idle' | 'uploading' | 'submitting' -- distinct stages of the apply
  // flow, since it's now two network round-trips (S3, then our API)
  // instead of one.
  const [stage, setStage] = useState('idle');
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

    setError('');

    try {
      setStage('uploading');
      const { url, key } = await api.post(
        '/applications/presign',
        { filename: resumeFile.name, contentType: resumeFile.type },
        token
      );

      const uploadResponse = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': resumeFile.type },
        body: resumeFile,
      });
      if (!uploadResponse.ok) {
        throw new Error('Failed to upload résumé. Please try again.');
      }

      setStage('submitting');
      await api.post('/applications', { jobId, resumeS3Key: key }, token);
      setApplied(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setStage('idle');
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
          <button type="submit" disabled={stage !== 'idle'}>
            {stage === 'uploading'
              ? 'Uploading résumé...'
              : stage === 'submitting'
                ? 'Submitting...'
                : 'Submit Application'}
          </button>
        </form>
      )}
    </div>
  );
}
