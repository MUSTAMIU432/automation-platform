import { Link } from 'react-router-dom'

import { ChartIcon, CodeIcon } from '../../../components/AppIcons'
import { CollapseButton } from '../../../components/CollapseButton'
import { useCollapsed } from '../../../components/useCollapsed'
import { useReturnHere } from '../../../lib/returnTo'

import { opportunityForIdeaRequest, traceabilityRequest } from '../api/automationApi'
import { useLoad } from '../utils/useLoad'
import { Badge } from './ui'
import type { Idea } from '../../ideas/api/ideasApi'

const panelClass =
  'rounded-3xl border border-white bg-white/90 p-5 shadow-[0_16px_40px_-30px_rgba(8,75,56,0.5)] sm:px-6'

const linkButtonClass =
  'inline-flex h-10 w-full whitespace-nowrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3.5 text-sm font-semibold text-ink hover:border-jade/40 hover:bg-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-jade/40'

/** The card's icon, heading and fold, the same on both of its states. */
function PanelHeading({
  open,
  onToggle,
  children,
}: {
  open: boolean
  onToggle: () => void
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-mist text-jade ring-1 ring-inset ring-jade/10"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
        >
          <path d="m8 7-5 5 5 5M16 7l5 5-5 5" />
        </svg>
      </span>
      <h2 id="idea-delivery" className="min-w-0 flex-1 truncate text-base font-bold text-ink">
        Automation delivery
      </h2>
      {children}
      <CollapseButton
        open={open}
        onToggle={onToggle}
        controls="idea-delivery-body"
        label="automation delivery"
      />
    </div>
  )
}

/**
 * Where an idea went after the owner's go-ahead: its automation opportunity, and its project once
 * there is one. Nothing is created here - the go-ahead opens the opportunity - so this is only the
 * way from the idea to its delivery, and for a ready idea whose opportunity is not visible to the
 * reader, a plain statement that it is with the delivery team.
 */
export function IdeaAutomationPanel({ idea }: { idea: Idea }) {
  const existing = useLoad(() => opportunityForIdeaRequest(idea.id), `idea-opp:${idea.id}`)
  const chain = useLoad(() => traceabilityRequest(idea.id), `idea-chain:${idea.id}`)
  const returnHere = useReturnHere()
  const [open, toggle] = useCollapsed('idea-detail:delivery', true)

  if (existing.loading) return null
  const opportunity = existing.data

  if (!opportunity) {
    if (idea.status !== 'READY_FOR_IMPLEMENTATION') return null
    return (
      <section aria-labelledby="idea-delivery" className={panelClass}>
        <PanelHeading open={open} onToggle={toggle} />
        {open && (
          <p id="idea-delivery-body" className="mt-3 text-sm leading-6 text-sage">
            You gave the go-ahead. The delivery team will assign a developer.
          </p>
        )}
      </section>
    )
  }

  // Both stages, in the order they happen: the opportunity (proposal, requirements,
  // assignment) and, once a developer has it, the project being built.
  const projectId = chain.data?.projectId ?? null
  const targets = [
    {
      to: `/app/automation/opportunities/${opportunity.id}`,
      label: 'View opportunity',
      Icon: ChartIcon,
    },
    ...(projectId
      ? [{ to: `/app/automation/projects/${projectId}`, label: 'View project', Icon: CodeIcon }]
      : []),
  ]
  return (
    <section aria-labelledby="idea-delivery" className={panelClass}>
      <PanelHeading open={open} onToggle={toggle} />
      {open && (
        <div id="idea-delivery-body">
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge value={opportunity.status} />
            <p className="text-sm text-sage">This idea is being turned into an automation.</p>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {targets.map((target) => (
              <Link
                key={target.to}
                className={linkButtonClass}
                to={target.to}
                state={returnHere('Back to the idea')}
              >
                <span className="flex items-center gap-2">
                  <target.Icon className="h-4 w-4 text-jade" />
                  {target.label}
                </span>
                <span aria-hidden="true" className="text-jade">
                  →
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
