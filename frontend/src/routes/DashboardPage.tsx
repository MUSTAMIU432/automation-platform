import type { ComponentType } from 'react'
import { Link } from 'react-router-dom'

import {
  ArrowRightIcon,
  BulbIcon,
  ChartIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ClockIcon,
  CodeIcon,
  DocumentIcon,
  ShareNodesIcon,
  UsersIcon,
} from '../components/AppIcons'
import { useAdminCapabilities } from '../features/administration/context/useAdminCapabilities'
import type { DashboardCounts } from '../features/dashboard/api/dashboardApi'
import {
  useDashboardCounts,
  type DashboardCountsState,
} from '../features/dashboard/useDashboardCounts'
import { useAuth } from '../features/identity/auth/AuthContext'
import { useOrganization } from '../features/organizations/context/useOrganization'
import { useCanReview } from '../features/reviews/hooks/useCanReview'

interface Tone {
  /** The icon tile's colours. */
  tile: string
  /** The call to action's colour. */
  action: string
  /** The decorative glass shape in the card's corner. */
  glass: string
}

const TONES: Record<'green' | 'amber' | 'blue' | 'violet', Tone> = {
  green: {
    tile: 'from-mint/40 to-mint/10 text-jade',
    action: 'text-jade',
    glass: 'from-mint/35 to-mint/5',
  },
  amber: {
    tile: 'from-amber-200/80 to-amber-50 text-amber-600',
    action: 'text-jade',
    glass: 'from-amber-200/60 to-amber-50/10',
  },
  blue: {
    tile: 'from-sky-200/80 to-sky-50 text-sky-600',
    action: 'text-jade',
    glass: 'from-sky-200/60 to-sky-50/10',
  },
  violet: {
    tile: 'from-violet-200/80 to-violet-50 text-violet-600',
    action: 'text-jade',
    glass: 'from-violet-200/60 to-violet-50/10',
  },
}

interface Shortcut {
  title: string
  description: string
  action: string
  to: string
  Icon: ComponentType<{ className?: string }>
  tone: Tone
  /** The card's figure: which count, and what one of it is called. */
  count: { key: keyof DashboardCounts; one: string; many: string }
}

/**
 * A card's figure. While it loads a quiet placeholder holds its place; if it
 * could not be fetched the card says so rather than showing a zero that might
 * not be true.
 */
function CardCount({ state, count }: { state: DashboardCountsState; count: Shortcut['count'] }) {
  if (state.status === 'loading') {
    return (
      <span
        className="block h-9 w-16 animate-pulse rounded-lg bg-mist"
        aria-label="Loading count"
      />
    )
  }
  if (state.status === 'failed') {
    return <span className="block text-sm text-sage">Count unavailable right now</span>
  }
  const value = state.counts[count.key]
  return (
    <span className="flex items-baseline gap-2">
      <span className="text-3xl font-bold tabular-nums text-ink">{value.toLocaleString()}</span>
      <span className="text-sm font-medium text-sage">{value === 1 ? count.one : count.many}</span>
    </span>
  )
}

