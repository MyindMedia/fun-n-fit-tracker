
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Leaderboard from './components/Leaderboard';
import AdminDashboard from './components/AdminDashboard';
import StudentLogin from './components/StudentLogin';
import ParentAuth from './components/ParentAuth';
import ParentDashboard from './components/ParentDashboard';
import ErrorBoundary from './components/ErrorBoundary';

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <HashRouter>
        <Routes>
          {/* Public routes (no Layout wrapper needed) */}
          <Route path="/parent-login" element={<ParentAuth />} />
          <Route path="/parent-dashboard" element={<ParentDashboard />} />

          {/* App routes with Layout */}
          <Route path="/*" element={
            <Layout>
              <Routes>
                <Route path="/" element={<Navigate to="/live" replace />} />
                <Route path="/live" element={<Leaderboard />} />
                <Route path="/admin" element={<AdminDashboard />} />
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
