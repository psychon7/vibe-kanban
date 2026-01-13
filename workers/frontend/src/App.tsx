import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { WorkspaceProvider } from './contexts/WorkspaceContext';
import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';
import DashboardPage from './pages/DashboardPage';
import MembersPage from './pages/settings/MembersPage';
import PromptTemplatesPage from './pages/settings/PromptTemplatesPage';
import PromptSettingsPage from './pages/settings/PromptSettingsPage';
import AuditLogPage from './pages/settings/AuditLogPage';
import ProjectBoardPage from './pages/projects/ProjectBoardPage';
import Layout from './components/Layout';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return user ? <>{children}</> : <Navigate to="/auth/login" replace />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return user ? <Navigate to="/" replace /> : <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/auth/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/auth/signup"
        element={
          <PublicRoute>
            <SignupPage />
          </PublicRoute>
        }
      />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout>
              <DashboardPage />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/projects/:projectId"
        element={
          <PrivateRoute>
            <Layout>
              <ProjectBoardPage />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/settings/members"
        element={
          <PrivateRoute>
            <Layout>
              <MembersPage />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/settings/prompt-templates"
        element={
          <PrivateRoute>
            <Layout>
              <PromptTemplatesPage />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/settings/prompt-settings"
        element={
          <PrivateRoute>
            <Layout>
              <PromptSettingsPage />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/settings/audit-log"
        element={
          <PrivateRoute>
            <Layout>
              <AuditLogPage />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WorkspaceProvider>
          <AppRoutes />
        </WorkspaceProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
