import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'

import { ContentBlocks } from '../../learning/components/ContentBlocks'
import { downloadLessonFile, formatFileSize } from '../../learning/api/learningApi'
import type { ContentBlock } from '../../learning/api/learningApi'
import {
  adminLessonRequest,
  deleteLessonMaterialRequest,
  previewContentRequest,
  updateLessonRequest,
  uploadLessonMaterialRequest,
  type AdminLesson,
} from '../api/courseAuthoringApi'
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
import { BackLink } from '../components/BackLink'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ExternalResourceManager } from '../components/ExternalResourceManager'
import { useAdminQuery } from '../hooks/useAdminQuery'

const FORMAT_HELP = [
  ['## Heading', 'a section heading'],
  ['- item', 'a bullet list (one item per line)'],
  ['> text', 'a highlighted note'],
  ['```python … ```', 'a code example (or ```text for output)'],
  ['`code`, **bold**', 'inline code and bold text'],
]

/** The server's own reading of the notes, a moment after typing stops. */
function usePreview(source: string) {
  const [preview, setPreview] = useState<{ blocks: ContentBlock[]; error: string | null } | null>(
    null,
  )
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      previewContentRequest(source)
        .then((result) => {
          if (!cancelled) setPreview(result)
        })
        .catch(() => {
          if (!cancelled) setPreview({ blocks: [], error: 'The preview could not be loaded.' })
        })
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [source])
  return preview
}