/** One way into the platform: the whole card is the link. */
function ShortcutCard({
  title,
  description,
  action,
  to,
  Icon,
  tone,
  count,
  counts,
}: Shortcut & { counts: DashboardCountsState }) {
  return (
    <Link
      to={to}
      className="group relative flex min-h-[11rem] flex-col overflow-hidden rounded-3xl border border-white bg-white/80 p-6 shadow-[0_20px_50px_-30px_rgba(8,75,56,0.45)] backdrop-blur-xl transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_26px_60px_-28px_rgba(8,75,56,0.55)] focus:outline-none focus-visible:ring-2 focus-visible:ring-jade/50"
    >
      {/* A pane of tinted glass in the corner, echoing the icon. */}
      <span
        aria-hidden="true"
        className={`absolute -bottom-6 right-6 h-24 w-20 rotate-6 rounded-2xl border border-white/80 bg-gradient-to-br ${tone.glass} shadow-[0_10px_30px_-12px_rgba(8,75,56,0.35)]`}
      />
      <span
        aria-hidden="true"
        className={`absolute -bottom-2 right-14 h-20 w-16 -rotate-3 rounded-2xl border border-white/80 bg-gradient-to-br ${tone.glass} opacity-70`}
      />

      <span className="relative flex items-start gap-4">
        <span
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${tone.tile} shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_20px_-12px_rgba(8,75,56,0.5)]`}
        >
          <Icon className="h-7 w-7" />
        </span>
        <span className="min-w-0 flex-1 pr-8">
          <span className="block text-lg font-bold text-ink">{title}</span>
          <span className="mt-1 block text-sm leading-6 text-sage">{description}</span>
        </span>
        <span
          aria-hidden="true"
          className="absolute right-0 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-mist text-ink/70 transition-colors group-hover:bg-jade group-hover:text-white"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </span>
      </span>

      <span className="relative mt-4 block pl-[4.5rem]">
        <CardCount state={counts} count={count} />
      </span>

      <span
        className={`relative mt-auto inline-flex items-center gap-1.5 pt-4 text-base font-bold ${tone.action}`}
      >
        {action}
        <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  )
}

const STAGES: Array<{
  title: string
  text: string
  Icon: ComponentType<{ className?: string }>
  highlight?: boolean
}> = [
  { title: 'Discover', text: 'Describe a real-world problem', Icon: BulbIcon },
  { title: 'Validate', text: 'Clarify the need and refine the idea', Icon: DocumentIcon },
  { title: 'Review', text: 'Get feedback from experts and stakeholders', Icon: UsersIcon },
  { title: 'Build', text: 'Organize tasks and develop solutions', Icon: CodeIcon, highlight: true },
  { title: 'Measure', text: 'Track progress and understand impact', Icon: ChartIcon },
]

/** The journey every idea takes, from the problem to its measured result. */
function Pipeline() {
  return (
    <section
      aria-labelledby="pipeline-heading"
      className="relative mt-6 overflow-hidden rounded-3xl border border-white bg-gradient-to-br from-white/90 via-mist/70 to-white/80 p-6 shadow-[0_20px_50px_-30px_rgba(8,75,56,0.45)] sm:p-8"
    >
      <span
        aria-hidden="true"
        className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[radial-gradient(circle_at_32%_28%,rgba(255,255,255,0.95),rgba(85,230,176,0.55)_25%,rgba(11,143,101,0.45)_60%,rgba(6,47,37,0.4))] shadow-[0_0_30px_rgba(85,230,176,0.4)]"
      />
      <div className="relative flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-mint/40 to-mint/10 text-jade shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
          <ShareNodesIcon className="h-7 w-7" />
        </span>
        <div>
          <h2 id="pipeline-heading" className="text-xl font-bold text-ink">
            From idea to implementation
          </h2>
          <p className="mt-0.5 text-sm text-sage">
            Discover <span aria-hidden="true">→</span> Validate <span aria-hidden="true">→</span>{' '}
            Review <span aria-hidden="true">→</span> Build <span aria-hidden="true">→</span> Measure
          </p>
        </div>
      </div>

      <ol className="relative mt-8 grid gap-6 sm:grid-cols-5 sm:gap-2">
        {/* The line joining the stages, through the middle of their markers. */}
        <span
          aria-hidden="true"
          className="absolute left-[10%] right-[10%] top-6 hidden h-0.5 bg-gradient-to-r from-jade via-jade to-mint sm:block"
        />
        {STAGES.map(({ title, text, Icon, highlight }) => (
          <li key={title} className="relative flex items-center gap-4 sm:flex-col sm:text-center">
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white ring-4 ring-white ${
                highlight
                  ? 'bg-gradient-to-br from-sky-500 to-blue-600 shadow-[0_0_20px_rgba(59,130,246,0.5)]'
                  : 'bg-gradient-to-br from-jade to-pine shadow-[0_0_20px_rgba(11,143,101,0.45)]'
              }`}
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className="sm:mt-1">
              <span className="block text-sm font-bold text-ink">{title}</span>
              <span className="mt-0.5 block text-xs leading-5 text-sage sm:mx-auto sm:max-w-[10rem]">
                {text}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** Glass shapes floating beside the page title: a ring, two panes and a bead of light. Decorative. */
