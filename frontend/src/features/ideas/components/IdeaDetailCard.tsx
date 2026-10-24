import type { ComponentType, ReactNode } from 'react'

import { CollapseButton } from '../../../components/CollapseButton'
import { useCollapsed } from '../../../components/useCollapsed'

/**
 * One card on an idea's page: an icon, a heading with an optional count,
 * optional things on the heading's right, and content that the reader can
 * hide. `headingId` names the section for assistive technology and keys the
 * remembered open/closed choice, so a hidden card stays hidden on the next idea.
 */
export function IdeaDetailCard({
  headingId,
  title,
  Icon,
  count,
  aside,
  tone = 'plain',
  defaultOpen = true,
  toggleText = false,
  className = '',
  children,
}: {
  headingId: string
  title: string
  Icon: ComponentType<{ className?: string }>
  /** Shown after the title, e.g. "(2)"; nothing while unknown. */
  count?: number | null
  aside?: ReactNode
  /** `accent` is the mint-washed card used for the idea's state. */
  tone?: 'plain' | 'accent'
  defaultOpen?: boolean
  /** Show "Hide"/"Show" beside the chevron. */
  toggleText?: boolean
  className?: string
  children: ReactNode
}) {
  const [open, toggle] = useCollapsed(`idea-detail:${headingId}`, defaultOpen)
  const bodyId = `${headingId}-body`

  return (
    <section
      aria-labelledby={headingId}
      className={`scroll-mt-24 rounded-3xl border p-5 shadow-[0_16px_40px_-30px_rgba(8,75,56,0.5)] sm:px-6 ${
        tone === 'accent'
          ? 'border-jade/15 bg-gradient-to-br from-mint/25 via-white to-white'
          : 'border-white bg-white/90'
      } ${className}`}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-mist text-jade ring-1 ring-inset ring-jade/10"
        >
          <Icon className="h-5 w-5" />
        </span>
        <h2 id={headingId} className="min-w-0 flex-1 text-base font-bold text-ink">
          {title}
          {count !== undefined && count !== null && (
            <>
              {' '}
              <span className="font-semibold text-sage">({count})</span>
            </>
          )}
        </h2>
        {aside}
        <CollapseButton
          open={open}
          onToggle={toggle}
          controls={bodyId}
          label={title}
          withText={toggleText}
        />
      </div>
      {open && (
        <div id={bodyId} className="mt-4">
          {children}
        </div>
      )}
    </section>
  )
}
