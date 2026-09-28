import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState } from './ui';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAuth?: boolean;
  /** The permission the page needs. Without it the user is sent somewhere they can actually use. */
  permission?: string;
}

/** Where to send someone who has no rights to the page they asked for. */
const FALLBACK = '/history';

export default function ProtectedRoute({ children, requireAuth = true, permission }: ProtectedRouteProps) {
  const { isAuthenticated, loading, user, hasPermission } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingState label="Checking your session…" className="min-h-[50vh]" />;
  }

  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.must_change_password && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  if (permission && !hasPermission(permission) && location.pathname !== FALLBACK) {
    return <Navigate to={FALLBACK} replace />;
  }

  return <>{children}</>;
}
