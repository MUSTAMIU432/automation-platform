import { useEffect, useId, useRef, useState } from 'react'

import { NETWORK_ERROR_MESSAGE, uploadAvatarRequest } from '../auth/authApi'
import { SpinnerIcon } from './icons'

const PRIMARY_BUTTON =
  'inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 disabled:cursor-not-allowed disabled:bg-brand-300'
const SECONDARY_BUTTON =
  'inline-flex h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 disabled:opacity-60'

type Phase = 'preview' | 'uploading' | 'done'

interface PhotoUploadDialogProps {
  file: File
  /** An object URL for `file`, owned (and revoked) by the caller. */
  previewUrl: string
  /** Called with the new photo's address once the server has stored it. */
  onUploaded: (avatarUrl: string | null) => void
  onChooseAnother: () => void
  onClose: () => void
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * The profile photo's upload step, as a modal: the chosen photo is previewed
 * the way it will appear (a circle) before anything is sent, then the same
 * dialog shows it again once it is stored, so the person sees exactly what
 * their team now sees. A refusal is shown inside the dialog, where they can
 * retry or pick another photo. Escape closes it, except while the upload is in
 * flight.
 */
export function PhotoUploadDialog({
  file,
  previewUrl,
  onUploaded,
  onChooseAnother,
  onClose,
}: PhotoUploadDialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const primaryRef = useRef<HTMLButtonElement>(null)
  const [phase, setPhase] = useState<Phase>('preview')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  // The latest `onClose` and phase, so the Escape listener is set up once.
  const close = useRef(onClose)
  const uploading = useRef(false)
  useEffect(() => {
    close.current = onClose
    uploading.current = phase === 'uploading'
  }, [onClose, phase])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !uploading.current) close.current()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (phase !== 'uploading') primaryRef.current?.focus()
  }, [phase])

  async function upload() {
    setPhase('uploading')
    setError(null)
    try {
      const result = await uploadAvatarRequest(file)
      if (result.success) {
        onUploaded(result.avatarUrl)
        setMessage(result.message)
        setPhase('done')
        return
      }
      setError(result.message)
    } catch {
      setError(NETWORK_ERROR_MESSAGE)
    }
    setPhase('preview')
  }

  const done = phase === 'done'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 motion-safe:animate-[fade-in_150ms_ease-out]">
      <dialog
        open
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={phase === 'uploading'}
        className="relative m-0 w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl"
      >
        <div className="relative mx-auto h-40 w-40">
          <div className="h-full w-full overflow-hidden rounded-full bg-gray-100 ring-4 ring-brand-100">
            <img
              src={previewUrl}
              alt={done ? 'Your new profile photo' : 'Preview of your new profile photo'}
              className={`h-full w-full object-cover transition-opacity ${
                phase === 'uploading' ? 'opacity-60' : ''
              }`}
            />
          </div>
          {phase === 'uploading' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <SpinnerIcon className="h-10 w-10 animate-spin text-brand-600" />
            </div>
          )}
          {done && (
            <span className="absolute right-1 bottom-1 flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 text-white shadow-md ring-4 ring-white motion-safe:animate-[fade-in_200ms_ease-out]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </span>
          )}
        </div>

        <h2 id={titleId} className="mt-5 text-lg font-bold text-gray-900">
          {done ? 'Profile photo updated' : 'Your new profile photo'}
        </h2>
        <p id={descriptionId} className="mt-1 text-sm text-gray-600">
          {done
            ? message || 'Your team and reviewers will now see this photo.'
            : 'This is how your team and reviewers will see you.'}
        </p>
        {!done && (
          <p className="mt-1 truncate text-xs text-gray-400">
            {file.name} · {formatSize(file.size)}
          </p>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {done ? (
          <div className="mt-6">
            <button
              ref={primaryRef}
              type="button"
              onClick={onClose}
              className={`w-full ${PRIMARY_BUTTON}`}
            >
              Done
            </button>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-2">
            <button
              ref={primaryRef}
              type="button"
              onClick={() => void upload()}
              disabled={phase === 'uploading'}
              className={`w-full ${PRIMARY_BUTTON}`}
            >
              {phase === 'uploading' ? 'Uploading…' : error ? 'Try again' : 'Upload photo'}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={phase === 'uploading'}
                className={SECONDARY_BUTTON}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onChooseAnother}
                disabled={phase === 'uploading'}
                className={SECONDARY_BUTTON}
              >
                Choose another
              </button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  )
}
