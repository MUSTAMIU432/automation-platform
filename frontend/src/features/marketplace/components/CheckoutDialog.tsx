import { useEffect, useId, useRef, useState } from 'react'

import { formatFileSize } from '../../ideas/utils/attachmentRules'
import {
  formatPhone,
  formatPrice,
  marketPurchaseRequest,
  PAYMENT_KIND_WORDS,
  paymentMethodsRequest,
  startPushPayment,
  submitPayment,
  cardTokenizerRequest,
  startCardPayment,
  type MarketIdea,
  type PaymentMethod,
  type Purchase,
} from '../api/marketplaceApi'
import { cardErrors, TOKENIZERS, type CardDetails } from '../utils/cardTokenizers'
import { CardForm } from './CardForm'
import { ProviderMark } from './ProviderMark'

const BLANK_CARD: CardDetails = { holder: '', number: '', expiry: '', cvc: '' }

const field =
  'mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-200 focus:outline-none'

/** How often a waiting phone payment is checked, and how long a prompt stays open. */
const POLL_MS = 3000
const PROMPT_LIFETIME_MS = 3 * 60 * 1000
const TZ_MOBILE = /^(?:\+?255|0)?[67]\d{8}$/

type Step = 'pay' | 'confirm' | 'waiting' | 'done' | 'failed'

/** A value the buyer types into their phone, with a button that copies it. */
function CopyRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase">{label}</p>
        <p
          className={`truncate text-gray-900 ${mono ? 'font-mono text-lg font-bold tracking-wider' : 'font-semibold'}`}
        >
          {value}
        </p>
      </div>
      <button
        type="button"
        aria-label={`Copy ${label.toLowerCase()}`}
        onClick={() => {
          void navigator.clipboard?.writeText(value).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          })
        }}
        className="shrink-0 rounded-md border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

