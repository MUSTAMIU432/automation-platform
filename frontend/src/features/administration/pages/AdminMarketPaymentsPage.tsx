import { useState } from 'react'

import {
  confirmPayment,
  formatPrice,
  marketPaymentsRequest,
  PAYMENT_KIND_WORDS,
  rejectPayment,
  type Purchase,
  type PurchaseStatus,
} from '../../marketplace/api/marketplaceApi'
import {
  AdminCard,
  AdminPageHeader,
  AdminTable,
  Badge,
  EmptyState,
  ErrorState,
  LoadingState,
  Notice,
  cellClasses,
  controlClasses,
  dangerButtonClasses,
  primaryButtonClasses,
} from '../components/AdminUi'
import { useAdminCapabilities } from '../context/useAdminCapabilities'
import { useAdminQuery } from '../hooks/useAdminQuery'
import { formatDateTime } from '../utils/format'

const FILTERS: Array<{ key: PurchaseStatus | 'all'; label: string }> = [
  { key: 'pending', label: 'Waiting' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'failed', label: 'Not approved' },
  { key: 'all', label: 'All' },
]
const STATUS = {
  awaiting: { tone: 'neutral', words: 'On the buyer’s phone' },
  pending: { tone: 'warn', words: 'Waiting for you' },
  confirmed: { tone: 'good', words: 'Confirmed' },
  rejected: { tone: 'bad', words: 'Rejected' },
  failed: { tone: 'neutral', words: 'Not approved' },
} as const

interface Decided {
  id: string
  decision: 'confirmed' | 'rejected'
  text: string
}

