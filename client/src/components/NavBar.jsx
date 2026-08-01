import { Link, useNavigate } from 'react-router-dom';
import { Briefcase, FileText, LayoutDashboard, LogOut } from 'lucide-react';
import { useAuth } from '../auth/AuthContext.jsx';

export default function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <Briefcase size={20} />
        <span className="navbar-brand-text">
          NextStep
          <span className="navbar-tagline">Your next step starts here</span>
        </span>
      </Link>
      <div className="navbar-links">
        <Link to="/">
          <Briefcase size={16} />
          Jobs
        </Link>
        {user && !user.isAdmin && (
          <Link to="/my-applications">
            <FileText size={16} />
            My Applications
          </Link>
        )}
        {user?.isAdmin && (
          <Link to="/admin">
            <LayoutDashboard size={16} />
            Admin
          </Link>
        )}
        {user ? (
          <span className="navbar-user">
            Hi, {user.username}
            <button className="icon-button navbar-logout" onClick={handleLogout}>
              <LogOut size={16} />
              Log out
            </button>
          </span>
        ) : (
          <>
            <Link to="/login">Log in</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}
