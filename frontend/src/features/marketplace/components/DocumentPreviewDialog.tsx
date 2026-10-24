import { useEffect, useId, useRef, useState } from 'react'

import { ProposalText } from '../../proposals/components/ProposalSections'
import { fetchMarketDocument, type MarketDocument } from '../api/marketplaceApi'

/**
 * What to show: the document already saved, a file chosen but not uploaded yet, or the
 * idea's written documentation.
 */
export type PreviewSource =
  | { file: File }
  | { saved: MarketDocument }
  | { written: { title: string; text: string } }

type State = { status: 'loading' } | { status: 'failed' } | { status: 'ready'; pdfUrl?: string }

function nameOf(source: PreviewSource): string {
  if ('file' in source) return source.file.name
  if ('saved' in source) return source.saved.filename
  return source.written.title
}

/**
 * A document shown in place, as the buyer will get it, filling most of the screen. A PDF
 * opens in the browser's own viewer; a Word (.docx) file is laid out page by page by
 * `docx-preview`, loaded only when a Word preview is opened; written documentation is set
 * as a page.
 */
export function DocumentPreviewDialog({
  source,
  onClose,
}: {
  source: PreviewSource
  onClose: () => void
}) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const pagesRef = useRef<HTMLDivElement>(null)
  const name = nameOf(source)
  const kind =
    'written' in source ? 'written' : name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'docx'
  const [state, setState] = useState<State>(
    kind === 'written' ? { status: 'ready' } : { status: 'loading' },
  )

  // The latest `onClose`, so Escape always calls the current one.
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  }, [onClose])

  useEffect(() => {
    closeRef.current?.focus()
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close.current()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if ('written' in source) return
    let cancelled = false
    let pdfUrl: string | null = null
    const bytes =
      'file' in source ? Promise.resolve(source.file) : fetchMarketDocument(source.saved)

    async function show() {
      const blob = await bytes
      if (cancelled) return
      if (kind === 'pdf') {
        // Typed explicitly: a chosen file's type is whatever the browser guessed.
        pdfUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
        setState({ status: 'ready', pdfUrl })
        return
      }
      const { renderAsync } = await import('docx-preview')
      if (cancelled || !pagesRef.current) return
      await renderAsync(blob, pagesRef.current, undefined, {
        className: 'docx',
        inWrapper: true,
        breakPages: true,
        // An "altChunk" is HTML embedded in the file; it is never rendered.
        renderAltChunks: false,
        useBase64URL: true,
      })
      if (!cancelled) setState({ status: 'ready' })
    }

    show().catch(() => {
      if (!cancelled) setState({ status: 'failed' })
    })
    return () => {
      cancelled = true
      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    }
  }, [kind, source])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-2 sm:p-4">
      <dialog
        open
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative m-0 flex h-[96vh] w-full max-w-7xl flex-col overflow-hidden rounded-xl bg-white text-left shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-slate-200 py-2 pr-2 pl-5">
          <span aria-hidden="true">{kind === 'written' ? '📝' : '📄'}</span>
          <h2 id={titleId} className="min-w-0 flex-1 truncate text-base font-bold text-slate-900">
            {name}
          </h2>
          {kind !== 'written' && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
              {kind === 'pdf' ? 'PDF' : 'Word'}
            </span>
          )}
          {'file' in source && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
              Not uploaded yet
            </span>
          )}
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="relative min-h-0 flex-1 bg-slate-100">
          {'written' in source && (
            <div className="h-full overflow-auto px-4 py-6 sm:py-10">
              <article
                aria-label={`Preview of ${name}`}
                className="mx-auto max-w-3xl rounded-lg bg-white px-6 py-8 shadow-sm sm:px-12 sm:py-12"
              >
                <ProposalText text={source.written.text} />
              </article>
            </div>
          )}
          {state.status === 'ready' && state.pdfUrl && (
            <object
              data={state.pdfUrl}
              type="application/pdf"
              aria-label={`Preview of ${name}`}
              className="h-full w-full"
            >
              <p className="p-6 text-center text-sm text-slate-600">
                This browser cannot show PDFs here. Download the document to read it.
              </p>
            </object>
          )}
          {kind === 'docx' && (
            <div
              ref={pagesRef}
              role="document"
              aria-label={`Preview of ${name}`}
              className="h-full overflow-auto"
            />
          )}
          {state.status !== 'ready' && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
              {state.status === 'failed' ? (
                <p role="alert" className="px-6 text-center text-sm text-red-700">
                  We could not show this document. Check that it opens on your computer, then try
                  again.
                </p>
              ) : (
                <p className="text-sm text-slate-500">Loading the preview…</p>
              )}
            </div>
          )}
        </div>
      </dialog>
    </div>
  )
}
