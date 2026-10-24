import type { AuthMode } from '../types/auth'
import { neuPressed, neuRaised } from './fieldStyles'

interface AuthTabsProps {
  mode: AuthMode
  onChange: (mode: AuthMode) => void
}

const TABS: Array<{ mode: AuthMode; label: string }> = [
  { mode: 'sign-in', label: 'Sign In' },
  { mode: 'sign-up', label: 'Sign Up' },
]

/**
 * Tab switch between the sign in and sign up forms, at the top of the auth
 * card: a track pressed into the neumorphic surface, with the active view
 * raised out of it. Arrow keys move between the two, as in any tab list.
 */
export function AuthTabs({ mode, onChange }: AuthTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Authentication mode"
      className={`mx-auto flex max-w-xs gap-1 rounded-full bg-neu p-1.5 ${neuPressed}`}
    >
      {TABS.map((tab) => {
        const isActive = tab.mode === mode
        return (
          <button
            key={tab.mode}
            type="button"
            role="tab"
            id={`auth-tab-${tab.mode}`}
            aria-selected={isActive}
            aria-controls={`auth-panel-${tab.mode}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.mode)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault()
                onChange(tab.mode === 'sign-in' ? 'sign-up' : 'sign-in')
              }
            }}
            className={[
              'flex h-10 flex-1 items-center justify-center rounded-full text-sm font-semibold motion-safe:transition-[color,box-shadow] motion-safe:duration-200',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-jade/50',
              isActive ? `bg-neu text-jade ${neuRaised}` : 'text-sage hover:text-ink',
            ].join(' ')}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
