import { ChevronDownIcon } from './AppIcons'

/**
 * The chevron that opens and closes a section. `aria-expanded` and
 * `aria-controls` say what it does; `label` names the section, so the button
 * reads "Hide Discussion" rather than a bare arrow. `withText` shows the word
 * beside the chevron, for a section a reader is likely to want out of the way.
 */
export function CollapseButton({
  open,
  onToggle,
  controls,
  label,
  withText = false,
}: {
  open: boolean
  onToggle: () => void
  controls: string
  label: string
  withText?: boolean
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={controls}
      aria-label={`${open ? 'Hide' : 'Show'} ${label}`}
      onClick={onToggle}
      className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-jade hover:bg-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-jade/40"
    >
      {withText && <span aria-hidden="true">{open ? 'Hide' : 'Show'}</span>}
      <ChevronDownIcon
        className={`h-4 w-4 text-ink/60 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
      />
    </button>
  )
}
