import { createBrowserRouter } from 'react-router-dom'

import { AuthPage } from '../features/identity/components/AuthPage'
import { ResetPasswordPage } from '../features/identity/components/ResetPasswordPage'
import { RootLayout } from '../layouts/RootLayout'
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
])
