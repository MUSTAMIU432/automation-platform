import { useState } from 'react'

import {
  adminPaymentMethodsRequest,
  createPaymentMethod,
  PAYMENT_KIND_WORDS,
  setPaymentMethodActive,
  updatePaymentMethod,
  type PaymentKind,
  type PaymentMethod,
  type PaymentMethodInput,
  pushAvailableRequest,
  cardTokenizerRequest,
  type Collection,
} from '../../marketplace/api/marketplaceApi'
import { ProviderMark } from '../../marketplace/components/ProviderMark'
import {
  AdminCard,
  AdminPageHeader,
  Badge,
  EmptyState,
  ErrorState,
  LoadingState,
  Notice,
  controlClasses,
  primaryButtonClasses,
  secondaryButtonClasses,
} from '../components/AdminUi'
import { useAdminCapabilities } from '../context/useAdminCapabilities'
import { useAdminQuery } from '../hooks/useAdminQuery'

/** Providers offered as one-tap choices; any other name can be typed. */
const PROVIDERS: Record<PaymentKind, string[]> = {
  mobile_money: ['M-Pesa', 'Mixx by Yas (Tigo Pesa)', 'Airtel Money', 'HaloPesa'],
  bank: ['CRDB Bank', 'NMB Bank', 'NBC Bank', 'Exim Bank', 'Stanbic Bank'],
}

const KINDS: Record<PaymentKind, { icon: string; hint: string }> = {
  mobile_money: { icon: '📱', hint: 'M-Pesa, Mixx, Airtel Money, HaloPesa' },
  bank: { icon: '🏦', hint: 'A transfer or deposit to an account' },
}

const BLANK: PaymentMethodInput = {
  kind: 'mobile_money',
  collection: 'push',
  provider: '',
  accountName: '',
  accountNumber: '',
  instructions: '',
}

/** Step-by-step instructions drawn from what has been filled in, for the admin to adjust. */
function suggestedSteps(values: PaymentMethodInput): string {
  const provider = values.provider.trim() || 'your provider'
  const number = values.accountNumber.trim() || 'the number above'
  const name = values.accountName.trim()
  if (values.kind === 'bank') {
    return [
      `1. Transfer or deposit the amount shown to ${provider}, account ${number}${name ? ` (${name})` : ''}.`,
      '2. Use your full name as the payment reference.',
      '3. Enter the transaction reference from your receipt below.',
    ].join('\n')
  }
  return [
    `1. Open ${provider} on your phone and choose to pay or send money.`,
    `2. Enter ${number} and the amount shown.`,
    name
      ? `3. Check that the name shown is ${name}, then confirm.`
      : '3. Check the name, then confirm.',
    '4. Enter the transaction reference from the confirmation message below.',
  ].join('\n')
}

/** How each kind can be collected; the first is the recommended one. */
const COLLECTIONS: Record<
  PaymentKind,
  Array<{ key: Collection; icon: string; title: string; hint: string }>
> = {
  mobile_money: [
    {
      key: 'push',
      icon: '📲',
      title: 'Prompt on the buyer’s phone',
      hint: 'They enter their number and approve with their PIN. The idea unlocks by itself.',
    },
    {
      key: 'manual',
      icon: '✋',
      title: 'Buyer sends the money',
      hint: 'They pay to your number and give you the reference; you confirm it.',
    },
  ],
  bank: [
    {
      key: 'card',
      icon: '💳',
      title: 'Card payment (Visa, Mastercard)',
      hint: 'They pay by card in the checkout. The idea unlocks as soon as the card is charged.',
    },
    {
      key: 'manual',
      icon: '🏦',
      title: 'Bank transfer',
      hint: 'They transfer the money and give you the reference; you confirm it.',
    },
  ],
}

