import { GoogleIcon } from './icons'

interface GoogleAuthButtonProps {
  label?: string
  disabled?: boolean
}

/**
 * Visually and structurally ready for Google sign-in. The real flow (React
 * -> Django OAuth endpoint -> Google -> Django callback -> platform session)
 * is implemented in a later Identity task; this button intentionally has no
 * OAuth wiring yet.
 */
export function GoogleAuthButton({
  label = 'Continue with Google',
  disabled,
}: GoogleAuthButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 shadow-sm motion-safe:transition-colors motion-safe:duration-150 hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-gray-300 disabled:hover:bg-white"
    >
      <GoogleIcon className="h-5 w-5" />
      <span>{label}</span>
    </button>
  )
}
