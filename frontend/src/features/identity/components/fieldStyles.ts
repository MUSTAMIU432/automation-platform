/**
 * Shared Tailwind classes for the auth form controls, so every field looks
 * consistent. Deliberately excludes any width utility: Tailwind resolves
 * conflicting width classes by their order in the generated stylesheet, not
 * by the order they're concatenated here, so callers add their own width
 * (`w-full`, `flex-1`, a fixed size, ...) instead of relying on override order.
 */
interface InputClassOptions {
  /** A `<textarea>`: its height comes from `rows`, not a fixed `h-11`. */
  multiline?: boolean
  /** A roomier field with larger text, for the main fields of a long form. */
  large?: boolean
}

export function inputClasses(
  hasError = false,
  { multiline = false, large = false }: InputClassOptions = {},
): string {
  const height = multiline ? (large ? 'py-3' : 'py-2.5') : large ? 'h-12' : 'h-11'
  return [
    // border-gray-300 (rather than the barely-there gray-200) gives each
    // field a clearly visible outline against the white card, so the form
    // reads at a glance instead of needing a squint.
    `block ${height} rounded-lg border bg-white px-3.5 text-gray-900 shadow-sm`,
    large ? 'text-base' : 'text-sm',
    'placeholder:text-gray-400 motion-safe:transition-colors motion-safe:duration-150',
    'focus:outline-none focus:ring-2',
    hasError
      ? 'border-red-400 hover:border-red-400 focus:border-red-500 focus:ring-red-200'
      : 'border-gray-300 hover:border-gray-400 focus:border-brand-500 focus:ring-brand-200',
    'disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400',
  ].join(' ')
}

export const labelClasses = 'mb-1.5 block text-sm font-semibold text-gray-800'

export const fieldErrorClasses = 'mt-1.5 text-sm text-red-600'

/* Neumorphic light: a dark shade to the bottom right, a white glow to the top left. */
export const neuRaised =
  'shadow-[6px_6px_14px_rgba(122,156,141,0.55),-6px_-6px_14px_rgba(255,255,255,0.95)]'
export const neuPressed =
  'shadow-[inset_4px_4px_9px_rgba(122,156,141,0.5),inset_-4px_-4px_9px_rgba(255,255,255,0.95)]'

/**
 * The auth card's neumorphic field: a pill pressed into the card, the card's
 * own colour, with room on the left for an icon when `withIcon` and on the
 * right for a button when `withTrailing`. The pressed-in shading is a box
 * shadow that Tailwind's focus ring composes with, and `neu-field` keeps it
 * through Chrome's autofill (index.css). Width is the caller's, as for
 * `inputClasses`.
 */
export function softInputClasses(
  hasError = false,
  { withIcon = false, withTrailing = false }: { withIcon?: boolean; withTrailing?: boolean } = {},
): string {
  return [
    'neu-field block h-12 rounded-full border-0 bg-neu text-[15px] text-ink',
    neuPressed,
    withIcon ? 'pl-12' : 'pl-5',
    withTrailing ? 'pr-12' : 'pr-5',
    'placeholder:text-sage/80 focus:outline-none focus:ring-2',
    hasError ? 'ring-2 ring-red-300 focus:ring-red-400' : 'focus:ring-jade/40',
    'disabled:cursor-not-allowed disabled:text-sage',
  ].join(' ')
}

export const softLabelClasses = 'mb-1.5 ml-4 block text-sm font-semibold text-ink'

/**
 * The submit button of every auth form: a raised green pill with white text
 * (a dark enough green for AA contrast), pressed in while clicked. One
 * definition, so the five forms cannot drift.
 */
export const primaryButtonClasses = [
  'flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#077a56] text-base font-bold text-white',
  neuRaised,
  'hover:bg-[#066b4b] active:shadow-[inset_3px_3px_8px_rgba(0,0,0,0.3)] motion-safe:transition-[background-color,box-shadow]',
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2 focus-visible:ring-offset-neu',
  'disabled:cursor-not-allowed disabled:opacity-60',
].join(' ')
