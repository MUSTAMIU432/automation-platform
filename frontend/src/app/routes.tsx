import { createBrowserRouter } from 'react-router-dom'

import { AuthPage } from '../features/identity/components/AuthPage'
import { RequireAuth } from '../features/identity/components/RequireAuth'
import { ResetPasswordPage } from '../features/identity/components/ResetPasswordPage'
import { RootLayout } from '../layouts/RootLayout'
import { DashboardPage } from '../routes/DashboardPage'
import { HomePage } from '../routes/HomePage'
import { NotFoundPage } from '../routes/NotFoundPage'

/**
 * Route tree for the app. Future business domains (identity, organizations,
 * ideas, ...) each get their own route module under src/features/<domain>
 * and are wired in here.
 *
 * /auth and /reset-password are top-level routes rather than RootLayout
 * children: the auth system owns the full viewport (split-screen brand +
 * form panel) instead of sitting inside the shared app shell/header.
 *
 * /app is the authenticated application area, gated by RequireAuth - it
 * redirects to /auth when there's no authenticated session.
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  { path: '/auth', element: <AuthPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  {
    path: '/app',
    element: <RequireAuth />,
    children: [{ index: true, element: <DashboardPage /> }],
  },
])
