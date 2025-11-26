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
import TeamsPage from './pages/TeamsPage';
import UsersPage from './pages/UsersPage';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/*"
            element={
              <Layout>
                <Routes>
                  <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
                  <Route path="/batch" element={<ProtectedRoute><BatchPage /></ProtectedRoute>} />
                  <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
                  <Route path="/statistics" element={<ProtectedRoute><StatisticsPage /></ProtectedRoute>} />
                  <Route path="/compare" element={<ProtectedRoute><ComparePage /></ProtectedRoute>} />
                  <Route path="/compliance-rules" element={<ProtectedRoute><ComplianceRulesPage /></ProtectedRoute>} />
                  <Route path="/scheduled-reports" element={<ProtectedRoute><ScheduledReportsPage /></ProtectedRoute>} />
                  <Route path="/webhooks" element={<ProtectedRoute><WebhooksPage /></ProtectedRoute>} />
                  <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
                  <Route path="/teams" element={<ProtectedRoute><TeamsPage /></ProtectedRoute>} />
                  <Route path="/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
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
