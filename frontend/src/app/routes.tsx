import { createBrowserRouter } from 'react-router-dom'

import { RootLayout } from '../layouts/RootLayout'
import { HomePage } from '../routes/HomePage'
import { NotFoundPage } from '../routes/NotFoundPage'

/**
 * Route tree for the app. Future business domains (identity, organizations,
 * ideas, ...) each get their own route module under src/features/<domain>
 * and are wired in here — none exist yet.
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
])