/** One payment waiting for confirmation, with everything needed to find it on the statement. */
function PaymentToConfirm({
  purchase,
  canManage,
  onDecided,
}: {
  purchase: Purchase
  canManage: boolean
  onDecided: (decided: Decided) => void
}) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<'confirm' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function decide(confirm: boolean) {
    setBusy(confirm ? 'confirm' : 'reject')
    setError(null)
    try {
      const result = confirm
        ? await confirmPayment({ id: purchase.id, note })
        : await rejectPayment({ id: purchase.id, note })
      if (!result.success) {
        setError(result.message)
        return
      }
      onDecided({
        id: purchase.id,
        decision: confirm ? 'confirmed' : 'rejected',
        text: confirm
          ? `${purchase.buyerName} can now read “${purchase.ideaTitle}”. They have been told.`
          : `${purchase.buyerName}'s payment for “${purchase.ideaTitle}” was rejected; they have been told why.`,
      })
    } catch {
      setError('We could not reach the server. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  const facts: Array<[string, string]> = [
    ['Buyer', `${purchase.buyerName} · ${purchase.buyerEmail}`],
    ['Paid with', `${purchase.method.provider} (${PAYMENT_KIND_WORDS[purchase.method.kind]})`],
    ['Paid to', `${purchase.method.accountName} · ${purchase.method.accountNumber}`],
    ['Paid from', `${purchase.payerName} · ${purchase.payerAccount}`],
    ['Submitted', formatDateTime(purchase.createdAt)],
  ]

  return (
    <li
      aria-label={`Payment from ${purchase.buyerName} for ${purchase.ideaTitle}`}
      className="rounded-xl border border-slate-200 bg-white p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{purchase.ideaTitle}</p>
          <p className="text-2xl font-bold text-slate-900 tabular-nums">
            {formatPrice(purchase.amount, purchase.currency)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
            Transaction reference
          </p>
          <p className="font-mono text-lg font-bold tracking-wide text-slate-900 select-all">
            {purchase.transactionReference}
          </p>
        </div>
      </div>
      <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-semibold text-slate-500 uppercase">{label}</dt>
            <dd className="break-words text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
      {canManage && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <label className="block text-sm font-semibold text-slate-700">
            Note{' '}
            <span className="font-normal text-slate-500">
              (needed to reject; the buyer sees it)
            </span>
            <textarea
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className={`${controlClasses} mt-1 block w-full`}
            />
          </label>
          {error && (
            <div className="mt-2">
              <Notice tone="error">{error}</Notice>
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void decide(true)}
              className={primaryButtonClasses}
            >
              {busy === 'confirm' ? 'Confirming…' : 'Confirm payment'}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void decide(false)}
              className={dangerButtonClasses}
            >
              {busy === 'reject' ? 'Rejecting…' : 'Reject'}
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

/**
 * Marketplace payments: the ones waiting for confirmation - checked against the mobile
 * money or bank statement by their transaction reference - and the history of decisions.
 */
export function AdminMarketPaymentsPage() {
  const { capabilities } = useAdminCapabilities()
  const [filter, setFilter] = useState<PurchaseStatus | 'all'>('pending')
  const payments = useAdminQuery(
    'market:payments',
    () => marketPaymentsRequest(),
    'We could not load the payments.',
  )
  const [decided, setDecided] = useState<Decided[]>([])
  const decidedIds = new Set(decided.map((d) => d.id))
  const all = payments.data ?? []
  const counts = {
    pending: all.filter((p) => p.status === 'pending' && !decidedIds.has(p.id)).length,
    confirmed: all.filter((p) => p.status === 'confirmed').length,
    rejected: all.filter((p) => p.status === 'rejected').length,
    failed: all.filter((p) => p.status === 'failed').length,
    awaiting: all.filter((p) => p.status === 'awaiting').length,
    all: all.length,
  }
  const shown =
    filter === 'all'
      ? all
      : all.filter((p) => p.status === filter && !(filter === 'pending' && decidedIds.has(p.id)))

  return (
    <>
      <AdminPageHeader
        title="Payments"
        description="Payments approved on the buyer's phone unlock the idea by themselves. For manual methods, buyers give you their transaction reference: find it on your mobile money or bank statement, then confirm the payment to unlock the idea for them."
      />
      <fieldset className="mb-4 flex flex-wrap gap-2">
        <legend className="sr-only">Show</legend>
        {FILTERS.map((option) => (
          <button
            key={option.key}
            type="button"
            aria-pressed={filter === option.key}
            onClick={() => setFilter(option.key)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              filter === option.key
                ? 'bg-brand-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {option.label} ({counts[option.key]})
          </button>
        ))}
      </fieldset>

      {decided.length > 0 && (
        <ul aria-label="Decided just now" className="mb-4 space-y-2">
          {decided.map((d) => (
            <li key={d.id}>
              <output
                className={`flex items-start gap-3 rounded-xl border px-4 py-3 motion-safe:animate-[fade-in_200ms_ease-out] ${
                  d.decision === 'confirmed'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                    : 'border-amber-300 bg-amber-50 text-amber-900'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold text-white ${
                    d.decision === 'confirmed' ? 'bg-emerald-600' : 'bg-amber-500'
                  }`}
                >
                  {d.decision === 'confirmed' ? '✓' : '✕'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">
                    {d.decision === 'confirmed' ? 'Payment confirmed' : 'Payment rejected'}
                  </span>
                  <span className="block text-sm">{d.text}</span>
                </span>
                <button
                  type="button"
                  aria-label="Dismiss"
                  onClick={() => setDecided((list) => list.filter((item) => item.id !== d.id))}
                  className="shrink-0 rounded-md px-2 py-1 text-sm font-semibold opacity-70 hover:opacity-100"
                >
                  ✕
                </button>
              </output>
            </li>
          ))}
        </ul>
      )}

      <AdminCard title={FILTERS.find((f) => f.key === filter)?.label ?? 'Payments'}>
        {payments.error && <ErrorState message={payments.error} onRetry={payments.reload} />}
        {payments.loading && !payments.data && <LoadingState label="Loading payments…" />}
        {payments.data && shown.length === 0 && (
          <EmptyState
            title={filter === 'pending' ? 'No payment is waiting for you.' : 'Nothing here.'}
            description={
              filter === 'pending'
                ? 'A payment appears here when a buyer says they have paid.'
                : undefined
            }
          />
        )}
        {payments.data && shown.length > 0 && filter === 'pending' && (
          <ul aria-label="Payments waiting" className="space-y-3">
            {shown.map((purchase) => (
              <PaymentToConfirm
                key={purchase.id}
                purchase={purchase}
                canManage={capabilities.canManageMarketplace}
                onDecided={(d) => {
                  setDecided((list) => [d, ...list])
                  payments.reload()
                }}
              />
            ))}
          </ul>
        )}
        {payments.data && shown.length > 0 && filter !== 'pending' && (
          <AdminTable
            label="Payments"
            columns={['Idea', 'Buyer', 'Amount', 'Reference', 'Status', 'Decided']}
          >
            {shown.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className={cellClasses}>{p.ideaTitle}</td>
                <td className={cellClasses}>
                  {p.buyerName}
                  <span className="block text-xs text-slate-500">{p.buyerEmail}</span>
                </td>
                <td className={`${cellClasses} whitespace-nowrap tabular-nums`}>
                  {formatPrice(p.amount, p.currency)}
                </td>
                <td className={`${cellClasses} font-mono`}>{p.transactionReference}</td>
                <td className={cellClasses}>
                  <Badge tone={STATUS[p.status].tone}>{STATUS[p.status].words}</Badge>
                </td>
                <td className={cellClasses}>
                  {p.decidedAt ? (
                    <>
                      {p.decidedByName ??
                        (p.status === 'failed'
                          ? 'Not approved on the phone'
                          : 'Approved on the phone')}{' '}
                      · {formatDateTime(p.decidedAt)}
                      {p.reviewNote && (
                        <span className="block text-xs text-slate-500">{p.reviewNote}</span>
                      )}
                    </>
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
            ))}
          </AdminTable>
        )}
      </AdminCard>
    </>
  )
}