/** The payment details as a buyer meets them when paying for an idea. */
function BuyerView({ values }: { values: PaymentMethodInput }) {
  const mobile = values.kind === 'mobile_money'
  const placeholder = <span className="text-slate-400">Not filled in</span>
  if (values.collection === 'card') {
    return (
      <aside
        aria-label="What buyers see"
        className="rounded-xl border border-dashed border-slate-300 p-4"
      >
        <p className="text-xs font-bold tracking-wider text-slate-500 uppercase">What buyers see</p>
        <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <p className="flex items-center gap-2 font-semibold text-slate-900">
            💳 Pay using card
            <span className="ml-auto text-xs font-black text-[#1A1F71] italic">VISA</span>
            <span className="text-xs font-bold text-[#EB001B]">Mastercard</span>
          </p>
          {['Cardholder name', 'Card number', 'MM / YY · CVV'].map((label) => (
            <p
              key={label}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-400"
            >
              {label}
            </p>
          ))}
          <p className="text-xs text-slate-500">
            Charged to {values.accountName.trim() || 'your merchant account'} through the payment
            gateway. Card details never reach the platform.
          </p>
        </div>
      </aside>
    )
  }
  if (values.collection === 'push') {
    return (
      <aside
        aria-label="What buyers see"
        className="rounded-xl border border-dashed border-slate-300 p-4"
      >
        <p className="text-xs font-bold tracking-wider text-slate-500 uppercase">What buyers see</p>
        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <p className="flex items-center gap-2 font-semibold text-slate-900">
            <ProviderMark provider={values.provider} kind={values.kind} size="sm" />
            {values.provider.trim() || placeholder}
          </p>
          <p className="mt-3 text-xs font-semibold text-slate-600">
            {values.provider.trim() || 'Mobile money'} number
          </p>
          <p className="mt-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-400">
            🇹🇿 +255 712 345 678
          </p>
          <p className="mt-2 text-xs text-slate-500">
            A prompt from {values.accountName.trim() || 'your merchant name'} arrives on that phone;
            they approve it with their PIN. No number of yours is shown.
          </p>
        </div>
      </aside>
    )
  }
  return (
    <aside
      aria-label="What buyers see"
      className="rounded-xl border border-dashed border-slate-300 p-4"
    >
      <p className="text-xs font-bold tracking-wider text-slate-500 uppercase">What buyers see</p>
      <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
        <p className="flex items-center gap-2 font-semibold text-slate-900">
          <ProviderMark provider={values.provider} kind={values.kind} size="sm" />
          {values.provider.trim() || placeholder}
        </p>
        <dl className="mt-2 grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-semibold text-slate-500 uppercase">Pay to</dt>
            <dd className="font-medium text-slate-900">
              {values.accountName.trim() || placeholder}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold text-slate-500 uppercase">
              {mobile ? 'Number' : 'Account number'}
            </dt>
            <dd className="font-mono text-base font-bold text-slate-900">
              {values.accountNumber.trim() || placeholder}
            </dd>
          </div>
        </dl>
        {values.instructions.trim() && (
          <p className="mt-2 whitespace-pre-line text-slate-700">{values.instructions}</p>
        )}
      </div>
    </aside>
  )
}

