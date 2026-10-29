import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { CloseIcon, DocumentIcon } from '../../../components/AppIcons'
import { fetchLessonFileUrl, formatFileSize, type LessonFile } from '../api/learningApi'

/** A file to preview: one already uploaded to a lesson, or one picked but not yet uploaded. */
export type PreviewFile =
  | { saved: Pick<LessonFile, 'title' | 'filename' | 'contentType' | 'size' | 'downloadUrl'> }
  | { local: File }

const PREVIEWABLE = ['application/pdf', 'image/png', 'image/jpeg']

function details(file: PreviewFile) {
  if ('local' in file) {
    const type = file.local.type || (/\.pdf$/i.test(file.local.name) ? 'application/pdf' : '')
    return { title: file.local.name, filename: file.local.name, type, size: file.local.size }
  }
  const { title, filename, contentType, size } = file.saved
  return { title, filename, type: contentType, size }
}

/** What was loaded, and for which file: a result for another file means "still loading". */
type Loaded =
  | { for: File | string | null; status: 'failed' }
  | { for: File | string | null; status: 'ready'; url: string }

const headerButton =
  'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 disabled:opacity-50'

/**
 * A lesson file shown in the app, filling most of the screen: a PDF in the browser's own
 * viewer, an image as itself, anything else as a card with its download. Download and
 * "open in a new tab" sit in the header; several files are switched between with tabs.
 * The file is fetched once with the reader's token and kept as an object URL while the
 * preview is open.
 */
export function FilePreviewDialog({
  files,
  initial = 0,
  onClose,
}: {
  files: PreviewFile[]
  initial?: number
  onClose: () => void
}) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const [index, setIndex] = useState(initial)
  const [result, setResult] = useState<Loaded | null>(null)
  const current = files[index]
  const info = details(current)
  const previewable = PREVIEWABLE.includes(info.type)

  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  }, [onClose])
  useEffect(() => {
    closeRef.current?.focus()
    // On `window`, in the capture phase: Escape closes this preview only, never a dialog
    // underneath it (the PDF upload dialog opens previews on top of itself).
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      close.current()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  // What identifies the file, rather than the object describing it, which a caller may
  // rebuild on every render.
  const local = 'local' in current ? current.local : null
  const savedUrl = 'saved' in current ? current.saved.downloadUrl : null
  const savedType = 'saved' in current ? current.saved.contentType : ''
  const source = local ?? savedUrl
  const loaded: Loaded | { status: 'loading' } =
    result && result.for === source ? result : { status: 'loading' }

  useEffect(() => {
    let cancelled = false
    let url: string | null = null
    const target = local ?? savedUrl
    const load = local
      ? Promise.resolve(URL.createObjectURL(local))
      : fetchLessonFileUrl({ downloadUrl: savedUrl ?? '', contentType: savedType })
    load
      .then((made) => {
        url = made
        if (cancelled) URL.revokeObjectURL(made)
        else setResult({ for: target, status: 'ready', url: made })
      })
      .catch(() => {
        if (!cancelled) setResult({ for: target, status: 'failed' })
      })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [local, savedUrl, savedType])

  function download() {
    if (loaded.status !== 'ready') return
    const link = document.createElement('a')
    link.href = loaded.url
    link.download = info.filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-[2px] sm:p-6">
      <button
        type="button"
        aria-label="Close preview"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <dialog
        open
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative m-0 flex h-full max-h-[calc(100dvh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white p-0 text-left shadow-2xl sm:max-h-[calc(100dvh-3rem)]"
      >
        <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600 ring-1 ring-red-100">
            <DocumentIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate text-base font-semibold text-slate-900">
              {info.title}
            </h2>
            <p className="truncate text-xs text-slate-500">
              {info.filename} · {formatFileSize(info.size)}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {previewable && loaded.status === 'ready' && (
              <a
                href={loaded.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`${headerButton} text-slate-600 hover:bg-slate-100`}
              >
                Open in new tab
              </a>
            )}
            <button
              type="button"
              onClick={download}
              disabled={loaded.status !== 'ready'}
              className={`${headerButton} bg-linear-to-b from-brand-600 to-brand-700 text-white shadow-sm hover:from-brand-700 hover:to-brand-800`}
            >
              Download
            </button>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        </header>

        {files.length > 1 && (
          <nav
            aria-label="Files"
            className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50 px-3 py-2"
          >
            {files.map((file, at) => (
              <button
                key={at}
                type="button"
                aria-current={at === index ? 'true' : undefined}
                onClick={() => setIndex(at)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap ${
                  at === index
                    ? 'bg-white text-brand-800 shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {details(file).title}
              </button>
            ))}
          </nav>
        )}

        <div className="min-h-0 flex-1 bg-slate-100">
          {loaded.status === 'loading' && (
            <p className="flex h-full items-center justify-center gap-3 text-sm text-slate-500">
              <span
                aria-hidden="true"
                className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600"
              />
              Loading the file…
            </p>
          )}
          {loaded.status === 'failed' && (
            <p
              role="alert"
              className="flex h-full items-center justify-center text-sm text-red-700"
            >
              This file could not be loaded. Please try again.
            </p>
          )}
          {loaded.status === 'ready' &&
            (info.type === 'application/pdf' ? (
              <object
                data={loaded.url}
                type="application/pdf"
                aria-label={`Preview of ${info.title}`}
                className="h-full w-full"
              >
                <p className="p-6 text-center text-sm text-slate-600">
                  This browser cannot show PDFs here. Use Download to open it.
                </p>
              </object>
            ) : previewable ? (
              <div className="flex h-full items-center justify-center overflow-auto p-4">
                <img
                  src={loaded.url}
                  alt={info.title}
                  className="max-h-full max-w-full rounded-lg shadow"
                />
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
                <p className="text-sm font-semibold text-slate-800">
                  This kind of file cannot be shown here.
                </p>
                <p className="text-sm text-slate-500">Download it to open it on your device.</p>
              </div>
            ))}
        </div>
      </dialog>
    </div>,
    document.body,
  )
}
