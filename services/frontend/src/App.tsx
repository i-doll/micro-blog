import React from 'react';
import { createHashRouter, Outlet, useParams, Navigate } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { QueryClientProvider } from '@tanstack/react-query';
import * as stylex from '@stylexjs/stylex';
import { colors, fonts, easings } from './theme/tokens.stylex';
import { queryClient } from './lib/queryClient';
import { queryKeys } from './lib/queryKeys';
import * as postsApi from './api/posts';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ToastContainer } from './components/ui/Toast';
import { Header } from './components/layout/Header';
import { RequireAuth } from './components/layout/RequireAuth';
import { HomePage } from './pages/HomePage';
import { PostPage } from './pages/PostPage';
import { SearchPage } from './pages/SearchPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ComposePage } from './pages/ComposePage';
import { EditPage } from './pages/EditPage';
import { ProfilePage } from './pages/ProfilePage';
import { HealthPage } from './pages/HealthPage';
import { AdminPage } from './pages/admin/AdminPage';

const layoutStyles = stylex.create({
  body: {
    fontFamily: fonts.body,
    background: colors.bgPrimary,
    color: colors.textPrimary,
    lineHeight: 1.7,
    transition: 'none',
    minHeight: '100vh',
    WebkitFontSmoothing: 'antialiased',
  },
  main: {
    padding: '2rem 0 4rem',
    minHeight: 'calc(100vh - 140px)',
  },
  link: {
    color: colors.accent,
    textDecoration: 'none',
    transition: 'color 0.2s',
  },
});

// Catch-all: redirect old-style hash paths (#home → #/, #post/id → #/post/id)
function CatchAllRedirect() {
  const { '*': splat } = useParams();
  const path = splat || '';

  if (path === 'home') {
    return <Navigate to="/" replace />;
  }
  // All other unmatched paths: try prepending / (covers post/id, edit/id, etc.)
  // If still no match, the router will 404 naturally
  return <Navigate to="/" replace />;
}

function Layout() {
  return (
    <div {...stylex.props(layoutStyles.body)}>
      <Header />
      <main {...stylex.props(layoutStyles.main)}>
        <Outlet />
      </main>
      <ToastContainer />
    </div>
  );
}

const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      {
        path: 'post/:id',
        loader: ({ params }) =>
          queryClient.prefetchQuery({
            queryKey: queryKeys.posts.detail(params.id!),
            queryFn: () => postsApi.getPost(params.id!),
          }),
        element: <PostPage />,
      },
      { path: 'search', element: <SearchPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      {
        path: 'compose',
        element: (
          <RequireAuth roles={['writer', 'admin']}>
            <ComposePage />
          </RequireAuth>
        ),
      },
      {
        path: 'edit/:id',
        element: (
          <RequireAuth roles={['writer', 'admin']}>
            <EditPage />
          </RequireAuth>
        ),
      },
      {
        path: 'profile',
        element: (
          <RequireAuth>
            <ProfilePage />
          </RequireAuth>
        ),
      },
      {
        path: 'admin',
        element: (
          <RequireAuth roles={['writer', 'admin']}>
            <AdminPage />
          </RequireAuth>
        ),
      },
      { path: 'health', element: <HealthPage /> },
      { path: '*', element: <CatchAllRedirect /> },
    ],
  },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
