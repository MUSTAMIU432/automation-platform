import { useState } from 'react'
import { Link } from 'react-router-dom'

import {
  marketEnquiriesRequest,
  replyEnquiry,
  type Enquiry,
} from '../../marketplace/api/marketplaceApi'
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
} from '../components/AdminUi'
import { useAdminCapabilities } from '../context/useAdminCapabilities'
import { useAdminQuery } from '../hooks/useAdminQuery'
import { formatDateTime } from '../utils/format'

/** One conversation, read and answered. */
function Thread({
  enquiry,
  canManage,
  onReplied,
}: {
  enquiry: Enquiry
  canManage: boolean
  onReplied: () => void
}) {
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function reply() {
    setBusy(true)
    setError(null)
    try {
      const result = await replyEnquiry({ id: enquiry.id, body })
      if (result.success) {
        setBody('')
        onReplied()
      } else setError(result.message)
    } catch {
      setError('We could not reach the server. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-col">
      <div className="border-b border-slate-100 pb-3">
        <p className="font-semibold text-slate-900">{enquiry.buyerName}</p>
        <p className="text-xs text-slate-500">
          {enquiry.buyerEmail} · about{' '}
          <Link
            to={`/app/marketplace/${enquiry.ideaId}`}
            className="font-medium text-brand-700 hover:underline"
          >
            {enquiry.ideaTitle}
          </Link>
        </p>
      </div>
      <ol aria-label="Conversation" className="mt-4 space-y-3">
        {enquiry.messages.map((message) => (
          <li
            key={message.id}
            className={`flex ${message.fromTeam ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                message.fromTeam
                  ? 'rounded-br-sm bg-brand-600 text-white'
                  : 'rounded-bl-sm bg-slate-100 text-slate-800'
              }`}
            >
              <p className="text-[11px] font-semibold opacity-75">
                {message.fromTeam ? `${message.authorName} (team)` : message.authorName} ·{' '}
                {formatDateTime(message.createdAt)}
              </p>
              <p className="mt-0.5 whitespace-pre-line">{message.body}</p>
            </div>
          </li>
        ))}
      </ol>
      {canManage && (
        <form
          aria-label={`Reply to ${enquiry.buyerName}`}
          className="mt-5 space-y-2"
          onSubmit={(event) => {
            event.preventDefault()
            void reply()
          }}
        >
          <label htmlFor={`reply-${enquiry.id}`} className="text-sm font-semibold text-slate-700">
            Your answer
          </label>
          <textarea
            id={`reply-${enquiry.id}`}
            rows={4}
            maxLength={2000}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="The buyer is notified as soon as you send it."
            className={`${controlClasses} block w-full leading-6`}
          />
          {error && <Notice tone="error">{error}</Notice>}
          <button type="submit" disabled={busy || !body.trim()} className={primaryButtonClasses}>
            {busy ? 'Sending…' : 'Send answer'}
          </button>
        </form>
      )}
    </div>
  )
}

/**
 * Buyers' questions about the platform's ideas - what is in one, whether it fits, how to
 * pay - asked from the idea's page. Those waiting for an answer come first; the buyer is
 * notified of each answer.
 */
export function AdminMarketEnquiriesPage() {
  const { capabilities } = useAdminCapabilities()
  const enquiries = useAdminQuery(
    'market:enquiries',
    marketEnquiriesRequest,
    'We could not load the enquiries.',
  )
  const [selected, setSelected] = useState<string | null>(null)
  const all = enquiries.data ?? []
  const open = all.find((e) => e.id === selected) ?? all[0] ?? null
  const waiting = all.filter((e) => e.awaitingReply).length

  return (
    <>
      <AdminPageHeader
        title="Enquiries"
        description="Questions buyers ask about the platform's ideas before or after buying. A quick, helpful answer is often what turns a visitor into a buyer."
      />
      {enquiries.error && <ErrorState message={enquiries.error} onRetry={enquiries.reload} />}
      {enquiries.loading && !enquiries.data && <LoadingState label="Loading enquiries…" />}
      {enquiries.data && all.length === 0 && (
        <AdminCard title="Enquiries">
          <EmptyState
            title="No questions yet."
            description="When a buyer asks about an idea from its page, the conversation appears here."
          />
        </AdminCard>
      )}
      {all.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <AdminCard title={waiting ? `Conversations · ${waiting} waiting` : 'Conversations'}>
            <ul aria-label="Conversations" className="-mx-2 space-y-1">
              {all.map((enquiry) => {
                const last = enquiry.messages[enquiry.messages.length - 1]
                return (
                  <li key={enquiry.id}>
                    <button
                      type="button"
                      aria-current={open?.id === enquiry.id ? 'true' : undefined}
                      onClick={() => setSelected(enquiry.id)}
                      className={`w-full rounded-lg px-3 py-2.5 text-left transition ${
                        open?.id === enquiry.id ? 'bg-brand-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold text-slate-900">
                          {enquiry.buyerName}
                        </span>
                        {enquiry.awaitingReply && <Badge tone="warn">Needs a reply</Badge>}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {enquiry.ideaTitle}
                      </span>
                      {last && (
                        <span className="mt-1 block truncate text-sm text-slate-600">
                          {last.fromTeam ? 'You: ' : ''}
                          {last.body}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </AdminCard>
          {open && (
            <AdminCard title="Conversation">
              <Thread
                key={open.id}
                enquiry={open}
                canManage={capabilities.canManageMarketplace}
                onReplied={enquiries.reload}
              />
            </AdminCard>
          )}
        </div>
      )}
    </>
  )
}