function NotesForm({ lesson, onSaved }: { lesson: AdminLesson; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: lesson.title,
    summary: lesson.summary,
    objectives: lesson.objectives.join('\n'),
    estimatedMinutes: String(lesson.estimatedMinutes),
    body: lesson.body,
  })
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const preview = usePreview(form.body)

  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setResult(null)
    try {
      const outcome = await updateLessonRequest(lesson.id, {
        title: form.title,
        summary: form.summary,
        objectives: form.objectives
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
        estimatedMinutes: Number(form.estimatedMinutes) || 15,
        body: form.body,
      })
      setResult({ tone: outcome.success ? 'success' : 'error', text: outcome.message })
      if (outcome.success) onSaved()
    } catch {
      setResult({ tone: 'error', text: 'We could not reach the server. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }))

  return (
    <form onSubmit={(event) => void save(event)} className="space-y-4" aria-label="Lesson">
      <div className="grid gap-4 md:grid-cols-[1fr_10rem]">
        <label className="text-sm font-semibold text-slate-700">
          Title
          <input
            value={form.title}
            onChange={set('title')}
            className={`${controlClasses} mt-1 w-full`}
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Minutes
          <input
            type="number"
            min={1}
            value={form.estimatedMinutes}
            onChange={set('estimatedMinutes')}
            className={`${controlClasses} mt-1 w-full`}
          />
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">
          Summary
          <textarea
            rows={3}
            value={form.summary}
            onChange={set('summary')}
            className={`${controlClasses} mt-1 w-full`}
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Objectives (one per line)
          <textarea
            rows={3}
            value={form.objectives}
            onChange={set('objectives')}
            className={`${controlClasses} mt-1 w-full`}
          />
        </label>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">
          Notes
          <textarea
            rows={24}
            value={form.body}
            onChange={set('body')}
            spellCheck
            className={`${controlClasses} mt-1 w-full font-mono text-[13px] leading-6`}
          />
        </label>
        <div>
          <p className="text-sm font-semibold text-slate-700">Preview - what learners will read</p>
          <div className="mt-1 max-h-[38rem] overflow-y-auto rounded-xl border border-slate-200 bg-white p-5">
            {preview?.error ? (
              <p role="alert" className="text-sm text-red-700">
                {preview.error}
              </p>
            ) : preview ? (
              <ContentBlocks blocks={preview.blocks} />
            ) : (
              <p className="text-sm text-slate-400">Preparing the preview…</p>
            )}
          </div>
        </div>
      </div>
      <details className="rounded-xl bg-slate-50 px-4 py-2 text-sm text-slate-600">
        <summary className="cursor-pointer font-semibold">How to format notes</summary>
        <dl className="mt-2 grid gap-1 sm:grid-cols-[12rem_1fr]">
          {FORMAT_HELP.map(([syntax, meaning]) => (
            <div key={syntax} className="contents">
              <dt className="font-mono text-xs text-slate-800">{syntax}</dt>
              <dd>{meaning}</dd>
            </div>
          ))}
        </dl>
      </details>
      {result && <Notice tone={result.tone}>{result.text}</Notice>}
      <button
        type="submit"
        disabled={busy || Boolean(preview?.error)}
        className={primaryButtonClasses}
      >
        Save lesson
      </button>
    </form>
  )
}

function Files({ lesson, onChanged }: { lesson: AdminLesson; onChanged: () => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function upload(event: FormEvent) {
    event.preventDefault()
    const file = input.current?.files?.[0]
    if (!file) {
      setResult({ tone: 'error', text: 'Choose a file to upload.' })
      return
    }
    setBusy(true)
    setResult(null)
    const outcome = await uploadLessonMaterialRequest(lesson.id, file, title)
    setResult({ tone: outcome.success ? 'success' : 'error', text: outcome.message })
    setBusy(false)
    if (outcome.success) {
      setTitle('')
      if (input.current) input.current.value = ''
      onChanged()
    }
  }

  async function remove(id: string) {
    setBusy(true)
    try {
      const outcome = await deleteLessonMaterialRequest(id)
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
        Notes, slides, worksheets or example code for this lesson - PDF, Word, PowerPoint, Excel,
        CSV, text, Python or images. Enrolled learners can download them; nobody else can.
      </p>
      {lesson.materials.length > 0 ? (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {lesson.materials.map((file) => (
            <li key={file.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-900">{file.title}</span>
                <span className="block text-xs text-slate-500">
                  {file.filename} · {formatFileSize(file.size)}
                </span>
              </span>
              <button
                type="button"
                className={secondaryButtonClasses}
                onClick={() =>
                  void downloadLessonFile(file).catch(() =>
                    setResult({ tone: 'error', text: 'Could not download.' }),
                  )
                }
              >
                Download
              </button>
              <button
                type="button"
                className={secondaryButtonClasses}
                onClick={() => setDeleting(file.id)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">No files yet.</p>
      )}
      <form
        onSubmit={(event) => void upload(event)}
        className="flex flex-wrap items-end gap-2"
        aria-label="Upload a file"
      >
        <label className="text-sm font-semibold text-slate-700">
          File
          <input ref={input} type="file" className="mt-1 block text-sm" />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Title (optional)
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Week 1 slides"
            className={`${controlClasses} mt-1 block w-64`}
          />
        </label>
        <button type="submit" disabled={busy} className={primaryButtonClasses}>
          {busy ? 'Uploading…' : 'Upload'}
        </button>
      </form>
      {result && <Notice tone={result.tone}>{result.text}</Notice>}
      {deleting && (
        <ConfirmDialog
          title="Delete this file"
          confirmLabel="Delete"
          danger
          busy={busy}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void remove(deleting)}
        >
          Learners will no longer be able to download it. This cannot be undone.
        </ConfirmDialog>
      )}
    </div>
  )
}

/** `/app/admin/courses/:courseId/lessons/:lessonId`: a lesson's notes, files and external resources. */
export function AdminLessonEditorPage() {
  const { courseId = '', lessonId = '' } = useParams()
  const lesson = useAdminQuery(
    `admin-lesson:${lessonId}`,
    () => adminLessonRequest(lessonId),
    'We could not load this lesson.',
  )

  if (lesson.error) return <ErrorState message={lesson.error} onRetry={lesson.reload} />
  if (lesson.loading && !lesson.data) return <LoadingState label="Loading the lesson…" />
  if (!lesson.data) return <EmptyState title="This lesson does not exist." />

  const data = lesson.data
  return (
    <>
      <AdminPageHeader
        back={<BackLink to={`/app/admin/courses/${courseId}`}>{data.courseTitle}</BackLink>}
        title={data.title}
        description={`Module: ${data.moduleTitle}`}
      />
      <div className="space-y-6">
        <AdminCard title="Lesson notes">
          <NotesForm key={data.id} lesson={data} onSaved={lesson.reload} />
        </AdminCard>
        <AdminCard title="Files">
          <Files lesson={data} onChanged={lesson.reload} />
        </AdminCard>
        <AdminCard title="External resources">
          <ExternalResourceManager lesson={data} onChanged={lesson.reload} />
        </AdminCard>
      </div>
    </>
  )
}
