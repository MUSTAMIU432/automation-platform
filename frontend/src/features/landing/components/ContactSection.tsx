import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { NETWORK_ERROR_MESSAGE } from '../../identity/auth/authApi'
import {
  fieldErrorClasses,
  inputClasses,
  labelClasses,
} from '../../identity/components/fieldStyles'
import { SpinnerIcon } from '../../identity/components/icons'
import { TextField } from '../../identity/components/TextField'
import { hasErrors, validateEmail, type FieldErrors } from '../../identity/schemas/authValidation'
import { sendContactMessageRequest, type ContactMessageValues } from '../api/contactApi'
import { useReveal } from '../hooks/useReveal'
import { SIGN_IN_PATH } from '../sections'
import { CheckBadgeIcon, MailIcon } from './icons'
import { SectionHeading } from './SectionHeading'

const EMPTY: ContactMessageValues = { name: '', email: '', subject: '', message: '' }

/** Mirrors backend/contact/models.py. */
const MESSAGE_MAX_LENGTH = 5000

function validate(values: ContactMessageValues): FieldErrors<ContactMessageValues> {
  return {
    name: values.name.trim() ? undefined : 'Name is required.',
    email: validateEmail(values.email),
    subject: values.subject.trim() ? undefined : 'Subject is required.',
    message: !values.message.trim()
      ? 'Message is required.'
      : values.message.length > MESSAGE_MAX_LENGTH
        ? `Message must be at most ${MESSAGE_MAX_LENGTH} characters.`
        : undefined,
  }
}

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; message: string }
  | { kind: 'failed'; message: string }

/**
 * The contact form. It reports a message as sent only when the backend has
 * stored it (`sendContactMessage` answered `success: true`); a refusal or an
 * unreachable server is shown as such, and the visitor's text is kept.
 */
function ContactForm() {
  const [values, setValues] = useState<ContactMessageValues>(EMPTY)
  const [errors, setErrors] = useState<FieldErrors<ContactMessageValues>>({})
  const [attempted, setAttempted] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const sending = status.kind === 'sending'

  function update(field: keyof ContactMessageValues, value: string) {
    const next = { ...values, [field]: value }
    setValues(next)
    if (attempted) setErrors(validate(next))
    if (status.kind === 'failed') setStatus({ kind: 'idle' })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAttempted(true)
    const nextErrors = validate(values)
    setErrors(nextErrors)
    if (hasErrors(nextErrors)) return

    setStatus({ kind: 'sending' })
    try {
      const result = await sendContactMessageRequest({
        ...values,
        name: values.name.trim(),
        email: values.email.trim(),
        subject: values.subject.trim(),
      })
      if (result.success) {
        setStatus({ kind: 'sent', message: result.message })
        setValues(EMPTY)
        setAttempted(false)
        return
      }
      if (result.field) setErrors({ [result.field]: result.message })
      setStatus({ kind: 'failed', message: result.message })
    } catch {
      setStatus({ kind: 'failed', message: NETWORK_ERROR_MESSAGE })
    }
  }

  if (status.kind === 'sent') {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-mist text-jade">
          <CheckBadgeIcon className="h-8 w-8" />
        </span>
        <h3 className="mt-5 text-xl font-semibold text-ink">Message sent</h3>
        <output className="mt-2 block max-w-sm text-sage">{status.message}</output>
        <p className="mt-1 max-w-sm text-sm text-sage">We will reply to the email you gave.</p>
        <button
          type="button"
          onClick={() => setStatus({ kind: 'idle' })}
          className="mt-6 rounded text-sm font-semibold text-jade hover:text-pine focus:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
        >
          Send another message
        </button>
      </div>
    )
  }

  const messageErrorId = 'contact-message-error'

  return (
    <form noValidate onSubmit={handleSubmit} aria-busy={sending} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          id="contact-name"
          label="Name"
          autoComplete="name"
          value={values.name}
          onChange={(value) => update('name', value)}
          error={errors.name}
          disabled={sending}
        />
        <TextField
          id="contact-email"
          label="Email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={(value) => update('email', value)}
          error={errors.email}
          placeholder="you@company.com"
          disabled={sending}
        />
      </div>
      <TextField
        id="contact-subject"
        label="Subject"
        value={values.subject}
        onChange={(value) => update('subject', value)}
        error={errors.subject}
        disabled={sending}
      />
      <div>
        <label htmlFor="contact-message" className={labelClasses}>
          Message
        </label>
        <textarea
          id="contact-message"
          name="contact-message"
          rows={5}
          value={values.message}
          onChange={(event) => update('message', event.target.value)}
          disabled={sending}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? messageErrorId : undefined}
          className={`${inputClasses(Boolean(errors.message), { multiline: true })} w-full resize-y`}
        />
        {errors.message && (
          <p id={messageErrorId} role="alert" className={fieldErrorClasses}>
            {errors.message}
          </p>
        )}
      </div>

      {status.kind === 'failed' && (
        <p role="alert" className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          <span className="font-semibold">Not sent. </span>
          {status.message}
        </p>
      )}

      <button
        type="submit"
        disabled={sending}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-jade text-sm font-semibold text-white shadow-[0_10px_24px_-12px_rgb(var(--lp-jade)/0.9)] hover:bg-pine focus:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 motion-safe:transition-colors sm:w-auto sm:px-8"
      >
        {sending && <SpinnerIcon className="h-4 w-4 motion-safe:animate-spin" />}
        {sending ? 'Sending…' : 'Send message'}
      </button>
    </form>
  )
}

export function ContactSection() {
  const ref = useReveal<HTMLDivElement>()

  return (
    <section
      id="contact"
      aria-labelledby="contact-heading"
      className="scroll-mt-24 bg-mist py-20 sm:py-28"
    >
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:px-8">
        <div>
          <SectionHeading
            id="contact-heading"
            eyebrow="Contact"
            title="Talk to the MUSTANET team"
            description="A question about the platform, an organization you would like to bring on board, or something you need help with - send us a message and we will reply by email."
            align="start"
          />
          <div className="mt-8 flex items-start gap-3 rounded-2xl border border-jade/10 bg-white/70 p-5 backdrop-blur">
            <MailIcon className="mt-0.5 h-5 w-5 shrink-0 text-jade" />
            <p className="text-sm leading-relaxed text-sage">
              Already a member? You can message your collaborators directly once you{' '}
              <Link
                to={SIGN_IN_PATH}
                className="rounded font-semibold text-jade hover:text-pine focus:outline-none focus-visible:ring-2 focus-visible:ring-jade"
              >
                sign in
              </Link>
              .
            </p>
          </div>
        </div>
        <div
          ref={ref}
          className="rounded-3xl border border-jade/10 bg-white p-6 shadow-[0_24px_60px_-30px_rgb(var(--lp-pine)/0.35)] sm:p-8"
        >
          <ContactForm />
        </div>
      </div>
    </section>
  )
}
