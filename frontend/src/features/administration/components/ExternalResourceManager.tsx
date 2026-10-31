import { useState, type FormEvent } from 'react'

import { EmbeddedResourceViewer } from '../../learning/components/ExternalResource'
import { isWebAddress } from '../../learning/components/externalResourceRules'
import {
  createLessonResourceRequest,
  deleteLessonResourceRequest,
  setLessonResourcePublishedRequest,
  updateLessonResourceRequest,
  type AdminLesson,
  type AdminResource,
  type ResourceInput,
} from '../api/courseAuthoringApi'
import {
  Badge,
  Notice,
  controlClasses,
  primaryButtonClasses,
  secondaryButtonClasses,
} from './AdminUi'
import { ConfirmDialog } from './ConfirmDialog'
import { EditorModal } from './EditorModal'

const KINDS: Array<{ value: ResourceInput['kind']; label: string }> = [
  { value: 'embed', label: 'Embedded webpage' },
  { value: 'link', label: 'Link only (for a site that does not allow embedding)' },
]

const EMPTY: ResourceInput = {
  title: '',
  url: '',
  description: '',
  kind: 'embed',
  displayOrder: null,
  isPublished: false,
}

type Result = { tone: 'success' | 'error'; text: string } | null

function inputFrom(resource: AdminResource): ResourceInput {
  return {
    title: resource.title,
    url: resource.url,
    description: resource.description,
    kind: resource.kind,
    displayOrder: resource.displayOrder,
    isPublished: resource.isPublished,
  }
}

