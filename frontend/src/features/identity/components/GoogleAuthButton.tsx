import { neuRaised } from './fieldStyles'
import { GoogleIcon } from './icons'

interface GoogleAuthButtonProps {
  label?: string
  disabled?: boolean
  onClick?: () => void
}

/**
 * Custom-styled "Continue with Google" trigger. It has no OAuth logic of
 * its own - a parent wires `onClick` to `useGoogleSignIn`'s `trigger()`
 * (see `SignInForm`/`SignUpForm`), which forwards the click to Google
 * Identity Services' own hidden button. `disabled` covers both form
 * submission in progress and Google sign-in not being configured
 * (`useGoogleSignIn`'s `isConfigured`). Drawn as a raised pill on the auth
 * card's neumorphic surface, pressed in while clicked.
 */
export function GoogleAuthButton({
  label = 'Continue with Google',
  disabled,
  onClick,
}: GoogleAuthButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex h-12 w-full items-center justify-center gap-3 rounded-full bg-neu px-5 text-sm font-semibold text-ink ${neuRaised} active:shadow-[inset_4px_4px_9px_rgba(122,156,141,0.5),inset_-4px_-4px_9px_rgba(255,255,255,0.95)] focus:outline-none focus-visible:ring-2 focus-visible:ring-jade/50 disabled:cursor-not-allowed disabled:opacity-60 motion-safe:transition-shadow`}
    >
      <GoogleIcon className="h-6 w-6" />
      <span>{label}</span>
    </button>
  )
}
