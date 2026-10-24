import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  adminMarketIdeasRequest,
  adminPaymentMethodsRequest,
  createMarketIdea,
  DOCUMENT_ACCEPT,
  formatPrice,
  publishMarketIdea,
  removeMarketDocument,
  unpublishMarketIdea,
  updateMarketIdea,
  uploadMarketDocument,
  type MarketIdea,
  type MarketIdeaInput,
  type Outcome,
} from '../../marketplace/api/marketplaceApi'
import { formatFileSize } from '../../ideas/utils/attachmentRules'
import {
  DocumentPreviewDialog,
  type PreviewSource,
} from '../../marketplace/components/DocumentPreviewDialog'
import { ProposalText } from '../../proposals/components/ProposalSections'
import {
  AdminCard,
  AdminPageHeader,
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
import { formatDateTime } from '../utils/format'

/** Where a platform idea is on its way from being written to being bought. */
type Stage = 'draft' | 'on_sale' | 'sold' | 'withdrawn'

function stageOf(idea: MarketIdea): Stage {
  if (idea.status === 'draft') return 'draft'
  if (idea.status === 'unpublished') return 'withdrawn'
  return idea.purchasesConfirmed > 0 ? 'sold' : 'on_sale'
}

const STAGES: Array<{
  key: Stage
  label: string
  hint: string
  tone: string
  dot: string
}> = [
  {
    key: 'draft',
    label: 'Draft',
    hint: 'Written, not on sale',
    tone: 'text-slate-700',
    dot: 'bg-slate-400',
  },
  {
    key: 'on_sale',
    label: 'On sale',
    hint: 'Published, no buyer yet',
    tone: 'text-sky-700',
    dot: 'bg-sky-500',
  },
  {
    key: 'sold',
    label: 'Sold',
    hint: 'At least one buyer',
    tone: 'text-emerald-700',
    dot: 'bg-emerald-500',
  },
  {
    key: 'withdrawn',
    label: 'Withdrawn',
    hint: 'Taken off sale',
    tone: 'text-amber-700',
    dot: 'bg-amber-500',
  },
]
const STAGE = Object.fromEntries(STAGES.map((s) => [s.key, s])) as Record<
  Stage,
  (typeof STAGES)[number]
>

/** Runs one action and keeps the server's own words for the result. */
function useAction() {
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{
    tone: 'success' | 'error'
    text: string
  } | null>(null)
  async function run<P extends Outcome>(action: () => Promise<P>, onDone: (p: P) => void) {
    setBusy(true)
    setNotice(null)
    try {
      const result = await action()
      if (result.success) onDone(result)
      else setNotice({ tone: 'error', text: result.message })
    } catch {
      setNotice({
        tone: 'error',
        text: 'We could not reach the server. Please try again.',
      })
    } finally {
      setBusy(false)
    }
  }
  return { busy, notice, run }
}

function words(text: string): number {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

const EMPTY: MarketIdeaInput = {
  title: '',
  summary: '',
  documentation: '',
  price: 0,
}

/** The document as the form has it: the one saved, or the one about to be uploaded. */
interface DocumentShown {
  filename: string
  size: number
}

/** The idea as a buyer will meet it in the marketplace, drawn from the form as it is typed. */
function BuyerPreview({
  values,
  document: doc,
}: {
  values: MarketIdeaInput
  document: DocumentShown | null
}) {
  return (
    <aside aria-label="How buyers will see it" className="space-y-3">
      <p className="text-xs font-bold tracking-wider text-slate-500 uppercase">
        How buyers will see it
      </p>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <p className="text-lg font-semibold text-slate-900">
            {values.title.trim() || 'Your idea’s title'}
          </p>
          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
            🔒 Locked
          </span>
        </div>
        <p className="mt-2 line-clamp-4 text-sm leading-6 text-slate-600">
          {values.summary.trim() || 'The summary everyone signed in can read.'}
        </p>
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
          <span className="text-base font-bold text-slate-900 tabular-nums">
            {formatPrice(values.price)}
          </span>
          <span className="text-sm font-semibold text-brand-700">View →</span>
        </div>
      </div>
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <p className="font-semibold text-slate-800">Unlocked after payment</p>
        {doc && (
          <p className="mt-0.5">
            📄 {doc.filename} ({formatFileSize(doc.size)})
          </p>
        )}
        <p className="mt-0.5">
          {words(values.documentation)
            ? `${words(values.documentation)} words of documentation.`
            : doc
              ? null
              : 'No documentation yet.'}
        </p>
        {values.documentation.trim() && (
          <div className="mt-2 line-clamp-6">
            <ProposalText text={values.documentation} />
          </div>
        )}
      </div>
    </aside>
  )
}

const DOCUMENT_EXTENSIONS = DOCUMENT_ACCEPT.split(',')

/**
 * The document buyers download: the one saved, a new one chosen to replace it, or none.
 * Either can be previewed; nothing is sent until the form is saved.
 */
function DocumentPicker({
  saved,
  file,
  removing,
  onFile,
  onRemove,
}: {
  saved: MarketIdea['document']
  file: File | null
  removing: boolean
  onFile: (file: File | null) => void
  onRemove: (removing: boolean) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState<PreviewSource | null>(null)
  const shown = file ?? (saved && !removing ? saved : null)
  const name = file ? file.name : saved?.filename
  const size = file ? file.size : (saved?.size ?? 0)

  function choose(chosen: File | null | undefined) {
    if (!chosen) return
    const lower = chosen.name.toLowerCase()
    if (!DOCUMENT_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
      setError('Choose a PDF or a Word document (.pdf or .docx).')
      return
    }
    setError(null)
    onFile(chosen)
  }

  return (
    <div>
      <p className="text-sm font-semibold text-slate-700">Document</p>
      <p className="text-xs text-slate-500">
        A PDF or Word (.docx) file buyers download once their payment is confirmed.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={DOCUMENT_ACCEPT}
        aria-label={shown ? 'Replace the document' : 'Upload a document'}
        onChange={(event) => {
          choose(event.target.files?.[0])
          event.target.value = ''
        }}
        className="sr-only"
      />
      {shown ? (
        <div className="mt-2 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-xl"
          >
            📄
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-slate-900">{name}</span>
            <span className="block text-xs text-slate-500">
              {formatFileSize(size)}
              {file ? (
                <span className="font-semibold text-amber-700"> · uploads when you save</span>
              ) : (
                ' · uploaded'
              )}
            </span>
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPreview(file ? { file } : { saved: saved! })}
              className={secondaryButtonClasses}
            >
              Preview
            </button>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className={secondaryButtonClasses}
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => (file ? onFile(null) : onRemove(true))}
              className="rounded-lg px-3 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              {file ? 'Discard' : 'Remove'}
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            choose(event.dataTransfer.files?.[0])
          }}
          className={`mt-2 flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition ${
            dragging ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-slate-50'
          }`}
        >
          <span aria-hidden="true" className="text-2xl">
            📄
          </span>
          <p className="text-sm text-slate-600">Drop a PDF or Word (.docx) file here, or</p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={primaryButtonClasses}
          >
            Upload document
          </button>
          {removing && (
            <p className="text-xs text-amber-800">
              {saved?.filename} will be removed when you save.{' '}
              <button
                type="button"
                onClick={() => onRemove(false)}
                className="font-semibold underline"
              >
                Keep it
              </button>
            </p>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-700">
          {error}
        </p>
      )}
      {preview && <DocumentPreviewDialog source={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}

/** Writing a platform idea, with the buyer's view of it beside the form. */
function IdeaEditor({
  idea,
  onSaved,
  onCancel,
}: {
  idea: MarketIdea | null
  /** `warning` is set when the idea saved but its document did not change. */
  onSaved: (idea: MarketIdea, message: string, warning?: string) => void
  onCancel: () => void
}) {
  const save = useAction()
  const [file, setFile] = useState<File | null>(null)
  const [removing, setRemoving] = useState(false)
  const saved = idea?.document ?? null
  const [values, setValues] = useState<MarketIdeaInput>(() =>
    idea
      ? {
          title: idea.title,
          summary: idea.summary,
          documentation: idea.documentation ?? '',
          price: idea.price,
        }
      : EMPTY,
  )
  const set = <K extends keyof MarketIdeaInput>(key: K, value: MarketIdeaInput[K]) =>
    setValues((v) => ({ ...v, [key]: value }))
  const ready = values.title.trim() !== '' && values.summary.trim() !== ''
  const shownDocument: DocumentShown | null = file
    ? { filename: file.name, size: file.size }
    : saved && !removing
      ? { filename: saved.filename, size: saved.size }
      : null

  /** The idea first, then its document - which needs the idea's id when it is new. */
  async function saveAll() {
    const result = idea
      ? await updateMarketIdea({ id: idea.id, input: values })
      : await createMarketIdea({ input: values })
    if (!result.success || !result.idea) return { ...result, warning: undefined }
    let change: Outcome | null = null
    if (file) change = await uploadMarketDocument(result.idea.id, file)
    else if (removing && saved) change = await removeMarketDocument(result.idea.id)
    return {
      ...result,
      warning: change && !change.success ? change.message : undefined,
    }
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <form
        aria-label={idea ? `Edit ${idea.title}` : 'New platform idea'}
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault()
          void save.run(saveAll, (result) => {
            if (result.idea) {
              onSaved(
                result.idea,
                idea ? 'Changes saved.' : 'Idea saved as a draft.',
                result.warning,
              )
            }
          })
        }}
      >
        <label className="block text-sm font-semibold text-slate-700">
          Title
          <input
            value={values.title}
            onChange={(event) => set('title', event.target.value)}
            className={`${controlClasses} mt-1 block w-full`}
          />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Summary
          <span className="block text-xs font-normal text-slate-500">
            Public: what everyone signed in reads before buying. Say what the idea solves and who it
            is for.
          </span>
          <textarea
            rows={4}
            value={values.summary}
            onChange={(event) => set('summary', event.target.value)}
            className={`${controlClasses} mt-1 block w-full`}
          />
        </label>
        <fieldset className="space-y-4 rounded-xl border border-slate-200 p-4">
          <legend className="px-1 text-sm font-semibold text-slate-700">Full documentation</legend>
          <p className="-mt-2 text-xs text-slate-500">
            Unlocked after payment: the detailed plan, design and rollout. Upload a document, write
            it below, or both - an idea needs one of them before it goes on sale.
          </p>
          <DocumentPicker
            saved={saved}
            file={file}
            removing={removing}
            onFile={(chosen) => {
              setFile(chosen)
              if (chosen) setRemoving(false)
            }}
            onRemove={setRemoving}
          />
          <label className="block text-sm font-semibold text-slate-700">
            Written documentation
            <span className="block text-xs font-normal text-slate-500">
              Optional with a document. Lines starting with "- " become bullet lists.
            </span>
            <textarea
              rows={10}
              value={values.documentation}
              onChange={(event) => set('documentation', event.target.value)}
              className={`${controlClasses} mt-1 block w-full leading-6`}
            />
            <span className="mt-1 block text-xs font-normal text-slate-500">
              {words(values.documentation)} words
            </span>
          </label>
        </fieldset>
        <label className="block text-sm font-semibold text-slate-700">
          Price (TZS)
          <input
            type="number"
            min={0}
            step={1000}
            value={values.price}
            onChange={(event) => set('price', Number(event.target.value) || 0)}
            className={`${controlClasses} mt-1 block w-48`}
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">
            {formatPrice(values.price)} per buyer. 0 makes it free.
          </span>
        </label>
        {save.notice && <Notice tone={save.notice.tone}>{save.notice.text}</Notice>}
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={save.busy || !ready} className={primaryButtonClasses}>
            {save.busy ? 'Saving…' : idea ? 'Save changes' : 'Save as draft'}
          </button>
          <button type="button" onClick={onCancel} className={secondaryButtonClasses}>
            Cancel
          </button>
        </div>
      </form>
      <BuyerPreview values={values} document={shownDocument} />
    </div>
  )
}

/** The idea's own progress: written, priced, on sale, first sale. */
function IdeaProgress({ idea }: { idea: MarketIdea }) {
  const steps = [
    { label: 'Written', done: true },
    { label: 'Priced', done: true },
    {
      label: 'On sale',
      done: idea.status === 'published' || idea.purchasesConfirmed > 0,
    },
    { label: 'First sale', done: idea.purchasesConfirmed > 0 },
  ]
  return (
    <ol aria-label="Progress" className="grid grid-cols-4 gap-1.5">
      {steps.map((step) => (
        <li key={step.label} className="min-w-0">
          <span
            className={`block h-1.5 rounded-full ${step.done ? 'bg-brand-500' : 'bg-slate-200'}`}
          />
          <span
            className={`mt-1 block truncate text-[11px] ${
              step.done ? 'font-semibold text-brand-800' : 'text-slate-500'
            }`}
          >
            {step.label}
          </span>
        </li>
      ))}
    </ol>
  )
}

function IdeaCard({
  idea,
  canManage,
  busy,
  onEdit,
  onPublish,
}: {
  idea: MarketIdea
  canManage: boolean
  busy: boolean
  onEdit: () => void
  onPublish: (on: boolean) => void
}) {
  const stage = STAGE[stageOf(idea)]
  return (
    <li
      aria-label={idea.title}
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-semibold ${stage.tone}`}
            >
              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${stage.dot}`} />
              {stage.label}
            </span>
            {idea.hasDocument && (
              <span className="text-xs font-medium text-slate-500">📄 Document attached</span>
            )}
          </div>
          <p className="mt-2 text-lg leading-snug font-semibold text-slate-900">{idea.title}</p>
          <p className="mt-1 line-clamp-2 max-w-4xl text-sm text-slate-600 lg:line-clamp-3">
            {idea.summary}
          </p>
          <div className="mt-4 max-w-2xl">
            <IdeaProgress idea={idea} />
          </div>
        </div>
        <div className="flex flex-col gap-3 lg:border-l lg:border-slate-100 lg:pl-10">
          <p className="text-2xl font-bold text-slate-900 tabular-nums lg:text-right">
            {formatPrice(idea.price, idea.currency)}
          </p>
          <dl className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 px-3 py-2 text-center">
            <div>
              <dt className="text-[11px] font-semibold text-slate-500 uppercase">Buyers</dt>
              <dd className="font-bold text-slate-900 tabular-nums">{idea.purchasesConfirmed}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold text-slate-500 uppercase">Revenue</dt>
              <dd className="font-bold text-slate-900 tabular-nums">
                {idea.revenue.toLocaleString('en-US')}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold text-slate-500 uppercase">Waiting</dt>
              <dd
                className={`font-bold tabular-nums ${idea.paymentsWaiting ? 'text-amber-700' : 'text-slate-900'}`}
              >
                {idea.paymentsWaiting > 0 ? (
                  <Link to="/app/admin/marketplace/payments" className="underline">
                    {idea.paymentsWaiting}
                  </Link>
                ) : (
                  0
                )}
              </dd>
            </div>
          </dl>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
        <p className="text-xs text-slate-500">Updated {formatDateTime(idea.updatedAt)}</p>
        {canManage && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {idea.status === 'published' && (
              <Link
                to={`/app/marketplace/${idea.id}`}
                className="mr-2 text-sm font-semibold text-brand-700 hover:underline"
              >
                View as a buyer
              </Link>
            )}
            <button
              type="button"
              onClick={onEdit}
              className={secondaryButtonClasses}
              aria-label={`Edit ${idea.title}`}
            >
              Edit
            </button>
            {idea.status === 'published' ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => onPublish(false)}
                className={secondaryButtonClasses}
                aria-label={`Withdraw ${idea.title}`}
              >
                Withdraw
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => onPublish(true)}
                className={primaryButtonClasses}
                aria-label={`Publish ${idea.title}`}
              >
                {idea.status === 'unpublished' ? 'Put back on sale' : 'Publish'}
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  )
}

/**
 * The platform's own ideas - kept apart from the ideas customers submit - and their
 * pipeline: written as drafts, put on sale in the marketplace, bought, or withdrawn.
 * Everyone signed in sees an idea's title, summary and price; its documentation unlocks
 * once a payment is confirmed.
 */
export function AdminMarketIdeasPage() {
  const { capabilities } = useAdminCapabilities()
  const canManage = capabilities.canManageMarketplace
  const ideas = useAdminQuery(
    'market:ideas',
    adminMarketIdeasRequest,
    'We could not load the platform ideas.',
  )
  const methods = useAdminQuery(
    'market:methods',
    adminPaymentMethodsRequest,
    'We could not load the payment methods.',
  )
  const change = useAction()
  const [editing, setEditing] = useState<MarketIdea | 'new' | null>(null)
  const [filter, setFilter] = useState<Stage | 'all'>('all')
  const [message, setMessage] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const noMethods = methods.data !== null && !methods.data.some((m) => m.isActive)
  const all = ideas.data ?? []
  const count = (stage: Stage) => all.filter((idea) => stageOf(idea) === stage).length
  const shown = filter === 'all' ? all : all.filter((idea) => stageOf(idea) === filter)
  const buyers = all.reduce((sum, idea) => sum + idea.purchasesConfirmed, 0)
  const revenue = all.reduce((sum, idea) => sum + idea.revenue, 0)
  const waiting = all.reduce((sum, idea) => sum + idea.paymentsWaiting, 0)

  const publish = (idea: MarketIdea, on: boolean) =>
    void change.run(
      () => (on ? publishMarketIdea({ id: idea.id }) : unpublishMarketIdea({ id: idea.id })),
      () => {
        setMessage(
          on
            ? `“${idea.title}” is on sale: everyone signed in can now see it in the marketplace.`
            : `“${idea.title}” is withdrawn from the marketplace.`,
        )
        ideas.reload()
      },
    )

  return (
    <>
      <AdminPageHeader
        title="Platform ideas"
        description="The platform's own ideas, apart from those customers submit. Write one, put it on sale, and buyers unlock its documentation once you confirm their payment."
      />
      {!canManage && (
        <p className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You can follow the platform ideas, but writing and publishing them needs the marketplace
          permission.
        </p>
      )}
      {canManage && noMethods && (
        <p className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          There is no payment method yet, so a priced idea cannot be put on sale.{' '}
          <Link to="/app/admin/marketplace/methods" className="font-semibold underline">
            Add one in Payment methods
          </Link>
          .
        </p>
      )}
      {message && (
        <output className="mb-6 block rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </output>
      )}
      {warning && (
        <div className="mb-6">
          <Notice tone="error">{warning}</Notice>
        </div>
      )}
      {change.notice && (
        <div className="mb-6">
          <Notice tone={change.notice.tone}>{change.notice.text}</Notice>
        </div>
      )}

      {/* The pipeline: each stage, how many ideas are in it, and the stage as a filter. */}
      <section aria-label="Pipeline" className="mb-6">
        <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {STAGES.map((stage, index) => (
            <li key={stage.key} className="relative">
              <button
                type="button"
                aria-pressed={filter === stage.key}
                onClick={() => setFilter(filter === stage.key ? 'all' : stage.key)}
                className={`w-full rounded-xl border bg-white px-4 py-3 text-left shadow-sm transition ${
                  filter === stage.key
                    ? 'border-brand-500 ring-2 ring-brand-200'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center gap-2 text-sm font-semibold ${stage.tone}`}
                  >
                    <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${stage.dot}`} />
                    {index + 1}. {stage.label}
                  </span>
                  <span className="text-2xl font-bold text-slate-900 tabular-nums">
                    {count(stage.key)}
                  </span>
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">{stage.hint}</span>
              </button>
            </li>
          ))}
        </ol>
        <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2 rounded-xl bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-slate-200">
          <div className="flex items-baseline gap-2">
            <dt className="text-slate-500">Buyers</dt>
            <dd className="font-bold text-slate-900 tabular-nums">{buyers}</dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="text-slate-500">Revenue</dt>
            <dd className="font-bold text-slate-900 tabular-nums">{formatPrice(revenue)}</dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="text-slate-500">Payments waiting</dt>
            <dd
              className={`font-bold tabular-nums ${waiting ? 'text-amber-700' : 'text-slate-900'}`}
            >
              {waiting > 0 ? (
                <Link to="/app/admin/marketplace/payments" className="underline">
                  {waiting}
                </Link>
              ) : (
                0
              )}
            </dd>
          </div>
        </dl>
      </section>

      {canManage && editing !== null && (
        <div className="mb-6">
          <AdminCard title={editing === 'new' ? 'New platform idea' : `Edit: ${editing.title}`}>
            <IdeaEditor
              key={editing === 'new' ? 'new' : editing.id}
              idea={editing === 'new' ? null : editing}
              onCancel={() => setEditing(null)}
              onSaved={(_, text, problem) => {
                setEditing(null)
                setMessage(text)
                setWarning(
                  problem
                    ? `The document was not changed: ${problem} Edit the idea to try again.`
                    : null,
                )
                setFilter('all')
                ideas.reload()
              }}
            />
          </AdminCard>
        </div>
      )}

      <AdminCard
        title={filter === 'all' ? 'All platform ideas' : STAGE[filter].label}
        actions={
          canManage && editing === null ? (
            <button
              type="button"
              onClick={() => {
                setMessage(null)
                setWarning(null)
                setEditing('new')
              }}
              className={secondaryButtonClasses}
            >
              New idea
            </button>
          ) : undefined
        }
      >
        {ideas.error && <ErrorState message={ideas.error} onRetry={ideas.reload} />}
        {ideas.loading && !ideas.data && <LoadingState label="Loading platform ideas…" />}
        {ideas.data && all.length === 0 && (
          <EmptyState
            title="No platform ideas yet."
            description="Write one with “New idea”: it starts as a draft, and goes on sale when you publish it."
          />
        )}
        {ideas.data && all.length > 0 && shown.length === 0 && (
          <p className="text-sm text-slate-500">No idea is at this stage.</p>
        )}
        {shown.length > 0 && (
          <ul aria-label="Platform ideas" className="space-y-4">
            {shown.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                canManage={canManage}
                busy={change.busy}
                onEdit={() => {
                  setMessage(null)
                  setWarning(null)
                  setEditing(idea)
                }}
                onPublish={(on) => publish(idea, on)}
              />
            ))}
          </ul>
        )}
      </AdminCard>
    </>
  )
}
