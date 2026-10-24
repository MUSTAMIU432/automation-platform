import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { renderAdminPage } from '../../../test/renderAdmin'
import { ReviewTabsLayout } from './AdminSectionTabs'

describe('AdminSectionTabs', () => {
  it('puts Reviews, Approvals and Decisions side by side and marks the open one', () => {
    renderAdminPage(<ReviewTabsLayout />, {
      path: '/app/admin/decisions',
      pattern: '/app/admin/decisions',
    })

    const tabs = screen.getByRole('navigation', { name: 'Reviews' })
    const links = within(tabs).getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual(['Reviews', 'Approvals', 'Decisions'])
    expect(within(tabs).getByRole('link', { name: 'Decisions' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(tabs).getByRole('link', { name: 'Approvals' })).toHaveAttribute(
      'href',
      '/app/admin/approvals',
    )
  })
})