/** Add or edit one resource: the page's address, how it is shown, and whether learners see it. */
function ResourceForm({
  lesson,
  editing,
  onClose,
  onSaved,
}: {
  lesson: AdminLesson
  editing: AdminResource | null
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [form, setForm] = useState<ResourceInput>(editing ? inputFrom(editing) : EMPTY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ field: string | null; message: string } | null>(null)
  const set = (change: Partial<ResourceInput>) => setForm((current) => ({ ...current, ...change }))
  const fieldError = (field: string) =>
    error?.field === field ? (
      <span role="alert" className="mt-1 block text-xs font-medium text-red-700">
        {error.message}
      </span>
    ) : null

  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const outcome = editing
        ? await updateLessonResourceRequest(editing.id, form)
        : await createLessonResourceRequest(lesson.id, form)
      if (outcome.success) onSaved(outcome.message)
      else setError({ field: outcome.field, message: outcome.message })
    } catch {
      setError({ field: null, message: 'We could not reach the server. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <EditorModal
      title={editing ? 'Edit external resource' : 'Add an external resource'}
      description="A web page learners read inside this lesson. It loads from its own site; MUSTANET never copies it."
      onClose={onClose}
      wide
    >
      <form
        onSubmit={(event) => void save(event)}
        className="space-y-4 overflow-y-auto px-6 py-5"
        aria-label="External resource"
      >
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200">
          <span className="font-semibold text-slate-700">Shown in:</span> {lesson.courseTitle} ›{' '}
          {lesson.moduleTitle} › {lesson.title}
        </p>
        <label className="block text-sm font-semibold text-slate-700">
          Resource title
          <input
            value={form.title}
            onChange={(event) => set({ title: event.target.value })}
            placeholder="e.g. Python Objects and Classes - CodeWithHarry"
            className={`${controlClasses} mt-1 block w-full`}
          />
          {fieldError('title')}
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Description
          <textarea
            value={form.description}
            onChange={(event) => set({ description: event.target.value })}
            rows={2}
            placeholder="One or two lines on what learners will find there."
            className={`${controlClasses} mt-1 block w-full`}
          />
          {fieldError('description')}
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Web address
          <input
            type="url"
            inputMode="url"
            value={form.url}
            onChange={(event) => set({ url: event.target.value })}
            placeholder="https://"
            className={`${controlClasses} mt-1 block w-full`}
          />
          {fieldError('url')}
        </label>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
          <label className="block text-sm font-semibold text-slate-700">
            Resource type
            <select
              value={form.kind}
              onChange={(event) => set({ kind: event.target.value as ResourceInput['kind'] })}
              className={`${controlClasses} mt-1 block w-full`}
            >
              {KINDS.map((kind) => (
                <option key={kind.value} value={kind.value}>
                  {kind.label}
                </option>
              ))}
            </select>
            {fieldError('kind')}
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Display order
            <input
              type="number"
              min={1}
              max={999}
              value={form.displayOrder ?? ''}
              onChange={(event) =>
                set({ displayOrder: event.target.value ? Number(event.target.value) : null })
              }
              placeholder="Last"
              className={`${controlClasses} mt-1 block w-full`}
            />
            {fieldError('displayOrder')}
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={form.isPublished}
            onChange={(event) => set({ isPublished: event.target.checked })}
            className="h-4 w-4 accent-brand-600"
          />
          Published - learners see it in the lesson
        </label>
        {error && !error.field && <Notice tone="error">{error.message}</Notice>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} className={secondaryButtonClasses}>
            Cancel
          </button>
          <button type="submit" disabled={busy} className={primaryButtonClasses}>
            {busy ? 'Saving…' : editing ? 'Save resource' : 'Add resource'}
          </button>
        </div>
      </form>
    </EditorModal>
  )
}

/**
 * A lesson's external resources in the console: add a web page, preview it as
 * learners will see it (which shows at once whether its site allows embedding),
 * edit it, publish or unpublish it, and delete it.
 */
export function ExternalResourceManager({
  lesson,
  onChanged,
}: {
  lesson: AdminLesson
  onChanged: () => void
}) {
  const [editing, setEditing] = useState<AdminResource | 'new' | null>(null)
  const [previewing, setPreviewing] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<AdminResource | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result>(null)

  async function run(action: () => Promise<{ success: boolean; message: string }>) {
    setBusy(true)
    setResult(null)
    try {
      const outcome = await action()
      setResult({ tone: outcome.success ? 'success' : 'error', text: outcome.message })
      if (outcome.success) onChanged()
    } catch {
      setResult({ tone: 'error', text: 'We could not reach the server. Please try again.' })
    } finally {
      setBusy(false)
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Web pages learners read inside this lesson, after its objectives. A page loads from its own
        site in the learner&apos;s browser. Some sites do not allow being shown inside other sites:
        preview it first, and if it stays blank, choose &quot;Link only&quot;.
      </p>
      {lesson.resources.length > 0 ? (
        <ul className="space-y-3">
          {lesson.resources.map((resource) => (
            <li key={resource.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{resource.title}</span>
                    <Badge tone={resource.isPublished ? 'good' : 'neutral'}>
                      {resource.isPublished ? 'Published' : 'Draft'}
                    </Badge>
                    <span className="text-xs text-slate-500">
                      {resource.kind === 'embed' ? 'Embedded webpage' : 'Link only'} · order{' '}
                      {resource.displayOrder}
                    </span>
                  </div>
                  {resource.description && (
                    <p className="mt-1 text-sm text-slate-600">{resource.description}</p>
                  )}
                  {isWebAddress(resource.url) && (
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block truncate text-xs text-brand-700 hover:underline"
                    >
                      {resource.url}
                    </a>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {resource.kind === 'embed' && (
                    <button
                      type="button"
                      className={secondaryButtonClasses}
                      aria-expanded={previewing === resource.id}
                      onClick={() =>
                        setPreviewing((current) => (current === resource.id ? null : resource.id))
                      }
                    >
                      {previewing === resource.id ? 'Hide preview' : 'Preview'}
                    </button>
                  )}
                  <button
                    type="button"
                    className={secondaryButtonClasses}
                    onClick={() => setEditing(resource)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className={secondaryButtonClasses}
                    onClick={() =>
                      void run(() =>
                        setLessonResourcePublishedRequest(resource.id, !resource.isPublished),
                      )
                    }
                  >
                    {resource.isPublished ? 'Unpublish' : 'Publish'}
                  </button>
                  <button
                    type="button"
                    className={secondaryButtonClasses}
                    onClick={() => setDeleting(resource)}
                  >
                    Delete
                  </button>
                </div>
              </div>
              {previewing === resource.id && (
                <div className="mt-4">
                  <EmbeddedResourceViewer resource={resource} />
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">No external resources yet.</p>
      )}
      <button type="button" className={primaryButtonClasses} onClick={() => setEditing('new')}>
        Add external resource
      </button>
      {result && <Notice tone={result.tone}>{result.text}</Notice>}
      {editing && (
        <ResourceForm
          lesson={lesson}
          editing={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null)
            setResult({ tone: 'success', text: message })
            onChanged()
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this resource"
          confirmLabel="Delete"
          danger
          busy={busy}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void run(() => deleteLessonResourceRequest(deleting.id))}
        >
          Learners will no longer see &quot;{deleting.title}&quot; in this lesson. The page itself
          is not affected.
        </ConfirmDialog>
      )}
    </div>
  )
}
