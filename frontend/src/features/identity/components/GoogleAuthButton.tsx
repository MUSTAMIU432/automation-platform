import { neuRaised } from './fieldStyles'
import { GoogleIcon } from './icons'

interface GoogleAuthButtonProps {
  label?: string
  disabled?: boolean
  onClick?: () => void
  /** Where Google Identity Services renders its own button, laid over this one. */
  googleButtonContainerId?: string
}

/**
 * Custom-styled "Continue with Google" trigger. It has no OAuth logic of
 * its own. Google Identity Services renders its *real* button into
 * `googleButtonContainerId`, laid over this one and all but invisible, so the
 * reader's own click lands on Google's button.
 *
 * That is the only arrangement that works for everybody: for a reader already
 * signed in to Google, GIS draws its button inside a cross-origin iframe, and a
 * script cannot click into an iframe - so forwarding a click from this button
 * (`onClick`, wired to `useGoogleSignIn`'s `trigger()`) silently did nothing for
 * exactly those readers. `onClick` stays as the keyboard path and for the thin
 * edge Google's button does not cover.
 *
 * `disabled` covers both form submission in progress and Google sign-in not
 * being configured (`useGoogleSignIn`'s `isConfigured`); the overlay stops
 * taking clicks then too. Drawn as a raised pill on the auth card's
 * neumorphic surface, pressed in while clicked.
 */
export function GoogleAuthButton({
  label = 'Continue with Google',
  disabled,
  onClick,
  googleButtonContainerId,
}: GoogleAuthButtonProps) {
  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={`flex h-12 w-full items-center justify-center gap-3 rounded-full bg-neu px-5 text-sm font-semibold text-ink ${neuRaised} active:shadow-[inset_4px_4px_9px_rgba(122,156,141,0.5),inset_-4px_-4px_9px_rgba(255,255,255,0.95)] focus:outline-none focus-visible:ring-2 focus-visible:ring-jade/50 disabled:cursor-not-allowed disabled:opacity-60 motion-safe:transition-shadow`}
      >
        <GoogleIcon className="h-6 w-6" />
        <span>{label}</span>
      </button>
      {googleButtonContainerId && (
        <div
          className={`absolute inset-0 z-10 flex items-center justify-center overflow-hidden rounded-full opacity-[0.01] ${
            disabled ? 'pointer-events-none' : ''
          }`}
        >
          <div id={googleButtonContainerId} />
        </div>
      )}
    </div>
  )
}
