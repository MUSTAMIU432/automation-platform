import { useEffect, useId, useRef, useState, type DragEvent } from 'react'

import { CheckCircleIcon, DocumentIcon } from '../../../components/AppIcons'
import { FilePreviewDialog } from '../../learning/components/FilePreviewDialog'
import {
  createLessonRequest,
  deleteLessonRequest,
  uploadLessonMaterialRequest,
} from '../api/courseAuthoringApi'
import {
  EyeIcon,
  IconButton,
  TrashIcon,
  brandButton,
  inputClasses,
  quietButton,
} from './CourseEditorUi'
import { EditorModal } from './EditorModal'

/**
 * A new PDF lesson's stand-in notes. The server replaces them with notes read from
 * the PDF (learning/pdf_import.py); they stay only when the file has no readable
 * text, such as a scan. Must match `PDF_PLACEHOLDER_BODY` in learning/authoring.py.
 */
const PDF_LESSON_BODY =
  'The notes for this lesson are in the attached PDF. Open or download it below.'

type Status = 'ready' | 'uploading' | 'done' | 'failed'

interface Pending {
  key: string
  file: File
  title: string
  status: Status
  error?: string
  /** Done: whether the lesson's notes were made from the PDF. */
  notesWritten?: boolean
}

/** A lesson title from a file name: `02-data_types.pdf` reads "02 data types". */
function titleFromFile(name: string): string {
  const base = name
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return (base.charAt(0).toUpperCase() + base.slice(1)).slice(0, 200) || 'Untitled lesson'
}

const isPdf = (file: File) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name)

