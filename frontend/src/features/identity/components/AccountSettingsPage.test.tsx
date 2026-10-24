import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AccountSettingsPage } from './AccountSettingsPage'

const changePasswordMock = vi.fn()
const updateProfileMock = vi.fn()
const updateUserMock = vi.fn()
const uploadAvatarMock = vi.fn()

vi.mock('../auth/authApi', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  changePasswordRequest: (...args: unknown[]) => changePasswordMock(...args),
  updateProfileRequest: (...args: unknown[]) => updateProfileMock(...args),
  resendActivationEmailRequest: vi.fn(),
  uploadAvatarRequest: (...args: unknown[]) => uploadAvatarMock(...args),
  removeAvatarRequest: vi.fn(),
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: '1',
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      phoneNumber: '+255712345678',
      isActive: true,
      isVerified: true,
    },
    updateUser: updateUserMock,
  }),
}))

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/app/settings/:section" element={<AccountSettingsPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AccountSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // jsdom has no object URLs; the photo dialog previews the chosen file.
    URL.createObjectURL = vi.fn(() => 'blob:preview')
    URL.revokeObjectURL = vi.fn()
  })

  it('saves the profile and updates the signed-in user', async () => {
    const saved = { id: '1', firstName: 'Grace' }
    updateProfileMock.mockResolvedValue({
      success: true,
      message: 'Your profile has been updated.',
      field: null,
      user: saved,
    })
    renderAt('/app/settings/profile')

    fireEvent.change(screen.getByLabelText('First name'), {
      target: { value: 'Grace' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(updateUserMock).toHaveBeenCalledWith(saved))
    expect(updateProfileMock).toHaveBeenCalledWith({
      firstName: 'Grace',
      lastName: 'Lovelace',
      phoneNumber: '+255712345678',
    })
    expect(await screen.findByText('Your profile has been updated.')).toBeInTheDocument()
  })

  it('refuses mismatched passwords without calling the server', () => {
    renderAt('/app/settings/password')

    fireEvent.change(screen.getByLabelText('Current password'), {
      target: { value: 'old-pass-1' },
    })
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'new-pass-123' },
    })
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'different-123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }))

    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument()
    expect(changePasswordMock).not.toHaveBeenCalled()
  })

  it("shows the server's complaint next to the current password", async () => {
    changePasswordMock.mockResolvedValue({
      success: false,
      message: 'Your current password is incorrect.',
      field: 'currentPassword',
      user: null,
    })
    renderAt('/app/settings/password')

    fireEvent.change(screen.getByLabelText('Current password'), {
      target: { value: 'wrong-pass' },
    })
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'new-pass-123' },
    })
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'new-pass-123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }))

    expect(await screen.findByText('Your current password is incorrect.')).toBeInTheDocument()
  })

  it('shows email verification on the security tab', () => {
    renderAt('/app/settings/security')
    expect(screen.getByText('ada@example.com is confirmed.')).toBeInTheDocument()
  })

  it('refuses a photo that is not an image before uploading it', () => {
    renderAt('/app/settings/profile')

    const file = new File(['x'], 'cv.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText('Profile photo file'), {
      target: { files: [file] },
    })

    expect(screen.getByText('Choose a JPEG, PNG or WebP image.')).toBeInTheDocument()
    expect(uploadAvatarMock).not.toHaveBeenCalled()
  })

  function choosePhoto() {
    const file = new File(['x'], 'me.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('Profile photo file'), {
      target: { files: [file] },
    })
    return file
  }

  it('previews a valid photo in a dialog before uploading it', () => {
    renderAt('/app/settings/profile')
    choosePhoto()

    const dialog = screen.getByRole('dialog', { name: 'Your new profile photo' })
    expect(within(dialog).getByRole('img')).toHaveAttribute('src', 'blob:preview')
    expect(within(dialog).getByText(/me\.png/)).toBeInTheDocument()
    expect(uploadAvatarMock).not.toHaveBeenCalled()
  })

  it('uploads the previewed photo, puts its address on the user and shows it', async () => {
    uploadAvatarMock.mockResolvedValue({
      success: true,
      message: 'Your photo has been updated.',
      avatarUrl: '/users/1/avatar/?v=abc',
    })
    renderAt('/app/settings/profile')
    const file = choosePhoto()

    fireEvent.click(screen.getByRole('button', { name: 'Upload photo' }))

    const dialog = await screen.findByRole('dialog', { name: 'Profile photo updated' })
    expect(uploadAvatarMock).toHaveBeenCalledWith(file)
    expect(updateUserMock).toHaveBeenCalledWith(
      expect.objectContaining({ avatarUrl: '/users/1/avatar/?v=abc' }),
    )
    expect(within(dialog).getByAltText('Your new profile photo')).toBeInTheDocument()
    expect(within(dialog).getByText('Your photo has been updated.')).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows a refused upload inside the dialog so it can be retried', async () => {
    uploadAvatarMock.mockResolvedValue({
      success: false,
      message: 'That file is not a usable image.',
      avatarUrl: null,
    })
    renderAt('/app/settings/profile')
    choosePhoto()

    fireEvent.click(screen.getByRole('button', { name: 'Upload photo' }))

    const dialog = screen.getByRole('dialog')
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'That file is not a usable image.',
    )
    expect(within(dialog).getByRole('button', { name: 'Try again' })).toBeEnabled()
    expect(updateUserMock).not.toHaveBeenCalled()
  })

  it('closes the preview without uploading on Cancel or Escape', () => {
    renderAt('/app/settings/profile')

    choosePhoto()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    choosePhoto()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    expect(uploadAvatarMock).not.toHaveBeenCalled()
  })
})
