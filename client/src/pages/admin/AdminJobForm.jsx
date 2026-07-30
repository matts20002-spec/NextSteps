import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Save, AlertCircle } from 'lucide-react';
import { api } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';

// Single form used for both "create job" (no jobId in the URL) and
// "edit job" (jobId present) -- keeps the two flows from duplicating markup.
export default function AdminJobForm() {
  const { jobId } = useParams();
  const isEditing = Boolean(jobId);
  const { token } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isEditing) {
      api.get(`/jobs/${jobId}`).then((job) => {
        setTitle(job.title);
        setDescription(job.description);
        setLocation(job.location);
      });
    }
  }, [jobId, isEditing]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const payload = { title, description, location };
    try {
      if (isEditing) {
        await api.put(`/jobs/${jobId}`, payload, token);
      } else {
        await api.post('/jobs', payload, token);
      }
      navigate('/admin');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="form-page form-page-wide">
      <Link to="/admin" className="icon-button back-link">
        <ArrowLeft size={15} />
        Back to job postings
      </Link>
      <h1>{isEditing ? 'Edit Job Posting' : 'New Job Posting'}</h1>
      <form onSubmit={handleSubmit} className="form">
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label>
          Location
          <input value={location} onChange={(e) => setLocation(e.target.value)} required />
        </label>
        <label>
          Description
          <textarea rows={8} value={description} onChange={(e) => setDescription(e.target.value)} required />
        </label>
        {error && (
          <p className="error">
            <AlertCircle size={16} />
            {error}
          </p>
        )}
        <button type="submit" disabled={submitting}>
          <Save size={16} />
          {submitting ? 'Saving...' : 'Save'}
        </button>
      </form>
    </div>
  );
}
