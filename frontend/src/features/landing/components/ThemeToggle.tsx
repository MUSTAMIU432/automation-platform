import type { LandingTheme } from '../hooks/useLandingTheme'

/**
 * The switch between the website's green and White looks: a glass pill with
 * a glowing knob. The knob is `bg-mint`, which is green in the green theme and
 * blue in White, so the switch itself shows which look is on.
 */
export function ThemeToggle({
  theme,
  onChange,
}: {
  theme: LandingTheme
  onChange: (theme: LandingTheme) => void
}) {
  const white = theme === 'white'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={white}
      aria-label="White theme"
      title={white ? 'Switch to the green look' : 'Switch to the White look'}
      onClick={() => onChange(white ? 'green' : 'white')}
      className="relative inline-flex h-9 w-[4.25rem] shrink-0 items-center rounded-full border border-white/25 bg-white/10 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_8px_20px_-10px_rgba(0,0,0,0.8)] backdrop-blur-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-2 focus-visible:ring-offset-forest"
    >
      <span aria-hidden="true" className="flex w-full justify-between px-1.5 text-[11px]">
        <span className={white ? 'opacity-70' : 'opacity-0'}>🌿</span>
        <span className={white ? 'opacity-0' : 'opacity-70'}>☀️</span>
      </span>
      <span
        aria-hidden="true"
        className={`absolute top-1 left-1 h-7 w-7 rounded-full bg-mint shadow-[inset_0_2px_3px_rgba(255,255,255,0.6),inset_0_-3px_5px_rgba(0,0,0,0.25),0_0_16px_rgb(var(--lp-mint)/0.8)] motion-safe:transition-transform motion-safe:duration-300 ${
          white ? 'translate-x-8' : 'translate-x-0'
        }`}
      />
    </button>
  )
}
