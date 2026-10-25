import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setAccessToken } from '../../graphql/tokenStore'
import { renderWithProviders } from '../../test/renderWithRouter'
import { meRequest, refreshTokenRequest } from '../identity/auth/authApi'
import { sendContactMessageRequest } from './api/contactApi'
import { platformStatsRequest } from './api/statsApi'
import { LandingPage } from './components/LandingPage'

import type * as AuthApiModule from '../identity/auth/authApi'

vi.mock('../identity/auth/authApi', async (importOriginal) => ({
  ...(await importOriginal<typeof AuthApiModule>()),
  loginRequest: vi.fn(),
  googleLoginRequest: vi.fn(),
  logoutRequest: vi.fn(),
  refreshTokenRequest: vi.fn(),
  meRequest: vi.fn(),
}))
vi.mock('./api/contactApi', () => ({ sendContactMessageRequest: vi.fn() }))
vi.mock('./api/statsApi', () => ({ platformStatsRequest: vi.fn() }))

const mockedRefresh = vi.mocked(refreshTokenRequest)
const mockedMe = vi.mocked(meRequest)
const mockedSend = vi.mocked(sendContactMessageRequest)
const mockedStats = vi.mocked(platformStatsRequest)

const USER = {
  id: '1',
  email: 'ada@example.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  phoneNumber: '',
  isActive: true,
  isVerified: true,
}

function header() {
  return screen.getByRole('banner')
}

function contactForm() {
  return within(screen.getByRole('region', { name: 'Talk to the MUSTANET team' }))
}

function fillContact(values: Partial<Record<'Name' | 'Email' | 'Subject' | 'Message', string>>) {
  for (const [label, value] of Object.entries(values)) {
    fireEvent.change(contactForm().getByLabelText(label), { target: { value } })
  }
}

