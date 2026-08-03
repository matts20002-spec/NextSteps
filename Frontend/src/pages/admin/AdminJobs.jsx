import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Users, FolderOpen } from 'lucide-react';
import { api } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import Illustration from '../../components/Illustration.jsx';

// Admin dashboard: table of all job postings with add/edit/delete/view-applicants actions.
export default function AdminJobs() {
  const { token } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState('');

  function loadJobs() {
    api.get('/jobs').then(setJobs).catch((err) => setError(err.message));
  }

  useEffect(loadJobs, []);

  async function handleDelete(jobId) {
    if (!window.confirm('Delete this job posting? This also deletes its applications.')) return;
    try {
      await api.del(`/jobs/${jobId}`, token);
      loadJobs();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Job Postings</h1>
        <Link to="/admin/jobs/new">
          <button>
            <Plus size={16} />
            New Job
          </button>
        </Link>
      </div>
      {error && <p className="error">{error}</p>}

      {jobs.length === 0 ? (
        <div className="empty-state">
          {/* TODO: replace with generated illustration once available. Prompt:
              "Flat vector illustration, professional corporate style, blue
              and teal color palette (#1B4965, #5FA8A0), clean geometric
              shapes, minimal detail, no text or letters in the image,
              plenty of negative space, subtle and trustworthy tone, an
              empty open folder or inbox, calm and neutral, inviting first
              action" */}
          <Illustration name="empty-admin-jobs" alt="An empty folder" fallbackIcon={FolderOpen} />
          <p>No job postings yet. Create your first one to start accepting applications.</p>
          <Link to="/admin/jobs/new">
            <button>
              <Plus size={16} />
              New Job
            </button>
          </Link>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Location</th>
                <th>Posted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td>{job.title}</td>
                  <td>{job.location}</td>
                  <td>{new Date(job.created_at).toLocaleDateString()}</td>
                  <td className="table-actions">
                    <Link className="icon-button" to={`/admin/jobs/${job.id}/applicants`}>
                      <Users size={15} />
                      Applicants
                    </Link>
                    <Link className="icon-button" to={`/admin/jobs/${job.id}/edit`}>
                      <Pencil size={15} />
                      Edit
                    </Link>
                    <button className="icon-button danger" onClick={() => handleDelete(job.id)}>
                      <Trash2 size={15} />
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
