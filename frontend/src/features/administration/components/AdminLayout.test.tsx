import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { NO_ADMIN_CAPABILITIES } from '../api/administrationApi'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { AdminCapabilitiesContext } from '../context/AdminCapabilitiesContext'
import { FULL_ADMIN, renderAdminPage } from '../../../test/renderAdmin'
import { AdminLayout } from './AdminLayout'

vi.mock('../api/administrationApi', async (importOriginal) => ({
  ...(await importOriginal()),
  adminOverviewRequest: vi.fn(),
}))

const { adminOverviewRequest } = await import('../api/administrationApi')

/**
 * The console's presentational gate. The server is the security boundary -
 * these tests pin that a non-administrator is sent to their dashboard and the
 * console's pages are never mounted (so never ask for data), not that this
 * component keeps anyone out of the API.
 */
describe('AdminLayout', () => {
  it('sends a user who is not a platform administrator to their dashboard', () => {
    render(
      <AdminCapabilitiesContext.Provider
        value={{ status: 'ready', capabilities: NO_ADMIN_CAPABILITIES, reload: () => {} }}
      >
        <MemoryRouter initialEntries={['/app/admin/users']}>
          <Routes>
            <Route path="/app/admin/*" element={<AdminLayout />} />
            <Route path="/app" element={<p>Dashboard</p>} />
          </Routes>
        </MemoryRouter>
      </AdminCapabilitiesContext.Provider>,
    )

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.queryByText('Not authorized')).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Administration' })).not.toBeInTheDocument()
    expect(adminOverviewRequest).not.toHaveBeenCalled()
  })

  it('shows the administration navigation to an administrator', () => {
    renderAdminPage(<AdminLayout />, { capabilities: FULL_ADMIN })

    const nav = screen.getByRole('navigation', { name: 'Administration' })
    for (const label of [
      'Dashboard',
      'Users',
      'Organizations',
      'Customer ideas',
      'Platform ideas',
      'Reviews',
      'Reviewers',
      'Platform roles',
      'Categories',
    ]) {
      expect(nav).toHaveTextContent(label)
    }
    expect(screen.queryByText('Not authorized')).not.toBeInTheDocument()
  })

  describe('navigation', () => {
    beforeEach(() => window.localStorage.clear())

    it('gives every section an icon, under a named group', () => {
      renderAdminPage(<AdminLayout />, { capabilities: FULL_ADMIN })

      const nav = screen.getByRole('navigation', { name: 'Administration' })
      const links = within(nav).getAllByRole('link')
      expect(links).toHaveLength(20)
      for (const link of links) expect(link.querySelector('svg')).not.toBeNull()
      for (const group of [
        'Overview',
        'Accounts',
        'Review workflow',
        'Marketplace',
        'Learning',
        'Communication',
      ]) {
        expect(within(nav).getByText(group)).toBeInTheDocument()
      }
    })

    it('marks the section you are on and names it on the narrow-screen menu', () => {
      renderAdminPage(<AdminLayout />, {
        path: '/app/admin/users/5',
        pattern: '/app/admin/users/:id',
        capabilities: FULL_ADMIN,
      })

      expect(screen.getByRole('link', { name: 'Users' })).toHaveAttribute('aria-current', 'page')
      const menu = screen.getByRole('button', { name: /Users\s*Menu/ })
      expect(menu).toHaveAttribute('aria-expanded', 'false')
      fireEvent.click(menu)
      expect(menu).toHaveAttribute('aria-expanded', 'true')
    })

    it('is the administrator’s home: there is no way back to a workspace', () => {
      renderAdminPage(<AdminLayout />, { capabilities: FULL_ADMIN })

      expect(screen.queryByRole('link', { name: 'Back to workspace' })).toBeNull()
      expect(screen.getByRole('heading', { name: 'Administration' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Platform ideas' })).toHaveAttribute(
        'href',
        '/app/admin/marketplace/ideas',
      )
    })

    it('keeps a shared entry current on every one of its tabbed pages', () => {
      renderAdminPage(<AdminLayout />, {
        path: '/app/admin/approvals',
        pattern: '/app/admin/approvals',
        capabilities: FULL_ADMIN,
      })

      expect(screen.getByRole('link', { name: 'Reviews' })).toHaveAttribute('aria-current', 'page')
      expect(screen.getByRole('link', { name: 'Customer ideas' })).not.toHaveAttribute(
        'aria-current',
      )
      expect(screen.queryByRole('link', { name: 'Approvals' })).not.toBeInTheDocument()
    })

    it('collapses to an icon rail that still names each link, and remembers it', () => {
      const { unmount } = renderAdminPage(<AdminLayout />, { capabilities: FULL_ADMIN })

      fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))

      const users = screen.getByRole('link', { name: 'Users' })
      expect(users).toHaveAttribute('title', 'Users')
      expect(window.localStorage.getItem('admin.sidebar.collapsed')).toBe('1')

      unmount()
      renderAdminPage(<AdminLayout />, { capabilities: FULL_ADMIN })
      fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }))
      expect(screen.getByRole('link', { name: 'Users' })).not.toHaveAttribute('title')
      expect(window.localStorage.getItem('admin.sidebar.collapsed')).toBe('0')
    })
  })

  it('waits for the access check rather than flashing a verdict', () => {
    renderAdminPage(<AdminLayout />, { status: 'loading', capabilities: NO_ADMIN_CAPABILITIES })

    expect(screen.getByText('Checking administrator access…')).toBeInTheDocument()
    expect(screen.queryByText('Not authorized')).not.toBeInTheDocument()
  })

  it('says it could not check, rather than "not allowed", when the check fails', () => {
    renderAdminPage(<AdminLayout />, { status: 'error', capabilities: NO_ADMIN_CAPABILITIES })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'We could not check your administrator access.',
    )
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})