describe('LandingPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    setAccessToken(null)
    mockedRefresh.mockResolvedValue({ success: false, message: 'no session', session: null })
    mockedMe.mockResolvedValue(null)
    mockedStats.mockResolvedValue({
      ideasSubmitted: 12,
      organizations: 3,
      projects: 4,
      activeUsers: 57,
      reviewsCompleted: 9,
    })
  })

  afterEach(() => {
    setAccessToken(null)
  })

  it('says what the platform is in the first screen', () => {
    renderWithProviders(<LandingPage />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'From Real Problems to Real Solutions' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/MUSTANET is an AI-assisted platform/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Explore Services' })).toHaveAttribute(
      'href',
      '#services',
    )
  })

  it('links every header section to a section on the page', () => {
    renderWithProviders(<LandingPage />)

    const nav = within(screen.getByRole('navigation', { name: 'Main' }))
    for (const [label, id] of [
      ['Home', 'home'],
      ['Services', 'services'],
      ['About', 'about'],
      ['How It Works', 'how-it-works'],
      ['Contact', 'contact'],
    ]) {
      expect(nav.getByRole('link', { name: label })).toHaveAttribute('href', `#${id}`)
      expect(document.getElementById(id)).not.toBeNull()
    }
  })

  it('sends a visitor to the real sign-in and sign-up views', () => {
    renderWithProviders(<LandingPage />)

    expect(within(header()).getByRole('link', { name: 'Sign In' })).toHaveAttribute('href', '/auth')
    expect(within(header()).getByRole('link', { name: 'Sign Up' })).toHaveAttribute(
      'href',
      '/auth?mode=sign-up',
    )
    expect(screen.getByRole('link', { name: 'Get Started' })).toHaveAttribute(
      'href',
      '/auth?mode=sign-up',
    )
  })

  it('offers a signed-in visitor their workspace instead of signing in again', async () => {
    mockedRefresh.mockResolvedValue({
      success: true,
      message: 'ok',
      session: { accessToken: 'token', accessTokenExpiresAt: '2099-01-01', user: USER },
    })
    mockedMe.mockResolvedValue(USER)

    renderWithProviders(<LandingPage />)

    expect(
      await within(header()).findByRole('link', { name: 'Open your workspace' }),
    ).toHaveAttribute('href', '/app')
    expect(within(header()).queryByRole('link', { name: 'Sign In' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Get Started' })).toHaveAttribute('href', '/app')
  })

  it('opens and closes the mobile menu, closing it after a choice', () => {
    renderWithProviders(<LandingPage />)

    const toggle = screen.getByRole('button', { name: 'Open menu' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)

    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    const menu = within(screen.getByRole('navigation', { name: 'Mobile' }))
    fireEvent.click(menu.getByRole('link', { name: 'Services' }))

    expect(screen.queryByRole('navigation', { name: 'Mobile' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open menu' })).toBeInTheDocument()
  })

  it("shows the platform's real figures, not invented ones", async () => {
    renderWithProviders(<LandingPage />)

    const figures = within(
      screen.getByRole('heading', { name: 'MUSTANET in numbers' }).parentElement!,
    )
    expect(await figures.findByText('12')).toBeInTheDocument()
    expect(figures.getByText('Ideas Submitted')).toBeInTheDocument()
    expect(figures.getByText('57')).toBeInTheDocument()
    expect(figures.getByText('3')).toBeInTheDocument()
    expect(figures.getByText('4')).toBeInTheDocument()
    expect(screen.queryByText(/\d+\+/)).not.toBeInTheDocument()
  })

  it('shows a dash rather than a number when the figures cannot be fetched', async () => {
    mockedStats.mockRejectedValue(new TypeError('Failed to fetch'))
    renderWithProviders(<LandingPage />)

    const figures = within(
      screen.getByRole('heading', { name: 'MUSTANET in numbers' }).parentElement!,
    )
    await waitFor(() => expect(mockedStats).toHaveBeenCalled())
    expect(figures.getAllByText('—')).toHaveLength(4)
  })

  describe('contact form', () => {
    it('refuses an empty form without sending anything', () => {
      renderWithProviders(<LandingPage />)

      fireEvent.click(contactForm().getByRole('button', { name: 'Send message' }))

      expect(contactForm().getByText('Name is required.')).toBeInTheDocument()
      expect(contactForm().getByText('Email is required.')).toBeInTheDocument()
      expect(contactForm().getByText('Subject is required.')).toBeInTheDocument()
      expect(contactForm().getByText('Message is required.')).toBeInTheDocument()
      expect(mockedSend).not.toHaveBeenCalled()
    })

    it('refuses a malformed email address', () => {
      renderWithProviders(<LandingPage />)

      fillContact({ Name: 'Ada', Email: 'ada@', Subject: 'Hi', Message: 'Hello' })
      fireEvent.click(contactForm().getByRole('button', { name: 'Send message' }))

      expect(contactForm().getByText('Enter a valid email address.')).toBeInTheDocument()
      expect(mockedSend).not.toHaveBeenCalled()
    })

    it('reports a message as sent only once the backend has stored it', async () => {
      let resolve!: (value: Awaited<ReturnType<typeof sendContactMessageRequest>>) => void
      mockedSend.mockReturnValue(new Promise((r) => (resolve = r)))
      renderWithProviders(<LandingPage />)

      fillContact({
        Name: ' Ada ',
        Email: 'ada@example.com',
        Subject: 'Partnership',
        Message: 'Hello',
      })
      fireEvent.click(contactForm().getByRole('button', { name: 'Send message' }))

      expect(contactForm().getByRole('button', { name: 'Sending…' })).toBeDisabled()
      expect(contactForm().queryByText('Message sent')).not.toBeInTheDocument()
      expect(mockedSend).toHaveBeenCalledWith({
        name: 'Ada',
        email: 'ada@example.com',
        subject: 'Partnership',
        message: 'Hello',
      })

      resolve({ success: true, message: 'Thank you.', field: null })

      expect(await contactForm().findByText('Message sent')).toBeInTheDocument()
      expect(contactForm().getByText('Thank you.')).toBeInTheDocument()
    })

    it("shows the backend's refusal next to its field and keeps the text", async () => {
      mockedSend.mockResolvedValue({
        success: false,
        message: 'Enter a valid email address.',
        field: 'email',
      })
      renderWithProviders(<LandingPage />)

      fillContact({ Name: 'Ada', Email: 'ada@example.co', Subject: 'Hi', Message: 'Hello' })
      fireEvent.click(contactForm().getByRole('button', { name: 'Send message' }))

      await waitFor(() => expect(contactForm().getByLabelText('Email')).toBeInvalid())
      expect(contactForm().getByText(/Not sent\./)).toBeInTheDocument()
      expect(contactForm().getByLabelText('Message')).toHaveValue('Hello')
    })

    it('says so when the server cannot be reached', async () => {
      mockedSend.mockRejectedValue(new TypeError('Failed to fetch'))
      renderWithProviders(<LandingPage />)

      fillContact({ Name: 'Ada', Email: 'ada@example.com', Subject: 'Hi', Message: 'Hello' })
      fireEvent.click(contactForm().getByRole('button', { name: 'Send message' }))

      expect(
        await contactForm().findByText('We could not reach the server. Please try again.'),
      ).toBeInTheDocument()
      expect(contactForm().queryByText('Message sent')).not.toBeInTheDocument()
      expect(contactForm().getByLabelText('Subject')).toHaveValue('Hi')
    })
  })
})
