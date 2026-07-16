
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, useUser } from '@clerk/clerk-react';
import Layout from './components/Layout';
import Landing from './components/Landing';
import ParentGuide from './components/ParentGuide';
import Leaderboard from './components/Leaderboard';
import AdminDashboard from './components/AdminDashboard';
import StudentLogin from './components/StudentLogin';
import PortalGate from './components/PortalGate';
import ParentDashboard from './components/ParentDashboard';
import ErrorBoundary from './components/ErrorBoundary';
import { isAdminUser } from './services/adminAccess';

// /admin is only for signed-in Clerk users with the admin role; everyone else
// is sent to the Portal sign-in.
const AdminGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  if (!isLoaded) {
    return (
      <div className="pz-scope flex items-center justify-center min-h-[50vh]" style={{ color: 'var(--pz-text)' }}>
        Loading…
      </div>
    );
  }
  if (!isSignedIn || !isAdminUser(user)) {
    return <Navigate to="/parent-login" replace />;
  }
  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <HashRouter>
        <Routes>
          {/* Public routes (no Layout wrapper needed) */}
          <Route path="/" element={<Landing />} />
          <Route path="/parents" element={<ParentGuide />} />
          <Route path="/parent-login" element={<PortalGate />} />
          <Route path="/parent-dashboard" element={<ParentDashboard />} />

          {/* App routes with Layout */}
          <Route path="/*" element={
            <Layout>
              <Routes>
                <Route path="/live" element={<Leaderboard />} />
                <Route path="/admin" element={<AdminGuard><AdminDashboard /></AdminGuard>} />
                <Route path="/login" element={<StudentLogin />} />
              </Routes>
            </Layout>
          } />
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  );
};

export default App;
