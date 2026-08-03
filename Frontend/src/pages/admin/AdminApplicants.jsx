import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download, Send, XCircle, AlertCircle } from 'lucide-react';
import { api } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';

// Admin view of every applicant who applied to a single job posting, with
// per-applicant actions: download résumé, send interview invite, send rejection.
//
// "Send Interview Invitation" and "Send Rejection" are deliberately styled
// with different weight: interview is a confident, filled teal button
// (accent), rejection is a plain outlined button. Both are normal business
// actions -- rejection isn't styled as "destructive" (i.e. not a loud red
// button), since it's not a delete operation.
export default function AdminApplicants() {
  const { jobId } = useParams();
  const { token } = useAuth();

  const [job, setJob] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [error, setError] = useState('');
  const [actionInProgress, setActionInProgress] = useState(null); // applicationId currently being acted on

  function loadApplicants() {
    api
      .get(`/admin/jobs/${jobId}/applicants`, token)
      .then(setApplicants)
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    api.get(`/jobs/${jobId}`).then(setJob).catch((err) => setError(err.message));
    loadApplicants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  async function handleDownloadResume(applicationId) {
    try {
      const { url } = await api.get(`/admin/applications/${applicationId}/resume`, token);
      window.open(url, '_blank');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSendInterview(applicationId) {
    setActionInProgress(applicationId);
    setError('');
    try {
      await api.post(`/admin/applications/${applicationId}/send-interview`, {}, token);
      loadApplicants();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleSendRejection(applicationId) {
    setActionInProgress(applicationId);
    setError('');
    try {
      await api.post(`/admin/applications/${applicationId}/send-rejection`, {}, token);
      loadApplicants();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionInProgress(null);
    }
  }

  return (
    <div>
      <Link to="/admin" className="icon-button back-link">
        <ArrowLeft size={15} />
        Back to job postings
      </Link>
      <h1>Applicants{job ? `: ${job.title}` : ''}</h1>
      {error && (
        <p className="error">
          <AlertCircle size={16} />
          {error}
        </p>
      )}
      {applicants.length === 0 && <p>No applicants yet.</p>}

      {applicants.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Email</th>
                <th>Status</th>
                <th>Résumé</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {applicants.map((applicant) => {
                const isBusy = actionInProgress === applicant.id;
                return (
                  <tr key={applicant.id}>
                    <td>{applicant.username}</td>
                    <td>{applicant.email}</td>
                    <td>
                      <StatusBadge status={applicant.status} />
                    </td>
                    <td>
                      <button className="icon-button" onClick={() => handleDownloadResume(applicant.id)}>
                        <Download size={15} />
                        Download
                      </button>
                    </td>
                    <td className="table-actions">
                      <button
                        className="accent small"
                        disabled={isBusy}
                        onClick={() => handleSendInterview(applicant.id)}
                      >
                        <Send size={14} />
                        Send Interview Invite
                      </button>
                      <button
                        className="outline small"
                        disabled={isBusy}
                        onClick={() => handleSendRejection(applicant.id)}
                      >
                        <XCircle size={14} />
                        Send Rejection
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
