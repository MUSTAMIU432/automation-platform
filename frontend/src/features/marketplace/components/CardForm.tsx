import type { ReactNode } from 'react'

import {
  cardBrand,
  formatCardNumber,
  formatExpiry,
  digitsOf,
  type CardDetails,
} from '../utils/cardTokenizers'

const input =
  'mt-1.5 block w-full rounded-lg border bg-white px-4 py-3 text-base text-gray-900 shadow-sm placeholder:text-gray-400 focus:ring-2 focus:outline-none'

function VisaMark() {
  return (
    <span
      aria-label="Visa"
      className="text-lg font-black tracking-tight text-[#1A1F71] italic select-none"
    >
      VISA
    </span>
  )
}

function MastercardMark() {
  return (
    <span aria-label="Mastercard" className="relative inline-block h-6 w-10 select-none">
      <span className="absolute top-0 left-0 h-6 w-6 rounded-full bg-[#EB001B]" />
      <span className="absolute top-0 right-0 h-6 w-6 rounded-full bg-[#F79E1B] mix-blend-multiply" />
    </span>
  )
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string
  label: string
  error?: string
  children: ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-gray-800">
        {label} <span className="text-red-600">*</span>
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * The card's details, as a checkout asks for them. The form only holds them: the checkout
 * hands them to the gateway's tokenizer, and only its token is sent to the server.
 */
export function CardForm({
  id,
  card,
  errors,
  sandbox,
  onChange,
  onSubmit,
}: {
  id: string
  card: CardDetails
  /** Shown once the buyer has tried to pay. */
  errors: Partial<CardDetails>
  sandbox: boolean
  onChange: (card: CardDetails) => void
  onSubmit: () => void
}) {
  const brand = cardBrand(card.number)
  const set = (key: keyof CardDetails, value: string) => onChange({ ...card, [key]: value })
  const tone = (error?: string) =>
    error
      ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
      : 'border-gray-300 focus:border-brand-500 focus:ring-brand-200'

  return (
    <form
      id={id}
      aria-label="Pay by card"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
      className="space-y-5"
    >
      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-brand-700"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-7 w-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <rect x="3" y="5" width="18" height="14" rx="2.5" />
            <path d="M3 10h18M7 15h4" strokeLinecap="round" />
          </svg>
        </span>
        <h3 className="text-lg font-bold text-gray-900">Pay using card</h3>
      </div>

      <div className="flex items-center gap-4 rounded-xl border-2 border-brand-600 px-4 py-3">
        <span
          aria-hidden="true"
          className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600"
        >
          <span className="h-2.5 w-2.5 rounded-full bg-white" />
        </span>
        <span className="font-semibold text-gray-900">Credit / debit card</span>
        <span className="ml-auto flex items-center gap-3 sm:ml-2">
          <VisaMark />
          <MastercardMark />
        </span>
      </div>

      <Field id={`${id}-holder`} label="Cardholder name" error={errors.holder}>
        <input
          id={`${id}-holder`}
          autoComplete="cc-name"
          value={card.holder}
          onChange={(event) => set('holder', event.target.value)}
          placeholder="Name as shown on card"
          aria-invalid={Boolean(errors.holder)}
          aria-describedby={errors.holder ? `${id}-holder-error` : undefined}
          className={`${input} ${tone(errors.holder)}`}
        />
      </Field>

      <Field id={`${id}-number`} label="Card number" error={errors.number}>
        <div className="relative">
          <input
            id={`${id}-number`}
            autoComplete="cc-number"
            inputMode="numeric"
            value={card.number}
            onChange={(event) => set('number', formatCardNumber(event.target.value))}
            placeholder="1234 5678 9012 3456"
            aria-invalid={Boolean(errors.number)}
            aria-describedby={errors.number ? `${id}-number-error` : undefined}
            className={`${input} ${tone(errors.number)} pr-24 font-mono tracking-wider`}
          />
          {brand && (
            <span className="absolute top-1/2 right-4 mt-0.75 -translate-y-1/2">
              {brand === 'Visa' ? <VisaMark /> : <MastercardMark />}
            </span>
          )}
        </div>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id={`${id}-expiry`} label="Expiry date" error={errors.expiry}>
          <input
            id={`${id}-expiry`}
            autoComplete="cc-exp"
            inputMode="numeric"
            value={card.expiry}
            onChange={(event) => set('expiry', formatExpiry(event.target.value))}
            placeholder="MM / YY"
            aria-invalid={Boolean(errors.expiry)}
            aria-describedby={errors.expiry ? `${id}-expiry-error` : undefined}
            className={`${input} ${tone(errors.expiry)}`}
          />
        </Field>
        <Field id={`${id}-cvc`} label="CVV / CVC" error={errors.cvc}>
          <input
            id={`${id}-cvc`}
            type="password"
            autoComplete="cc-csc"
            inputMode="numeric"
            value={card.cvc}
            onChange={(event) => set('cvc', digitsOf(event.target.value).slice(0, 4))}
            placeholder="3–4 digits"
            aria-invalid={Boolean(errors.cvc)}
            aria-describedby={errors.cvc ? `${id}-cvc-error` : undefined}
            className={`${input} ${tone(errors.cvc)}`}
          />
        </Field>
      </div>

      {sandbox && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Sandbox: no real charge. Use 4242 4242 4242 4242 with any future date; a card ending 0002
          is declined.
        </p>
      )}

      <p className="border-t border-gray-200 pt-4 text-xs leading-5 text-gray-600">
        By making this payment you accept our payment terms and conditions. Your bank may ask you to
        verify the payment. 🔒 Your card details go straight to our payment provider - we never see
        or store them.
      </p>
      {/* Lets Enter submit from any field. */}
      <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
    </form>
  )
}
