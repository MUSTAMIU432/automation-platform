import { useState, type FormEvent } from 'react'

import { validateEmail } from '../schemas/authValidation'
import { SpinnerIcon } from './icons'
import { TextField } from './TextField'

interface ForgotPasswordFormProps {
  onBackToSignIn: () => void
}

type Status = 'idle' | 'submitting' | 'success'

const PRIMARY_BUTTON_CLASSES =
  'flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 text-sm font-semibold text-white shadow-sm shadow-brand-900/10 motion-safe:transition-colors motion-safe:duration-150 hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-brand-300 disabled:shadow-none'

/**
 * "Forgot password?" entry point's view. Renders in place of the Sign
 * In/Sign Up tabs and form — the same in-card swap pattern AuthTabs already
 * uses — rather than a modal, so the whole auth system reads as one
 * continuous form instead of a popup interrupting it.
 */
export function ForgotPasswordForm({ onBackToSignIn }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [attempted, setAttempted] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const isSubmitting = status === 'submitting'

  function handleEmailChange(value: string) {
    setEmail(value)
    if (attempted) {
      setError(validateEmail(value))
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAttempted(true)

    const emailError = validateEmail(email)
    setError(emailError)
    if (emailError) return

    setStatus('submitting')
    // Placeholder only: wired to the `requestPasswordReset` GraphQL mutation
    // once the Identity backend contract lands. The mutation always resolves
    // with the same generic result regardless of whether the email has an
    // account (see the success copy below), so showing that view here isn't
    // claiming anything the real backend won't also do — no email is
    // actually sent by this placeholder.
    window.setTimeout(() => setStatus('success'), 400)
  }

  if (status === 'success') {
    return (
      <div>
        <h1 className="text-[26px] font-bold tracking-tight text-gray-900">Check your email</h1>
        <p className="mt-2 text-sm text-gray-500">
          If an account exists for that email, we&apos;ve sent instructions to reset your password.
        </p>
        <button type="button" onClick={onBackToSignIn} className={`mt-7 ${PRIMARY_BUTTON_CLASSES}`}>
          Back to Sign In
        </button>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-[26px] font-bold tracking-tight text-gray-900">Reset your password</h1>
      <p className="mt-2 text-sm text-gray-500">
        Enter your email and we&apos;ll send you a secure password reset link.
      </p>

      <form noValidate onSubmit={handleSubmit} aria-busy={isSubmitting} className="mt-7 space-y-5">
        <TextField
          id="forgot-password-email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={handleEmailChange}
          error={error}
          placeholder="you@company.com"
          disabled={isSubmitting}
        />

        <button type="submit" disabled={isSubmitting} className={PRIMARY_BUTTON_CLASSES}>
          {isSubmitting && <SpinnerIcon className="h-4 w-4 motion-safe:animate-spin" />}
          <span>{isSubmitting ? 'Sending…' : 'Send reset link'}</span>
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        <button
          type="button"
          onClick={onBackToSignIn}
          className="inline-flex items-center gap-1.5 font-semibold text-brand-700 hover:text-brand-800 focus:outline-none focus-visible:underline"
        >
          <span aria-hidden="true">←</span> Back to Sign In
        </button>
      </p>
    </div>
  )
}
