import { useCallback, useEffect, useId, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'

import { formatFileSize } from '../../ideas/utils/attachmentRules'
import { ProposalText } from '../../proposals/components/ProposalSections'
import {
  downloadMarketDocument,
  formatPhone,
  formatPrice,
  marketIdeaRequest,
  type MarketIdea,
  type Purchase,
} from '../api/marketplaceApi'
import { CheckoutDialog } from './CheckoutDialog'
import { DocumentPreviewDialog, type PreviewSource } from './DocumentPreviewDialog'
import { EnquirySection } from './EnquirySection'

/** A file as a page with a folded corner, labelled with its format. */
function FileIcon({ format }: { format: 'PDF' | 'Word' }) {
  const pdf = format === 'PDF'
  return (
    <span aria-hidden="true" className="relative block h-14 w-11 shrink-0">
      <span className="absolute inset-0 rounded-md border border-gray-200 bg-white shadow-sm [clip-path:polygon(0_0,70%_0,100%_22%,100%_100%,0_100%)]" />
      <span className="absolute top-0 right-0 h-3 w-3 rounded-bl-sm bg-gray-200" />
      <span
        className={`absolute bottom-2 left-1/2 -translate-x-1/2 rounded px-1 py-0.5 text-[9px] font-black text-white ${
          pdf ? 'bg-red-600' : 'bg-blue-600'
        }`}
      >
        {pdf ? 'PDF' : 'DOCX'}
      </span>
    </span>
  )
}

/** One thing a buyer gets. Locked, the whole tile opens the checkout. */
function Tile({
  icon,
  title,
  meta,
  locked,
  waiting,
  onUnlock,
  children,
}: {
  icon: ReactNode
  title: string
  meta: string
  locked: boolean
  waiting: boolean
  onUnlock: () => void
  children?: ReactNode
}) {
  const body = (
    <>
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-gray-900">{title}</span>
        <span className="block text-xs text-gray-500">{meta}</span>
      </span>
    </>
  )
  if (!locked) {
    return (
      <li className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        {body}
        <span className="flex gap-2">{children}</span>
      </li>
    )
  }
  return (
    <li>
      <button
        type="button"
        disabled={waiting}
        onClick={onUnlock}
        aria-label={`${title}, locked`}
        className="group flex w-full items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-brand-300 hover:shadow-md disabled:cursor-default disabled:hover:border-gray-200 disabled:hover:shadow-sm"
      >
        {body}
        {/* A lock, not a button: one payment unlocks every item, from the button above. */}
        <span
          aria-hidden="true"
          title={waiting ? 'Unlocks once your payment is confirmed' : 'Included when you unlock'}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 group-enabled:group-hover:bg-brand-50 group-enabled:group-hover:text-brand-700"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" strokeLinecap="round" />
          </svg>
        </span>
      </button>
    </li>
  )
}

const actionButton =
  'inline-flex h-9 items-center rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60'

/** What the idea comes with, e.g. "A PDF document and a written implementation plan". */
function includedSummary(idea: MarketIdea): string {
  const items = [
    idea.documentInfo && `a ${idea.documentInfo.format} document`,
    idea.hasWrittenDocumentation && 'a written implementation plan',
  ].filter(Boolean)
  if (items.length === 0) return 'Nothing attached yet.'
  const text = items.join(' and ')
  return `${text[0].toUpperCase()}${text.slice(1)}.`
}

/**
 * What the idea comes with - shown to everyone, unlocked by paying. The reader can fold it
 * away to a one-line summary and open it again with "Read it".
 */
function WhatsIncluded({
  idea,
  onUnlock,
  onResume,
  onPreview,
}: {
  idea: MarketIdea
  onUnlock: () => void
  /** Reopen the checkout on a payment prompt still waiting on the phone. */
  onResume: (purchase: Purchase) => void
  onPreview: (source: PreviewSource) => void
}) {
  const [open, setOpen] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [downloadFailed, setDownloadFailed] = useState(false)
  const bodyId = useId()
  const purchase = idea.myPurchase
  const locked = !idea.hasAccess
  const onPhone = locked && purchase?.status === 'awaiting'
  const waiting = onPhone || (locked && purchase?.status === 'pending')
  const price = formatPrice(idea.price, idea.currency)
  const doc = idea.document
  const info = idea.documentInfo

  return (
    <section
      aria-labelledby="included-heading"
      className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 id="included-heading" className="text-xl font-bold text-gray-900">
            What’s included
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-600">
            {!open
              ? includedSummary(idea)
              : locked
                ? 'Skip months of research and guesswork. One payment unlocks the complete, ready-to-build plan behind this idea - every item below, yours to keep.'
                : 'It’s all yours. Preview it, download it, and start building.'}
          </p>
        </div>
        {!open ? (
          <button
            type="button"
            aria-expanded={false}
            aria-controls={bodyId}
            onClick={() => setOpen(true)}
            className="inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-semibold whitespace-nowrap text-white shadow-sm hover:bg-brand-700"
          >
            Read it →
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            {!locked ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800">
                ✓ Unlocked
              </span>
            ) : onPhone && purchase ? (
              <button
                type="button"
                onClick={() => onResume(purchase)}
                className="inline-flex h-11 items-center rounded-lg bg-amber-500 px-5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
              >
                Approve on your phone
              </button>
            ) : waiting ? (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-800">
                Payment being confirmed
              </span>
            ) : (
              <button
                type="button"
                onClick={onUnlock}
                className="inline-flex h-11 items-center rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
              >
                {idea.price === 0 ? 'Get it free' : `Unlock everything · ${price}`}
              </button>
            )}
            <button
              type="button"
              aria-expanded
              aria-controls={bodyId}
              onClick={() => setOpen(false)}
              className={actionButton}
            >
              Hide
            </button>
          </div>
        )}
      </div>

      {open && (
        <div id={bodyId}>
          {onPhone && purchase && (
            <output className="mt-5 block rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">Approve the payment on your phone</p>
              <p className="mt-1">
                A request for {formatPrice(purchase.amount, purchase.currency)} was sent to{' '}
                {formatPhone(purchase.payerAccount)}. Enter your {purchase.method.provider} PIN to
                approve it, and everything here will open.
              </p>
            </output>
          )}
          {waiting && !onPhone && purchase && (
            <output className="mt-5 block rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">We are confirming your payment</p>
              <p className="mt-1">
                {formatPrice(purchase.amount, purchase.currency)} by {purchase.method.provider},
                reference{' '}
                <span className="font-mono font-semibold">{purchase.transactionReference}</span>.
                You will be notified as soon as it is confirmed, and everything here will open.
              </p>
            </output>
          )}
          {locked && purchase?.status === 'failed' && (
            <div
              role="note"
              className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Your last payment did not go through</p>
                <p className="mt-1">{purchase.reviewNote} No money was taken.</p>
              </div>
              <button type="button" onClick={onUnlock} className={actionButton}>
                Try again
              </button>
            </div>
          )}
          {locked && purchase?.status === 'rejected' && (
            <div
              role="note"
              className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Your last payment could not be confirmed</p>
                <p className="mt-1">{purchase.reviewNote}</p>
              </div>
              <button type="button" onClick={onUnlock} className={actionButton}>
                Try again
              </button>
            </div>
          )}

          <ul aria-label="Included" className="mt-6 grid gap-3 lg:grid-cols-2">
            {info && (
              <Tile
                icon={<FileIcon format={info.format} />}
                title={info.filename}
                meta={`${info.format} document · ${formatFileSize(info.size)}`}
                locked={locked}
                waiting={waiting}
                onUnlock={onUnlock}
              >
                {doc && (
                  <>
                    <button
                      type="button"
                      onClick={() => onPreview({ saved: doc })}
                      className={actionButton}
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      disabled={downloading}
                      onClick={() => {
                        setDownloading(true)
                        setDownloadFailed(false)
                        downloadMarketDocument(doc)
                          .catch(() => setDownloadFailed(true))
                          .finally(() => setDownloading(false))
                      }}
                      className="inline-flex h-9 items-center rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                    >
                      {downloading ? 'Downloading…' : 'Download'}
                    </button>
                  </>
                )}
              </Tile>
            )}
            {idea.hasWrittenDocumentation && (
              <Tile
                icon={
                  <span
                    aria-hidden="true"
                    className="flex h-14 w-11 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-brand-50 text-xl"
                  >
                    📝
                  </span>
                }
                title="Written implementation plan"
                meta="Read it in the viewer"
                locked={locked}
                waiting={waiting}
                onUnlock={onUnlock}
              >
                {idea.documentation && (
                  <button
                    type="button"
                    onClick={() =>
                      onPreview({
                        written: {
                          title: 'Written implementation plan',
                          text: idea.documentation ?? '',
                        },
                      })
                    }
                    className={actionButton}
                  >
                    Read
                  </button>
                )}
              </Tile>
            )}
          </ul>
          {locked && (
            <ul
              aria-label="Why buy"
              className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600"
            >
              {[
                'One payment, everything included',
                'Yours to keep, on this account',
                'Questions first? Tap 💬 to ask the team',
              ].map((point) => (
                <li key={point} className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="font-bold text-emerald-600">
                    ✓
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          )}
          {downloadFailed && (
            <p role="alert" className="mt-3 text-sm text-red-700">
              We could not download the document. Please try again.
            </p>
          )}
        </div>
      )}
    </section>
  )
}

/** One idea at `/app/marketplace/:ideaId`: its summary, what it includes, and checkout. */
export function MarketIdeaPage() {
  const { ideaId = '' } = useParams()
  const [state, setState] = useState<{ idea: MarketIdea | null } | 'loading' | 'failed'>('loading')
  const [checkout, setCheckout] = useState<{ resume: Purchase | null } | null>(null)
  const [preview, setPreview] = useState<PreviewSource | null>(null)

  const load = useCallback(() => {
    marketIdeaRequest(ideaId)
      .then((idea) => setState({ idea }))
      .catch(() => setState('failed'))
  }, [ideaId])
  useEffect(() => {
    load()
  }, [load])

  if (state === 'loading') return <p className="mt-8 text-sm text-gray-500">Loading…</p>
  if (state === 'failed') {
    return (
      <p role="alert" className="mt-8 text-sm text-red-700">
        We could not open this idea. Please refresh the page.
      </p>
    )
  }
  const idea = state.idea
  if (!idea) {
    return (
      <section className="mt-8 rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-600">
        <p className="font-semibold text-gray-900">This idea is not available.</p>
        <Link to="/app/marketplace" className="mt-3 inline-block font-semibold text-brand-700">
          Back to the marketplace
        </Link>
      </section>
    )
  }

  return (
    <article className="mt-6 space-y-6">
      <header className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold tracking-[0.18em] text-brand-700 uppercase">Marketplace</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-900">{idea.title}</h1>
        <div className="mt-4">
          <ProposalText text={idea.summary} />
        </div>
      </header>

      <WhatsIncluded
        idea={idea}
        onUnlock={() => setCheckout({ resume: null })}
        onResume={(purchase) => setCheckout({ resume: purchase })}
        onPreview={setPreview}
      />

      <EnquirySection idea={idea} />

      {checkout && (
        <CheckoutDialog
          idea={idea}
          resume={checkout.resume}
          onClose={() => setCheckout(null)}
          onChanged={load}
        />
      )}
      {preview && <DocumentPreviewDialog source={preview} onClose={() => setPreview(null)} />}
    </article>
  )
}
