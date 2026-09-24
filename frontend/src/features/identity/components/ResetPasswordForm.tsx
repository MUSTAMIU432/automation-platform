import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { validateResetPassword, hasErrors, type FieldErrors } from '../schemas/authValidation'
import type { ResetPasswordFormValues } from '../types/auth'
import { PasswordField } from './PasswordField'
import { SpinnerIcon } from './icons'

const INITIAL_VALUES: ResetPasswordFormValues = { password: '', confirmPassword: '' }

type Status = 'idle' | 'submitting' | 'success' | 'error'

const PRIMARY_BUTTON_CLASSES =
  'flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 text-sm font-semibold text-white shadow-sm shadow-brand-900/10 motion-safe:transition-colors motion-safe:duration-150 hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-brand-300 disabled:shadow-none'

/**
 * Shown once the real `resetPassword` mutation resolves successfully. Not
 * yet reachable from the live form below: unlike the forgot-password
 * flow's generic message, "your password has been reset" is a definite
 * claim about a security-sensitive action, so this task doesn't wire the
 * placeholder submit to fake reaching it. Built and tested in isolation so
 * it's ready the moment the real mutation lands.
 */
export function ResetPasswordSuccessView() {
  return (
    <div>
      <h1 className="text-[26px] font-bold tracking-tight text-gray-900">Password reset</h1>
      <p className="mt-2 text-sm text-gray-500">Your password has been reset successfully.</p>
      <Link to="/auth" className={`mt-6 ${PRIMARY_BUTTON_CLASSES}`}>
        Sign In
      </Link>
    </div>
  )
}

/**
 * Shown once the real mutation rejects with an unexpected error (not an
 * invalid-token error, which gets its own view below). Not yet reachable
 * from the live form — see ResetPasswordSuccessView.
 */
export function ResetPasswordErrorView({ onRetry }: { onRetry: () => void }) {
  return (
    <div>
      <h1 className="text-[26px] font-bold tracking-tight text-gray-900">Something went wrong</h1>
      <p className="mt-2 text-sm text-gray-500">Something went wrong. Please try again.</p>
      <button type="button" onClick={onRetry} className={`mt-6 ${PRIMARY_BUTTON_CLASSES}`}>
        Try again
      </button>
    </div>
  )
}

/**
 * Shown when the URL has no `token` param at all. Unlike the success/error
 * views, this is legitimately reachable right now without a backend — it's
 * a client-side check of the URL's shape, not a claim about the token's
 * validity, which is why item 6 can ask for the token to be read from the
 * URL without asking us to validate it against the server yet.
 */
export function ResetPasswordInvalidTokenView() {
  return (
    <div>
      <h1 className="text-[26px] font-bold tracking-tight text-gray-900">Link invalid</h1>
      <p className="mt-2 text-sm text-gray-500">
        This password reset link is invalid or has expired.
      </p>
      <Link to="/auth" className={`mt-6 ${PRIMARY_BUTTON_CLASSES}`}>
        Request a new reset link
      </Link>
    </div>
  )
}

/**
 * The /reset-password form. Reads `?token=` from the URL (structurally
 * ready for the real flow) but does not validate it against the backend —
 * that lands with the real `resetPassword` mutation in a later task.
 */
export function ResetPasswordForm() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [values, setValues] = useState<ResetPasswordFormValues>(INITIAL_VALUES)
  const [errors, setErrors] = useState<FieldErrors<ResetPasswordFormValues>>({})
  const [attempted, setAttempted] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const isSubmitting = status === 'submitting'

  function updateField<K extends keyof ResetPasswordFormValues>(
    field: K,
    value: ResetPasswordFormValues[K],
  ) {
    const next = { ...values, [field]: value }
    setValues(next)
    if (attempted) {
      setErrors(validateResetPassword(next))
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAttempted(true)

    const nextErrors = validateResetPassword(values)
    setErrors(nextErrors)
    if (hasErrors(nextErrors)) return

    setStatus('submitting')
    // Placeholder only: wired to the `resetPassword` GraphQL mutation once
    // the Identity backend contract lands. That mutation's `.then()` /
    // `.catch()` will call setStatus('success') / setStatus('error') in
    // place of this timeout — intentionally not faked here, since "your
    // password has been reset" is a definite claim this placeholder can't
    // honestly make.
    window.setTimeout(() => setStatus('idle'), 400)
  }

  if (!token) {
    return <ResetPasswordInvalidTokenView />
  }

  if (status === 'success') {
    return <ResetPasswordSuccessView />
  }

  if (status === 'error') {
    return <ResetPasswordErrorView onRetry={() => setStatus('idle')} />
  }

  return (
    <div>
      <h1 className="text-[26px] font-bold tracking-tight text-gray-900">Reset your password</h1>
      <p className="mt-2 text-sm text-gray-500">Choose a new password for your account.</p>

      <form noValidate onSubmit={handleSubmit} aria-busy={isSubmitting} className="mt-7 space-y-5">
        <PasswordField
          id="reset-password-new"
          label="New password"
          autoComplete="new-password"
          value={values.password}
          onChange={(value) => updateField('password', value)}
          error={errors.password}
          disabled={isSubmitting}
        />

        <PasswordField
          id="reset-password-confirm"
          label="Confirm new password"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={(value) => updateField('confirmPassword', value)}
          error={errors.confirmPassword}
          disabled={isSubmitting}
        />

        <button type="submit" disabled={isSubmitting} className={PRIMARY_BUTTON_CLASSES}>
          {isSubmitting && <SpinnerIcon className="h-4 w-4 motion-safe:animate-spin" />}
          <span>{isSubmitting ? 'Resetting…' : 'Reset Password'}</span>
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        <Link
          to="/auth"
          className="font-semibold text-brand-700 hover:text-brand-800 focus:outline-none focus-visible:underline"
        >
          ← Back to Sign In
        </Link>
      </p>
    </div>
  )
}
