import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import HomePage from './pages/HomePage';
import BatchPage from './pages/BatchPage';
import HistoryPage from './pages/HistoryPage';
import StatisticsPage from './pages/StatisticsPage';
import ComparePage from './pages/ComparePage';
import SettingsPage from './pages/SettingsPage';
import ComplianceRulesPage from './pages/ComplianceRulesPage';
import ScheduledReportsPage from './pages/ScheduledReportsPage';
import WebhooksPage from './pages/WebhooksPage';
import NotificationsPage from './pages/NotificationsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import AuditLogPage from './pages/AuditLogPage';
import TeamsPage from './pages/TeamsPage';
import UsersPage from './pages/UsersPage';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route
            path="/*"
            element={
              <Layout>
                <Routes>
                  <Route path="/" element={<ProtectedRoute permission="analysis:write"><HomePage /></ProtectedRoute>} />
                  <Route path="/batch" element={<ProtectedRoute permission="analysis:write"><BatchPage /></ProtectedRoute>} />
                  <Route path="/history" element={<ProtectedRoute permission="analysis:read"><HistoryPage /></ProtectedRoute>} />
                  <Route path="/statistics" element={<ProtectedRoute permission="analysis:read"><StatisticsPage /></ProtectedRoute>} />
                  <Route path="/compare" element={<ProtectedRoute permission="analysis:read"><ComparePage /></ProtectedRoute>} />
                  <Route path="/compliance-rules" element={<ProtectedRoute permission="compliance:read"><ComplianceRulesPage /></ProtectedRoute>} />
                  <Route path="/scheduled-reports" element={<ProtectedRoute permission="integration:read"><ScheduledReportsPage /></ProtectedRoute>} />
                  <Route path="/webhooks" element={<ProtectedRoute permission="integration:read"><WebhooksPage /></ProtectedRoute>} />
                  <Route path="/notifications" element={<ProtectedRoute permission="integration:read"><NotificationsPage /></ProtectedRoute>} />
                  <Route path="/teams" element={<ProtectedRoute permission="user:read"><TeamsPage /></ProtectedRoute>} />
                  <Route path="/users" element={<ProtectedRoute permission="user:read"><UsersPage /></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
                  <Route path="/audit-log" element={<ProtectedRoute><AuditLogPage /></ProtectedRoute>} />
                </Routes>
              </Layout>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