function MethodForm({
  method,
  pushAvailable,
  cardsAvailable,
  onSaved,
  onCancel,
}: {
  method: PaymentMethod | null
  /** Whether the payment gateway sends phone prompts, and takes cards; null while unknown. */
  pushAvailable: boolean | null
  cardsAvailable: boolean | null
  onSaved: (text: string) => void
  onCancel?: () => void
}) {
  const [values, setValues] = useState<PaymentMethodInput>(() =>
    method
      ? {
          kind: method.kind,
          collection: method.collection,
          provider: method.provider,
          accountName: method.accountName,
          accountNumber: method.accountNumber,
          instructions: method.instructions,
        }
      : BLANK,
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof PaymentMethodInput>(key: K, value: PaymentMethodInput[K]) =>
    setValues((v) => ({ ...v, [key]: value }))
  const formId = `method-${method?.id ?? 'new'}`
  const mobile = values.kind === 'mobile_money'
  const push = values.collection === 'push'
  // A phone prompt or a card goes to the gateway's merchant account: no number to type.
  const viaGateway = push || values.collection === 'card'
  const gatewayReady = push ? pushAvailable : viaGateway ? cardsAvailable : true
  const missing = [
    !values.provider.trim() && (mobile ? 'provider' : 'bank'),
    !values.accountName.trim() && (viaGateway ? 'merchant name' : 'account name'),
    !viaGateway && !values.accountNumber.trim() && (mobile ? 'number' : 'account number'),
  ].filter(Boolean)

  function chooseKind(kind: PaymentKind) {
    // A provider picked from the other kind's list no longer fits; a typed one is kept.
    setValues((v) => ({
      ...v,
      kind,
      // Each kind starts on its recommended way of collecting.
      collection: kind === v.kind ? v.collection : COLLECTIONS[kind][0].key,
      provider: PROVIDERS[v.kind].includes(v.provider) ? '' : v.provider,
    }))
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const result = method
        ? await updatePaymentMethod({ id: method.id, input: values })
        : await createPaymentMethod({ input: values })
      if (result.success) {
        onSaved(
          method ? 'Payment method saved.' : 'Payment method added. Buyers can now pay to it.',
        )
        if (!method) setValues(BLANK)
      } else setError(result.message)
    } catch {
      setError('We could not reach the server. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      aria-label={method ? `Edit ${method.provider}` : 'Add a payment method'}
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <fieldset>
        <legend className="text-sm font-semibold text-slate-700">How buyers pay</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {(Object.keys(PAYMENT_KIND_WORDS) as PaymentKind[]).map((kind) => (
            <label
              key={kind}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                values.kind === kind
                  ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name={`${formId}-kind`}
                checked={values.kind === kind}
                onChange={() => chooseKind(kind)}
                className="sr-only"
              />
              <span aria-hidden="true" className="text-xl leading-none">
                {KINDS[kind].icon}
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-900">
                  {PAYMENT_KIND_WORDS[kind]}
                </span>
                <span className="block text-xs text-slate-500">{KINDS[kind].hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label
          htmlFor={`${formId}-provider`}
          className="block text-sm font-semibold text-slate-700"
        >
          {mobile ? 'Mobile money provider' : 'Bank'}
        </label>
        <fieldset className="mt-2 flex flex-wrap gap-2">
          <legend className="sr-only">Common choices</legend>
          {PROVIDERS[values.kind].map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={values.provider === name}
              onClick={() => set('provider', name)}
              className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
                values.provider === name
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
              }`}
            >
              {name}
            </button>
          ))}
        </fieldset>
        <input
          id={`${formId}-provider`}
          value={values.provider}
          onChange={(event) => set('provider', event.target.value)}
          placeholder={mobile ? 'Or type another provider' : 'Or type another bank'}
          className={`${controlClasses} mt-2 block w-full`}
        />
      </div>

      {
        <fieldset>
          <legend className="text-sm font-semibold text-slate-700">
            How the payment is collected
          </legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {COLLECTIONS[values.kind].map((option, index) => (
              <label
                key={option.key}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                  values.collection === option.key
                    ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name={`${formId}-collection`}
                  checked={values.collection === option.key}
                  onChange={() => set('collection', option.key)}
                  className="sr-only"
                />
                <span aria-hidden="true" className="text-xl leading-none">
                  {option.icon}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-slate-900">
                    {option.title}
                    {index === 0 && (
                      <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 uppercase">
                        Recommended
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-slate-500">{option.hint}</span>
                </span>
              </label>
            ))}
          </div>
          {viaGateway && gatewayReady === false && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              No payment gateway is connected yet, so buyers will not see this method until one is
              set up. Ask your developer to configure <code>MARKETPLACE_PAYMENT_GATEWAY</code>.
            </p>
          )}
          {viaGateway && gatewayReady && (
            <p className="mt-2 text-xs text-emerald-700">✓ Connected to the payment gateway.</p>
          )}
        </fieldset>
      }

      <div className="grid gap-4 sm:grid-cols-2">
        {!viaGateway && (
          <div>
            <label
              htmlFor={`${formId}-number`}
              className="block text-sm font-semibold text-slate-700"
            >
              {mobile ? 'Phone, till or Lipa number' : 'Account number'}
            </label>
            <input
              id={`${formId}-number`}
              aria-describedby={`${formId}-number-hint`}
              value={values.accountNumber}
              onChange={(event) => set('accountNumber', event.target.value)}
              placeholder={mobile ? 'e.g. 0754 000 000' : 'e.g. 0150 1234 5678 00'}
              inputMode={mobile ? 'tel' : 'text'}
              className={`${controlClasses} mt-1 block w-full font-mono`}
            />
            <p id={`${formId}-number-hint`} className="mt-1 text-xs text-slate-500">
              Buyers copy this exactly.
            </p>
          </div>
        )}
        <div>
          <label htmlFor={`${formId}-name`} className="block text-sm font-semibold text-slate-700">
            {viaGateway ? 'Merchant name' : 'Account name'}
          </label>
          <input
            id={`${formId}-name`}
            aria-describedby={`${formId}-name-hint`}
            value={values.accountName}
            onChange={(event) => set('accountName', event.target.value)}
            placeholder="e.g. Mustanet Ltd"
            className={`${controlClasses} mt-1 block w-full`}
          />
          <p id={`${formId}-name-hint`} className="mt-1 text-xs text-slate-500">
            {push
              ? 'The name on your gateway merchant account, shown in the prompt.'
              : mobile
                ? 'The name buyers see on their phone before they confirm.'
                : 'The name on the account, as the bank shows it.'}
          </p>
        </div>
      </div>

      {!viaGateway && (
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <label htmlFor={`${formId}-steps`} className="text-sm font-semibold text-slate-700">
              How to pay <span className="font-normal text-slate-500">(shown to buyers)</span>
            </label>
            <button
              type="button"
              onClick={() => set('instructions', suggestedSteps(values))}
              className="text-sm font-semibold text-brand-700 hover:underline"
            >
              {values.instructions.trim() ? 'Replace with suggested steps' : 'Suggest the steps'}
            </button>
          </div>
          <textarea
            id={`${formId}-steps`}
            rows={4}
            value={values.instructions}
            onChange={(event) => set('instructions', event.target.value)}
            placeholder="Step by step, in the words buyers will understand. Optional."
            className={`${controlClasses} mt-1 block w-full leading-6`}
          />
        </div>
      )}

      <BuyerView values={values} />

      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy || missing.length > 0}
          className={primaryButtonClasses}
        >
          {busy ? 'Saving…' : method ? 'Save' : 'Add payment method'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className={secondaryButtonClasses}>
            Cancel
          </button>
        )}
        {missing.length > 0 && (
          <span className="text-xs text-slate-500">Still needed: {missing.join(', ')}.</span>
        )}
      </div>
    </form>
  )
}

/**
 * Where marketplace buyers pay: mobile money numbers and bank accounts. A method that is
 * turned off disappears for buyers but stays on the payments already made to it.
 */
export function AdminPaymentMethodsPage() {
  const { capabilities } = useAdminCapabilities()
  const canManage = capabilities.canManageMarketplace
  const methods = useAdminQuery(
    'market:methods',
    adminPaymentMethodsRequest,
    'We could not load the payment methods.',
  )
  const gateway = useAdminQuery(
    'market:push',
    pushAvailableRequest,
    'We could not check the payment gateway.',
  )
  const pushAvailable = gateway.data ?? null
  const cards = useAdminQuery(
    'market:cards',
    cardTokenizerRequest,
    'We could not check card payments.',
  )
  const cardsAvailable = cards.loading && cards.data === null ? null : Boolean(cards.data)
  const [editing, setEditing] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function toggle(method: PaymentMethod) {
    setError(null)
    try {
      const result = await setPaymentMethodActive({
        id: method.id,
        active: !method.isActive,
      })
      if (!result.success) {
        setError(result.message)
        return
      }
      setMessage(
        method.isActive
          ? `${method.provider} is turned off: buyers no longer see it.`
          : `${method.provider} is turned on again.`,
      )
      methods.reload()
    } catch {
      setError('We could not reach the server. Please try again.')
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Payment methods"
        description="How marketplace buyers pay. With a payment prompt, the buyer enters their number and approves with their PIN, and the idea unlocks by itself. With a manual method, they send the money and give you the reference to confirm."
      />
      {message && (
        <output className="mb-6 block rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </output>
      )}
      {error && (
        <div className="mb-6">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <AdminCard title="Payment methods">
          {methods.error && <ErrorState message={methods.error} onRetry={methods.reload} />}
          {methods.loading && !methods.data && <LoadingState label="Loading payment methods…" />}
          {methods.data && methods.data.length === 0 && (
            <EmptyState
              title="No payment methods yet."
              description="Add the mobile money number or bank account buyers should pay into."
            />
          )}
          {methods.data && methods.data.length > 0 && (
            <ul aria-label="Payment methods" className="space-y-3">
              {methods.data.map((method) => (
                <li key={method.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  {editing === method.id ? (
                    <MethodForm
                      method={method}
                      pushAvailable={pushAvailable}
                      cardsAvailable={cardsAvailable}
                      onCancel={() => setEditing(null)}
                      onSaved={(text) => {
                        setEditing(null)
                        setMessage(text)
                        methods.reload()
                      }}
                    />
                  ) : (
                    <>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <ProviderMark provider={method.provider} kind={method.kind} />
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900">{method.provider}</p>
                            <p className="text-xs text-slate-500">
                              {method.collection === 'push'
                                ? 'Prompt on the buyer’s phone'
                                : method.collection === 'card'
                                  ? 'Card payment (Visa, Mastercard)'
                                  : PAYMENT_KIND_WORDS[method.kind]}
                            </p>
                          </div>
                        </div>
                        {method.isActive &&
                        ((method.collection === 'push' && pushAvailable === false) ||
                          (method.collection === 'card' && cardsAvailable === false)) ? (
                          <Badge tone="warn">Hidden: no gateway</Badge>
                        ) : (
                          <Badge tone={method.isActive ? 'good' : 'neutral'}>
                            {method.isActive ? 'Shown to buyers' : 'Turned off'}
                          </Badge>
                        )}
                      </div>
                      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                        <div>
                          <dt className="text-xs font-semibold text-slate-500 uppercase">
                            {method.collection === 'manual' ? 'Account name' : 'Merchant name'}
                          </dt>
                          <dd className="text-slate-900">{method.accountName}</dd>
                        </div>
                        {method.collection === 'manual' && (
                          <div>
                            <dt className="text-xs font-semibold text-slate-500 uppercase">
                              {method.kind === 'mobile_money' ? 'Number' : 'Account number'}
                            </dt>
                            <dd className="font-mono text-slate-900">{method.accountNumber}</dd>
                          </div>
                        )}
                      </dl>
                      {method.instructions && (
                        <p className="mt-2 text-sm whitespace-pre-line text-slate-600">
                          {method.instructions}
                        </p>
                      )}
                      {canManage && (
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => setEditing(method.id)}
                            className={secondaryButtonClasses}
                            aria-label={`Edit ${method.provider}`}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggle(method)}
                            className={secondaryButtonClasses}
                          >
                            {method.isActive ? 'Turn off' : 'Turn on'}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
        {canManage && (
          <AdminCard title="Add a payment method">
            <MethodForm
              method={null}
              pushAvailable={pushAvailable}
              cardsAvailable={cardsAvailable}
              onSaved={(text) => {
                setMessage(text)
                methods.reload()
              }}
            />
          </AdminCard>
        )}
      </div>
    </>
  )
}