function HeroGlass() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute right-0 top-0 hidden h-full w-[26rem] lg:block"
    >
      <span className="absolute right-40 top-4 h-36 w-36 rounded-full border-[18px] border-mint/60 shadow-[0_0_40px_rgba(85,230,176,0.55),inset_0_0_18px_rgba(255,255,255,0.7)] motion-safe:animate-[float_9s_ease-in-out_infinite]" />
      <span className="absolute right-[19rem] top-16 h-16 w-24 -rotate-12 rounded-2xl border border-white bg-gradient-to-br from-white/80 to-mint/30 shadow-[0_20px_30px_-12px_rgba(8,75,56,0.35)] motion-safe:animate-[float_11s_ease-in-out_infinite]" />
      <span className="absolute right-8 top-10 h-24 w-24 rotate-12 rounded-3xl border border-white bg-gradient-to-br from-mint/50 via-white/60 to-mint/20 shadow-[0_20px_40px_-14px_rgba(8,75,56,0.4)] motion-safe:animate-[float_8s_ease-in-out_infinite]" />
      <span className="absolute right-28 top-40 h-3 w-3 rounded-full bg-white shadow-[0_0_18px_6px_rgba(85,230,176,0.7)]" />
    </div>
  )
}

/** The landing page of every signed-in user: the ways into the platform, and the path an idea takes. */
export function DashboardPage() {
  const { user } = useAuth()
  const { activeOrganization } = useOrganization()
  const canReview = useCanReview(activeOrganization?.id ?? null)
  const platformReviewer = useAdminCapabilities().capabilities.canReviewPlatformSubmissions
  // Somebody with a queue sees what waits for them; everybody else, their own ideas
  // waiting on a reviewer - and that card leads to their ideas, not to a queue.
  const reviews = canReview === true || platformReviewer
  const counts = useDashboardCounts(activeOrganization?.id ?? null)

  const where = activeOrganization?.name ?? 'your workspace'

  const shortcuts: Shortcut[] = [
    {
      title: 'Existing ideas',
      description: `Browse and explore ideas submitted by individuals and organizations, or put a problem forward in ${where}.`,
      action: 'Explore',
      to: '/app/ideas',
      Icon: BulbIcon,
      tone: TONES.green,
      count: { key: 'ideas', one: 'idea you can read', many: 'ideas you can read' },
    },
    reviews
      ? {
          title: 'Pending review',
          description: 'View ideas that are waiting for review from experts and stakeholders.',
          action: 'Review',
          to: '/app/reviews',
          Icon: ClockIcon,
          tone: TONES.amber,
          count: { key: 'reviewQueue', one: 'waiting for you', many: 'waiting for you' },
        }
      : {
          title: 'Pending review',
          description:
            canReview === false
              ? `Your ideas with a reviewer. You are not a reviewer in ${where} yet.`
              : 'Your ideas waiting for review by experts and stakeholders.',
          action: 'Follow',
          to: '/app/ideas',
          Icon: ClockIcon,
          tone: TONES.amber,
          count: {
            key: 'myIdeasInReview',
            one: 'of your ideas in review',
            many: 'of your ideas in review',
          },
        },
    {
      title: 'Approved ideas',
      description: 'Explore approved ideas ready for development and implementation.',
      action: 'Build',
      to: '/app/automation/opportunities',
      Icon: CheckCircleIcon,
      tone: TONES.blue,
      count: { key: 'opportunities', one: 'approved idea', many: 'approved ideas' },
    },
    {
      title: 'Implementation',
      description: 'Follow implementation, track progress and deliver solutions.',
      action: 'Develop',
      to: '/app/automation/projects',
      Icon: CodeIcon,
      tone: TONES.violet,
      count: { key: 'projects', one: 'project underway', many: 'projects underway' },
    },
  ]

  return (
    <>
      <div className="relative">
        <HeroGlass />
        <div className="relative max-w-2xl pb-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-jade">
            Welcome back{user?.firstName ? `, ${user.firstName}` : ''}
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            Ideas &amp;{' '}
            <span className="bg-gradient-to-r from-jade to-[#2fbf8a] bg-clip-text text-transparent">
              opportunities
            </span>
          </h1>
          <p className="mt-3 text-base leading-7 text-sage sm:text-lg">
            Discover problems, review opportunities, and help build solutions.
          </p>
        </div>
      </div>

      <section aria-labelledby="shortcuts-heading" className="relative mt-8">
        <h2 id="shortcuts-heading" className="sr-only">
          Work in {where}
        </h2>
        <div className="grid gap-5 md:grid-cols-2">
          {shortcuts.map((shortcut) => (
            <ShortcutCard key={shortcut.title} {...shortcut} counts={counts} />
          ))}
        </div>
      </section>

      <Pipeline />
    </>
  )
}
