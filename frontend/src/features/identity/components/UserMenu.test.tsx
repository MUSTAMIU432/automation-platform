import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import type { AuthUser } from '../auth/authApi'
import { UserMenu } from './UserMenu'

const USER: AuthUser = {
  id: '1',
  email: 'admin@example.com',
  firstName: 'Pat',
  lastName: 'Admin',
  phoneNumber: '',
  isActive: true,
  isVerified: true,
  avatarUrl: null,
}

function openMenu(showActivity?: boolean) {
  render(
    <MemoryRouter>
      <UserMenu user={USER} onSignOut={vi.fn()} showActivity={showActivity} />
    </MemoryRouter>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Account menu' }))
  return screen.getAllByRole('menuitem').map((item) => item.textContent)
}

describe('UserMenu', () => {
  it('puts the console Activity page right under Profile for an administrator', () => {
    expect(openMenu(true)).toEqual([
      'Profile',
      'Activity',
      'Security',
      'Change password',
      'Sign out',
    ])
    expect(screen.getByRole('menuitem', { name: 'Activity' })).toHaveAttribute(
      'href',
      '/app/admin/activity',
    )
  })

  it('offers no Activity to anybody else', () => {
    expect(openMenu()).toEqual(['Profile', 'Security', 'Change password', 'Sign out'])
  })
})