function size(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Upload PDFs as lessons: pick or drop the files, choose the module, check each
 * lesson's title, and every file becomes a lesson in that module with the PDF
 * attached. One at a time, so each file's result is its own; a lesson whose file
 * the server refuses is removed again, never left empty.
 */
export function PdfUploadDialog({
  modules,
  initialModuleId,
  onUploaded,
  onClose,
}: {
  modules: Array<{ id: string; title: string; number: number }>
  initialModuleId: string | null
  onUploaded: () => void
  onClose: () => void
}) {
  const inputId = useId()
  const moduleId = useId()
  const pickerRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<Pending[]>([])
  const [target, setTarget] = useState(initialModuleId ?? modules[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [refused, setRefused] = useState<string | null>(null)
  const [over, setOver] = useState(false)
  const [previewing, setPreviewing] = useState<File | null>(null)
  const waiting = files.filter((file) => file.status === 'ready' || file.status === 'failed')
  const finished = files.length > 0 && files.every((file) => file.status === 'done')

  useEffect(() => pickerRef.current?.focus(), [])

  function add(list: FileList | null) {
    const chosen = Array.from(list ?? [])
    const pdfs = chosen.filter(isPdf)
    setRefused(
      pdfs.length < chosen.length
        ? `Only PDF files can be uploaded here; ${chosen.length - pdfs.length} other file(s) left out.`
        : null,
    )
    setFiles((current) => [
      ...current,
      ...pdfs.map((file) => ({
        key: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
        file,
        title: titleFromFile(file.name),
        status: 'ready' as const,
      })),
    ])
  }

  function patch(key: string, change: Partial<Pending>) {
    setFiles((current) => current.map((file) => (file.key === key ? { ...file, ...change } : file)))
  }

  async function uploadAll() {
    if (!target) return
    setBusy(true)
    for (const item of waiting) {
      patch(item.key, { status: 'uploading', error: undefined })
      try {
        const created = await createLessonRequest(target, {
          title: item.title,
          summary: '',
          objectives: [],
          estimatedMinutes: 15,
          body: PDF_LESSON_BODY,
        })
        if (!created.success || !created.id) {
          patch(item.key, { status: 'failed', error: created.message })
          continue
        }
        const attached = await uploadLessonMaterialRequest(created.id, item.file, item.title)
        if (attached.success) {
          patch(item.key, { status: 'done', notesWritten: attached.notesWritten === true })
        } else {
          await deleteLessonRequest(created.id).catch(() => null)
          patch(item.key, { status: 'failed', error: attached.message })
        }
      } catch {
        patch(item.key, { status: 'failed', error: 'We could not reach the server.' })
      }
    }
    setBusy(false)
    onUploaded()
  }

  function drop(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    setOver(false)
    if (!busy) add(event.dataTransfer.files)
  }

  const closeIfIdle = () => {
    if (!busy) onClose()
  }

  return (
    <EditorModal
      title="Upload PDFs as lessons"
      description="Each PDF becomes a lesson in the module you choose: its notes are written from the PDF, and the file stays attached for learners."
      onClose={closeIfIdle}
      wide
    >
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
        {modules.length === 0 ? (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
            Add a module first: every lesson belongs to one.
          </p>
        ) : (
          <div>
            <label htmlFor={moduleId} className="block text-sm font-semibold text-slate-800">
              Module
            </label>
            <select
              id={moduleId}
              value={target}
              disabled={busy}
              onChange={(event) => setTarget(event.target.value)}
              className={`${inputClasses} mt-1.5`}
            >
              {modules.map((module) => (
                <option key={module.id} value={module.id}>
                  {module.number}. {module.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* A drop target; the file picker inside it is the keyboard path. */}
        {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
        <label
          htmlFor={inputId}
          onDragOver={(event) => {
            event.preventDefault()
            setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={drop}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center motion-safe:transition-colors ${
            over
              ? 'border-brand-400 bg-brand-50/70'
              : 'border-slate-300 bg-slate-50/60 hover:border-brand-300 hover:bg-brand-50/40'
          }`}
        >
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-brand-600 shadow-sm ring-1 ring-slate-200">
            <DocumentIcon className="h-5 w-5" />
          </span>
          <span className="text-sm font-semibold text-slate-800">
            Drop PDFs here, or <span className="text-brand-700 underline">choose files</span>
          </span>
          <span className="text-xs text-slate-500">PDF only. You can add several at once.</span>
          <input
            ref={pickerRef}
            id={inputId}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            disabled={busy}
            aria-label="Choose PDF files"
            onChange={(event) => {
              add(event.target.files)
              event.target.value = ''
            }}
            className="sr-only"
          />
        </label>
        {refused && (
          <p role="alert" className="text-sm text-amber-800">
            {refused}
          </p>
        )}

        {files.length > 0 && (
          <ul aria-label="Files to upload" className="space-y-2">
            {files.map((item) => (
              <li
                key={item.key}
                className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-red-50 text-[10px] font-bold text-red-600 ring-1 ring-red-100">
                    PDF
                  </span>
                  <div className="min-w-0 flex-1">
                    <input
                      value={item.title}
                      disabled={busy || item.status === 'done'}
                      onChange={(event) => patch(item.key, { title: event.target.value })}
                      aria-label={`Lesson title for ${item.file.name}`}
                      className={`${inputClasses} py-1.5 font-medium`}
                    />
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {item.file.name} · {size(item.file.size)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewing(item.file)}
                    aria-label={`Preview ${item.file.name}`}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 ring-1 ring-brand-100 hover:bg-brand-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
                  >
                    <EyeIcon className="h-3.5 w-3.5" /> Preview
                  </button>
                  {item.status === 'done' ? (
                    <span
                      className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"
                      title={
                        item.notesWritten
                          ? 'The lesson notes were written from the PDF.'
                          : 'The PDF has no readable text (a scan?), so the lesson offers the file.'
                      }
                    >
                      <CheckCircleIcon className="h-4 w-4" />
                      {item.notesWritten ? 'Added, notes written' : 'Added, file only'}
                    </span>
                  ) : item.status === 'uploading' ? (
                    <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-500">
                      <span
                        aria-hidden="true"
                        className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600"
                      />
                      Uploading
                    </span>
                  ) : (
                    <IconButton
                      label={`Remove ${item.file.name}`}
                      tone="danger"
                      disabled={busy}
                      onClick={() =>
                        setFiles((current) => current.filter((file) => file.key !== item.key))
                      }
                    >
                      <TrashIcon />
                    </IconButton>
                  )}
                </div>
                {item.status === 'failed' && item.error && (
                  <p
                    role="alert"
                    className="mt-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-800"
                  >
                    {item.error}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-slate-200/80 px-6 py-4">
        <span className="text-sm text-slate-500" aria-live="polite">
          {finished
            ? `${files.length} lesson${files.length === 1 ? '' : 's'} added.`
            : files.length === 0
              ? 'No files chosen yet.'
              : `${waiting.length} to upload`}
        </span>
        <div className="flex gap-2">
          <button type="button" onClick={closeIfIdle} disabled={busy} className={quietButton}>
            {finished ? 'Close' : 'Cancel'}
          </button>
          {!finished && (
            <button
              type="button"
              onClick={() => void uploadAll()}
              disabled={
                busy || !target || waiting.length === 0 || waiting.some((f) => !f.title.trim())
              }
              className={brandButton}
            >
              {busy
                ? 'Uploading…'
                : `Upload ${waiting.length || ''} ${waiting.length === 1 ? 'PDF' : 'PDFs'}`.replace(
                    /\s+/g,
                    ' ',
                  )}
            </button>
          )}
        </div>
      </footer>
      {previewing && (
        <FilePreviewDialog files={[{ local: previewing }]} onClose={() => setPreviewing(null)} />
      )}
    </EditorModal>
  )
}
