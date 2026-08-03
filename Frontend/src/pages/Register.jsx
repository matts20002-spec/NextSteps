import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { DoorOpen, AlertCircle } from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import Illustration from '../components/Illustration.jsx';

// Applicant self-registration. No email verification step -- the account
// is active immediately; this was cut from MVP scope to get hiring started
// faster (see README).
export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const { token, user } = await api.post('/auth/register', { username, email, password });
      login(token, user);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="form-page">
      <div className="form-page-hero">
        {/* TODO: replace with generated illustration once available. Prompt:
            "Flat vector illustration, professional corporate style, blue and
            teal color palette (#1B4965, #5FA8A0), clean geometric shapes,
            minimal detail, no text or letters in the image, plenty of
            negative space, subtle and trustworthy tone, a simple door or
            gateway opening onto a bright path, welcoming and secure feeling" */}
        <Illustration name="auth-gateway" alt="A door opening onto a bright path" fallbackIcon={DoorOpen} />
      </div>
      <h1>Register</h1>
      <form onSubmit={handleSubmit} className="form">
        <label>
          Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} required />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && (
          <p className="error">
            <AlertCircle size={16} />
            {error}
          </p>
        )}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating account...' : 'Create Account'}
        </button>
      </form>
      <p>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}
