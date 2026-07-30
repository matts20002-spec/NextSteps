import { Routes, Route } from 'react-router-dom';
import NavBar from './components/NavBar.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

import JobList from './pages/JobList.jsx';
import JobDetail from './pages/JobDetail.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import MyApplications from './pages/MyApplications.jsx';

import AdminJobs from './pages/admin/AdminJobs.jsx';
import AdminJobForm from './pages/admin/AdminJobForm.jsx';
import AdminApplicants from './pages/admin/AdminApplicants.jsx';

export default function App() {
  return (
    <div className="app">
      <NavBar />
      <main className="page">
        <Routes>
          <Route path="/" element={<JobList />} />
          <Route path="/jobs/:jobId" element={<JobDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route
            path="/my-applications"
            element={
              <ProtectedRoute>
                <MyApplications />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute adminOnly>
                <AdminJobs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/jobs/new"
            element={
              <ProtectedRoute adminOnly>
                <AdminJobForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/jobs/:jobId/edit"
            element={
              <ProtectedRoute adminOnly>
                <AdminJobForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/jobs/:jobId/applicants"
            element={
              <ProtectedRoute adminOnly>
                <AdminApplicants />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