function Stepper({ labels, at }: { labels: [string, string]; at: number }) {
  return (
    <ol aria-label="Checkout steps" className="flex items-center gap-3 text-sm">
      {labels.map((label, index) => (
        <li key={label} className="flex items-center gap-2">
          {index > 0 && <span aria-hidden="true" className="h-px w-8 bg-gray-300" />}
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
              index < at
                ? 'bg-emerald-600 text-white'
                : index === at
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-200 text-gray-600'
            }`}
          >
            {index < at ? '✓' : index + 1}
          </span>
          <span
            aria-current={index === at ? 'step' : undefined}
            className={index === at ? 'font-semibold text-gray-900' : 'text-gray-500'}
          >
            {label}
          </span>
        </li>
      ))}
    </ol>
  )
}

/** "2:41" until the prompt on the phone expires. */
function useCountdown(startedAt: string | null): string | null {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!startedAt) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [startedAt])
  if (!startedAt) return null
  const left = Math.max(0, new Date(startedAt).getTime() + PROMPT_LIFETIME_MS - now)
  const seconds = Math.ceil(left / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/** A phone receiving the payment prompt. */
function PhonePrompt() {
  return (
    <span aria-hidden="true" className="relative mx-auto block h-24 w-24">
      <span className="absolute inset-0 animate-ping rounded-full bg-brand-200 opacity-60" />
      <span className="absolute inset-2 rounded-full bg-brand-100" />
      <svg
        viewBox="0 0 24 24"
        className="absolute inset-0 m-auto h-11 w-11 text-brand-700"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 2.5h8a1.5 1.5 0 0 1 1.5 1.5v16a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V4A1.5 1.5 0 0 1 8 2.5Z" />
        <path d="M9.5 9.5h5M9.5 12.5h3M11 18.5h2" />
      </svg>
    </span>
  )
}

/**
 * Paying for an idea, as a checkout: the order on one side; on the other, the payment.
 *
 * A push method asks only for the buyer's mobile number: the gateway sends a prompt to
 * that phone, the buyer approves it with their PIN, and the checkout waits for the answer
 * and unlocks the idea. A manual method shows where to send the money, then takes the
 * transaction reference for an administrator to confirm. `resume` reopens a prompt that
 * is still waiting on the phone.
 */
export function CheckoutDialog({
  idea,
  resume,
  onClose,
  onChanged,
}: {
  idea: MarketIdea
  resume?: Purchase | null
  onClose: () => void
  /** The purchase moved on (submitted, approved, failed): the page should reload. */
  onChanged: () => void
}) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const [methods, setMethods] = useState<PaymentMethod[] | null>(null)
  const [methodId, setMethodId] = useState(resume?.method.id ?? '')
  const [step, setStep] = useState<Step>(resume ? 'waiting' : 'pay')
  const [phone, setPhone] = useState('')
  const [payerName, setPayerName] = useState('')
  const [payerAccount, setPayerAccount] = useState('')
  const [reference, setReference] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [purchase, setPurchase] = useState<Purchase | null>(resume ?? null)
  const [cardDetails, setCardDetails] = useState<CardDetails>(BLANK_CARD)
  const [cardTried, setCardTried] = useState(false)
  const [tokenizer, setTokenizer] = useState<string | null>(null)
  const price = formatPrice(idea.price, idea.currency)
  const countdown = useCountdown(step === 'waiting' ? (purchase?.createdAt ?? null) : null)

  const close = useRef(onClose)
  const changed = useRef(onChanged)
  useEffect(() => {
    close.current = onClose
    changed.current = onChanged
  }, [onClose, onChanged])
  useEffect(() => {
    closeRef.current?.focus()
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close.current()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    let cancelled = false
    paymentMethodsRequest()
      .then((answer) => {
        if (cancelled) return
        setMethods(answer)
        setMethodId((current) => current || answer[0]?.id || '')
      })
      .catch(() => {
        if (!cancelled) setMethods([])
      })
    cardTokenizerRequest()
      .then((name) => {
        if (!cancelled) setTokenizer(name)
      })
      .catch(() => {
        /* without a tokenizer, a card payment says it is not available */
      })
    return () => {
      cancelled = true
    }
  }, [])

  // While the prompt is on the phone, ask how it went until it is approved or not.
  const waitingId = step === 'waiting' ? purchase?.id : undefined
  useEffect(() => {
    if (!waitingId) return
    let cancelled = false
    const timer = setInterval(() => {
      marketPurchaseRequest(waitingId)
        .then((latest) => {
          if (cancelled || !latest || latest.status === 'awaiting') return
          setPurchase(latest)
          setStep(latest.status === 'confirmed' ? 'done' : 'failed')
          changed.current()
        })
        .catch(() => {
          /* a missed check is retried on the next tick */
        })
    }, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [waitingId])

  const method = methods?.find((m) => m.id === methodId) ?? resume?.method
  const push = method?.collection === 'push'
  const card = method?.collection === 'card'
  const cardProblems = cardErrors(cardDetails)
  const mobile = method?.kind !== 'bank'
  const phoneValid = TZ_MOBILE.test(phone.replace(/[\s\-()]/g, ''))
  const manualReady = method && payerName.trim() && payerAccount.trim() && reference.trim()

  async function sendPrompt() {
    setBusy(true)
    setError(null)
    try {
      const result = await startPushPayment({
        input: { ideaId: idea.id, methodId, phoneNumber: phone },
      })
      if (result.success && result.purchase) {
        setPurchase(result.purchase)
        setStep('waiting')
        changed.current()
      } else setError(result.message)
    } catch {
      setError('We could not reach the server. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function payByCard() {
    setCardTried(true)
    if (Object.keys(cardProblems).length > 0) return
    const tokenize = tokenizer ? TOKENIZERS[tokenizer] : undefined
    if (!tokenize) {
      setError('Card payments are not available right now. Choose another method.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      // The card's details go to the gateway's tokenizer; only its token goes to the server.
      const { token, label } = await tokenize(cardDetails)
      setCardDetails((current) => ({ ...current, number: '', cvc: '' }))
      setCardTried(false)
      const result = await startCardPayment({
        input: {
          ideaId: idea.id,
          methodId,
          cardToken: token,
          cardholderName: cardDetails.holder,
          cardLabel: label,
        },
      })
      if (result.success && result.purchase) {
        setPurchase(result.purchase)
        setStep(
          result.purchase.status === 'confirmed'
            ? 'done'
            : result.purchase.status === 'failed'
              ? 'failed'
              : 'waiting',
        )
        changed.current()
      } else setError(result.message)
    } catch {
      setError('We could not reach the server. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function submitManual() {
    setBusy(true)
    setError(null)
    try {
      const result = await submitPayment({
        input: {
          ideaId: idea.id,
          methodId,
          payerName,
          payerAccount,
          transactionReference: reference,
        },
      })
      if (result.success && result.purchase) {
        setPurchase(result.purchase)
        setStep('done')
        changed.current()
      } else setError(result.message)
    } catch {
      setError('We could not reach the server. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const stepper: [string, string] = push
    ? ['Your number', 'Approve']
    : card
      ? ['Card details', 'Confirm']
      : ['Pay', 'Confirm']
  const stepAt = step === 'pay' ? 0 : step === 'confirm' || step === 'waiting' ? 1 : 2
  const primary =
    'inline-flex h-11 items-center rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-gray-900/60 sm:items-center sm:p-4">
      <dialog
        open
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative m-0 grid max-h-[100dvh] w-full max-w-4xl overflow-y-auto rounded-t-2xl bg-white text-left shadow-2xl sm:max-h-[92vh] sm:rounded-2xl md:grid-cols-[17rem_minmax(0,1fr)] md:overflow-hidden"
      >
        {/* The order. */}
        <aside className="bg-gradient-to-br from-brand-900 to-brand-700 p-6 text-white">
          <p className="text-xs font-bold tracking-[0.18em] text-white/70 uppercase">
            Order summary
          </p>
          <p className="mt-3 text-lg leading-snug font-semibold">{idea.title}</p>
          <ul className="mt-4 space-y-2 text-sm text-white/85">
            {idea.documentInfo && (
              <li className="flex gap-2">
                <span aria-hidden="true">📄</span>
                <span className="min-w-0">
                  <span className="block truncate">{idea.documentInfo.filename}</span>
                  <span className="text-xs text-white/60">
                    {idea.documentInfo.format} · {formatFileSize(idea.documentInfo.size)}
                  </span>
                </span>
              </li>
            )}
            {idea.hasWrittenDocumentation && (
              <li className="flex gap-2">
                <span aria-hidden="true">📝</span>
                <span>Written implementation plan</span>
              </li>
            )}
            <li className="flex gap-2">
              <span aria-hidden="true">♾️</span>
              <span>Yours to keep, on this account</span>
            </li>
          </ul>
          <div className="mt-6 flex items-baseline justify-between border-t border-white/20 pt-4">
            <span className="text-sm text-white/80">Total</span>
            <span className="text-2xl font-bold tabular-nums">{price}</span>
          </div>
          <p className="mt-6 text-xs leading-5 text-white/65">
            {push
              ? 'You approve the payment on your own phone with your PIN. We never see your PIN.'
              : card
                ? 'Your card details go straight to our payment provider. We never see or store them.'
                : 'Our team checks your payment against the statement and unlocks the idea. You are notified as soon as it is confirmed.'}
          </p>
        </aside>

        {/* Paying. */}
        <div className="flex min-h-0 flex-col md:max-h-[92vh]">
          <div className="flex items-center justify-between gap-4 border-b border-gray-100 px-6 py-4">
            <h2 id={titleId} className="text-lg font-bold text-gray-900">
              Checkout
            </h2>
            <div className="hidden sm:block">
              {step !== 'done' && step !== 'failed' && <Stepper labels={stepper} at={stepAt} />}
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close checkout"
              className="rounded-lg px-2 py-1 text-xl leading-none text-gray-500 hover:bg-gray-100"
            >
              ×
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {methods === null && !resume ? (
              <p className="text-sm text-gray-500">Loading payment options…</p>
            ) : methods?.length === 0 && !resume ? (
              <p className="text-sm text-gray-600">
                Payment is not available yet. Check back soon.
              </p>
            ) : step === 'waiting' && purchase ? (
              <div className="py-6 text-center" aria-live="polite">
                <PhonePrompt />
                <p className="mt-5 text-lg font-bold text-gray-900">
                  {purchase.method.collection === 'card'
                    ? 'Confirm with your bank'
                    : 'Check your phone'}
                </p>
                {purchase.method.collection === 'card' ? (
                  <p className="mx-auto mt-2 max-w-sm text-sm text-gray-600">
                    Your bank wants to verify this payment of{' '}
                    <span className="font-semibold">
                      {formatPrice(purchase.amount, purchase.currency)}
                    </span>{' '}
                    on {purchase.payerAccount}. Follow its instructions - in its app or by SMS.
                  </p>
                ) : (
                  <p className="mx-auto mt-2 max-w-sm text-sm text-gray-600">
                    We sent a payment request of{' '}
                    <span className="font-semibold">
                      {formatPrice(purchase.amount, purchase.currency)}
                    </span>{' '}
                    to <span className="font-semibold">{formatPhone(purchase.payerAccount)}</span>.
                    Unlock your phone and enter your {purchase.method.provider} PIN to approve it.
                  </p>
                )}
                <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                  Waiting for approval{countdown ? ` · expires in ${countdown}` : ''}
                </p>
                <p className="mx-auto mt-6 max-w-sm text-xs text-gray-500">
                  No prompt? Make sure the phone is on and has signal. You can close this window -
                  the idea unlocks as soon as you approve.
                </p>
              </div>
            ) : step === 'done' && purchase ? (
              <div className="py-8 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">
                  ✓
                </span>
                <p className="mt-4 text-lg font-bold text-gray-900">
                  {purchase.status === 'confirmed' ? 'Payment received' : 'Payment submitted'}
                </p>
                <p className="mx-auto mt-2 max-w-sm text-sm text-gray-600">
                  {purchase.status === 'confirmed' ? (
                    <>
                      “{idea.title}” is unlocked. Receipt{' '}
                      <span className="font-mono font-semibold">
                        {purchase.transactionReference}
                      </span>
                      .
                    </>
                  ) : (
                    <>
                      We are confirming your payment of{' '}
                      {formatPrice(purchase.amount, purchase.currency)}, reference{' '}
                      <span className="font-mono font-semibold">
                        {purchase.transactionReference}
                      </span>
                      . You will be notified when “{idea.title}” is unlocked.
                    </>
                  )}
                </p>
                <button type="button" onClick={onClose} className={`${primary} mt-6`}>
                  {purchase.status === 'confirmed' ? 'See what’s included' : 'Done'}
                </button>
              </div>
            ) : step === 'failed' && purchase ? (
              <div className="py-8 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-2xl text-red-700">
                  !
                </span>
                <p className="mt-4 text-lg font-bold text-gray-900">
                  The payment did not go through
                </p>
                <p className="mx-auto mt-2 max-w-sm text-sm text-gray-600">
                  {purchase.reviewNote || 'The payment was not approved.'} No money was taken.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setError(null)
                    setStep('pay')
                  }}
                  className={`${primary} mt-6`}
                >
                  Try again
                </button>
              </div>
            ) : step === 'pay' && methods ? (
              <div className="space-y-5">
                <fieldset>
                  <legend className="text-sm font-semibold text-gray-900">Payment method</legend>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {methods.map((m) => (
                      <label
                        key={m.id}
                        aria-label={`${m.provider}, ${PAYMENT_KIND_WORDS[m.kind]}`}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                          methodId === m.id
                            ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="checkout-method"
                          value={m.id}
                          checked={methodId === m.id}
                          onChange={() => {
                            setMethodId(m.id)
                            setError(null)
                          }}
                          className="sr-only"
                        />
                        <ProviderMark provider={m.provider} kind={m.kind} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold text-gray-900">
                            {m.provider}
                          </span>
                          <span className="block text-xs text-gray-500">
                            {m.collection === 'push'
                              ? 'Approve on your phone'
                              : m.collection === 'card'
                                ? 'Visa · Mastercard'
                                : PAYMENT_KIND_WORDS[m.kind]}
                          </span>
                        </span>
                        <span
                          aria-hidden="true"
                          className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                            methodId === m.id ? 'border-brand-600' : 'border-gray-300'
                          }`}
                        >
                          {methodId === m.id && (
                            <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                {method && push && (
                  <form
                    id="checkout-push"
                    aria-label={`Pay with ${method.provider}`}
                    onSubmit={(event) => {
                      event.preventDefault()
                      if (phoneValid) void sendPrompt()
                    }}
                  >
                    <label
                      htmlFor="checkout-phone"
                      className="block text-sm font-semibold text-gray-900"
                    >
                      {method.provider} number
                    </label>
                    <div className="mt-1 flex rounded-lg border border-gray-300 bg-white shadow-sm focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-200">
                      <span className="flex items-center gap-1.5 border-r border-gray-200 px-3 text-sm text-gray-600">
                        <span aria-hidden="true">🇹🇿</span> +255
                      </span>
                      <input
                        id="checkout-phone"
                        aria-describedby="checkout-phone-hint"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel-national"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="712 345 678"
                        className="min-w-0 flex-1 rounded-r-lg border-0 bg-transparent px-3 py-3 text-base tracking-wide text-gray-900 focus:outline-none"
                      />
                    </div>
                    <p id="checkout-phone-hint" className="mt-2 text-xs text-gray-500">
                      You will get a prompt on this phone to approve {price} with your PIN.
                    </p>
                    {error && (
                      <p
                        role="alert"
                        className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
                      >
                        {error}
                      </p>
                    )}
                  </form>
                )}

                {method && card && (
                  <>
                    <CardForm
                      id="checkout-card"
                      card={cardDetails}
                      errors={cardTried ? cardProblems : {}}
                      sandbox={tokenizer === 'sandbox'}
                      onChange={setCardDetails}
                      onSubmit={() => void payByCard()}
                    />
                    {error && (
                      <p
                        role="alert"
                        className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
                      >
                        {error}
                      </p>
                    )}
                  </>
                )}

                {method && !push && !card && (
                  <section aria-label={`Pay with ${method.provider}`}>
                    <p className="text-sm font-semibold text-gray-900">
                      Send {price} with {method.provider}
                    </p>
                    <div className="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-200">
                      <div className="flex items-center gap-3 px-4 py-3">
                        <ProviderMark provider={method.provider} kind={method.kind} size="sm" />
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase">
                            Pay to
                          </p>
                          <p className="truncate font-semibold text-gray-900">
                            {method.accountName}
                          </p>
                        </div>
                      </div>
                      <CopyRow
                        label={mobile ? 'Number' : 'Account number'}
                        value={method.accountNumber}
                        mono
                      />
                      <CopyRow label="Amount" value={String(idea.price)} />
                    </div>
                    {method.instructions && (
                      <ol className="mt-3 space-y-1.5 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
                        {method.instructions
                          .split('\n')
                          .map((line) => line.trim())
                          .filter(Boolean)
                          .map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                      </ol>
                    )}
                  </section>
                )}
              </div>
            ) : step === 'confirm' ? (
              <form
                id="checkout-confirm"
                aria-label="Confirm your payment"
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  void submitManual()
                }}
              >
                {method && (
                  <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3 text-sm">
                    <ProviderMark provider={method.provider} kind={method.kind} size="sm" />
                    <span className="flex-1 text-gray-700">
                      {price} to <span className="font-semibold">{method.accountName}</span> by{' '}
                      {method.provider}
                    </span>
                    <button
                      type="button"
                      onClick={() => setStep('pay')}
                      className="text-xs font-semibold text-brand-700 hover:underline"
                    >
                      Change
                    </button>
                  </div>
                )}
                <p className="text-sm text-gray-600">
                  Tell us about the payment so we can find it on our statement.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Name on the payment
                    <input
                      value={payerName}
                      onChange={(e) => setPayerName(e.target.value)}
                      autoComplete="name"
                      className={field}
                    />
                  </label>
                  <label className="block text-sm font-semibold text-gray-700">
                    {mobile ? 'Phone number you paid from' : 'Account you paid from'}
                    <input
                      value={payerAccount}
                      onChange={(e) => setPayerAccount(e.target.value)}
                      inputMode={mobile ? 'tel' : 'text'}
                      placeholder={mobile ? 'e.g. 0712 345 678' : undefined}
                      className={field}
                    />
                  </label>
                </div>
                <div>
                  <label
                    htmlFor="checkout-reference"
                    className="block text-sm font-semibold text-gray-700"
                  >
                    Transaction reference
                  </label>
                  <input
                    id="checkout-reference"
                    aria-describedby="checkout-reference-hint"
                    value={reference}
                    onChange={(e) => setReference(e.target.value.toUpperCase())}
                    placeholder="e.g. QK7H2X9P1A"
                    className={`${field} font-mono tracking-wider`}
                  />
                  <p id="checkout-reference-hint" className="mt-1 text-xs text-gray-500">
                    The code in the confirmation message or receipt.
                  </p>
                </div>
                {error && (
                  <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </p>
                )}
              </form>
            ) : null}
          </div>

          {(step === 'pay' || step === 'confirm') && methods && methods.length > 0 && (
            <div className="flex items-center justify-between gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
              {step === 'confirm' ? (
                <button
                  type="button"
                  onClick={() => setStep('pay')}
                  className="text-sm font-semibold text-gray-600 hover:text-gray-900"
                >
                  ← Back
                </button>
              ) : (
                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span aria-hidden="true">🔒</span>
                  {push
                    ? 'Approved on your phone, with your PIN'
                    : card
                      ? 'Secured by our payment provider'
                      : 'Pay first, then confirm here'}
                </span>
              )}
              {step === 'pay' && card ? (
                <button type="submit" form="checkout-card" disabled={busy} className={primary}>
                  {busy ? 'Paying…' : `Pay ${price}`}
                </button>
              ) : step === 'pay' && push ? (
                <button
                  type="submit"
                  form="checkout-push"
                  disabled={busy || !phoneValid}
                  className={primary}
                >
                  {busy ? 'Sending…' : `Pay ${price}`}
                </button>
              ) : step === 'pay' ? (
                <button
                  type="button"
                  disabled={!method}
                  onClick={() => setStep('confirm')}
                  className={primary}
                >
                  I have paid →
                </button>
              ) : (
                <button
                  type="submit"
                  form="checkout-confirm"
                  disabled={busy || !manualReady}
                  className={primary}
                >
                  {busy ? 'Submitting…' : `Confirm payment of ${price}`}
                </button>
              )}
            </div>
          )}
        </div>
      </dialog>
    </div>
  )
}
