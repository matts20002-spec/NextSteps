import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

// Guards a route so it's only reachable when logged in.
// Pass adminOnly to additionally require the admin account.
export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (adminOnly && !user.isAdmin) {
    return <Navigate to="/" replace />;
  }
  return children;
}
