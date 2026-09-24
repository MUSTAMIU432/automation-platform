import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { validateSignUp, hasErrors, type FieldErrors } from '../schemas/authValidation'
import type { SignUpFormValues } from '../types/auth'
import { GoogleAuthButton } from './GoogleAuthButton'
import { fieldErrorClasses } from './fieldStyles'
import { SpinnerIcon } from './icons'
import { PasswordField } from './PasswordField'
import { PhoneField } from './PhoneField'
import { TextField } from './TextField'

interface SignUpFormProps {
  onSwitchToSignIn: () => void
}

const INITIAL_VALUES: SignUpFormValues = {
  firstName: '',
  lastName: '',
  email: '',
  countryCode: '+255',
  phoneNumber: '',
  password: '',
  confirmPassword: '',
  acceptedTerms: false,
}

const LEGAL_LINK_CLASSES =
  'font-medium text-brand-700 underline decoration-brand-300 underline-offset-2 hover:text-brand-800'

/**
 * Sign up form. Deliberately minimal: it creates the account only. Profile
 * details (photo, country/city, bio, job title, organization, skills, etc.)
 * are completed later, from the dashboard, after authentication.
 */
export function SignUpForm({ onSwitchToSignIn }: SignUpFormProps) {
  const [values, setValues] = useState<SignUpFormValues>(INITIAL_VALUES)
  const [errors, setErrors] = useState<FieldErrors<SignUpFormValues>>({})
  const [attempted, setAttempted] = useState(false)
  const [status, setStatus] = useState<'idle' | 'submitting'>('idle')
  const isSubmitting = status === 'submitting'

  function updateField<K extends keyof SignUpFormValues>(field: K, value: SignUpFormValues[K]) {
    const next = { ...values, [field]: value }
    setValues(next)
    if (attempted) {
      setErrors(validateSignUp(next))
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAttempted(true)

    const nextErrors = validateSignUp(values)
    setErrors(nextErrors)
    if (hasErrors(nextErrors)) return

    setStatus('submitting')
    // Placeholder only: wired to the `register` GraphQL mutation once the
    // Identity backend contract lands. No implementation status is shown to
    // the user — it just returns the form to its normal, interactive state.
    window.setTimeout(() => setStatus('idle'), 400)
  }

  return (
    <div>
      <h1 className="text-[26px] font-bold tracking-tight text-gray-900">Create your account</h1>
      <p className="mt-2 text-sm text-gray-500">Start turning problems into automation.</p>

      <div className="mt-7">
        <GoogleAuthButton disabled={isSubmitting} />
      </div>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Or</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      <form noValidate onSubmit={handleSubmit} aria-busy={isSubmitting} className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            id="signup-first-name"
            label="First name"
            autoComplete="given-name"
            value={values.firstName}
            onChange={(value) => updateField('firstName', value)}
            error={errors.firstName}
            disabled={isSubmitting}
          />
          <TextField
            id="signup-last-name"
            label="Last name"
            autoComplete="family-name"
            value={values.lastName}
            onChange={(value) => updateField('lastName', value)}
            error={errors.lastName}
            disabled={isSubmitting}
          />
        </div>

        <TextField
          id="signup-email"
          label="Email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={(value) => updateField('email', value)}
          error={errors.email}
          placeholder="you@company.com"
          disabled={isSubmitting}
        />

        <PhoneField
          countryCode={values.countryCode}
          phoneNumber={values.phoneNumber}
          onCountryCodeChange={(value) => updateField('countryCode', value)}
          onPhoneNumberChange={(value) => updateField('phoneNumber', value)}
          error={errors.phoneNumber}
          disabled={isSubmitting}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PasswordField
            id="signup-password"
            label="Password"
            autoComplete="new-password"
            value={values.password}
            onChange={(value) => updateField('password', value)}
            error={errors.password}
            disabled={isSubmitting}
          />

          <PasswordField
            id="signup-confirm-password"
            label="Confirm password"
            autoComplete="new-password"
            value={values.confirmPassword}
            onChange={(value) => updateField('confirmPassword', value)}
            error={errors.confirmPassword}
            disabled={isSubmitting}
          />
        </div>

        <div>
          <div className="flex items-start gap-2.5">
            <input
              id="signup-terms"
              name="signup-terms"
              type="checkbox"
              checked={values.acceptedTerms}
              onChange={(event) => updateField('acceptedTerms', event.target.checked)}
              disabled={isSubmitting}
              aria-invalid={Boolean(errors.acceptedTerms)}
              aria-describedby={errors.acceptedTerms ? 'signup-terms-error' : undefined}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-brand-600 focus:ring-2 focus:ring-brand-300 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <label htmlFor="signup-terms" className="text-sm text-gray-600">
              I agree to the{' '}
              <Link to="/legal/terms" className={LEGAL_LINK_CLASSES}>
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link to="/legal/privacy" className={LEGAL_LINK_CLASSES}>
                Privacy Policy
              </Link>
              .
            </label>
          </div>
          {errors.acceptedTerms && (
            <p id="signup-terms-error" role="alert" className={fieldErrorClasses}>
              {errors.acceptedTerms}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 text-sm font-semibold text-white shadow-sm shadow-brand-900/10 motion-safe:transition-colors motion-safe:duration-150 hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-brand-300 disabled:shadow-none"
        >
          {isSubmitting && <SpinnerIcon className="h-4 w-4 motion-safe:animate-spin" />}
          <span>{isSubmitting ? 'Creating account…' : 'Create Account'}</span>
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{' '}
        <button
          type="button"
          onClick={onSwitchToSignIn}
          className="-my-3 inline-block py-3 font-semibold text-brand-700 hover:text-brand-800 focus:outline-none focus-visible:underline"
        >
          Sign in
        </button>
      </p>
    </div>
  )
}
