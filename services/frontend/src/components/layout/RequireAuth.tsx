import React from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '../../hooks/useAuth';

interface RequireAuthProps {
  roles?: string[];
  children: React.ReactNode;
}

export function RequireAuth({ roles, children }: RequireAuthProps) {
  const { user, token } = useAuth();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
