import { render } from '@testing-library/react'
import type { RouteObject } from 'react-router-dom'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'

/** Render a route tree at `path` using an in-memory router (no real browser history). */
export function renderRoutes(routes: RouteObject[], path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(<RouterProvider router={router} />)
}
