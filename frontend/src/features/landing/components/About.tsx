import { useReveal } from '../hooks/useReveal'
import { CheckBadgeIcon } from './icons'
import { SectionHeading } from './SectionHeading'

const POINTS = [
  'Turn real-world problems into structured digital opportunities.',
  'Make the need clear before any software development begins.',
  'Bring idea owners, reviewers and implementation teams into one conversation.',
  'Keep the journey from idea to implementation easy to follow.',
]

const AUDIENCES = ['Individuals', 'Businesses', 'Institutions', 'Students']

const ROLES = [
  { role: 'Idea owner', does: 'Describes the problem and the people it affects' },
  { role: 'Reviewers', does: 'Validate the need and decide what comes next' },
  { role: 'Implementation team', does: 'Plans the work and delivers it in stages' },
]

/** Who works together on an idea - a quiet glass panel beside the About copy. */
function CollaborationPanel() {
  const ref = useReveal<HTMLDivElement>()

  return (
    <div ref={ref} aria-hidden="true" className="relative">
      <div className="absolute -inset-6 rounded-[2rem] bg-[radial-gradient(circle_at_70%_30%,rgba(85,230,176,0.45),transparent_60%),radial-gradient(circle_at_20%_90%,rgba(11,143,101,0.25),transparent_55%)] blur-2xl" />
      <div className="relative rounded-3xl border border-white/80 bg-white/70 p-6 shadow-[0_24px_60px_-28px_rgba(8,75,56,0.45)] backdrop-blur-xl sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-jade">
          One idea, three roles
        </p>
        <ol className="relative mt-6 space-y-6">
          <span className="absolute bottom-5 left-[1.15rem] top-5 w-px bg-gradient-to-b from-jade/50 via-jade/30 to-mint/60" />
          {ROLES.map((item, index) => (
            <li key={item.role} className="relative flex items-start gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-jade/20 bg-white text-sm font-semibold text-jade shadow-sm">
                {index + 1}
              </span>
              <div className="rounded-xl border border-jade/10 bg-white/80 px-4 py-3">
                <p className="text-sm font-semibold text-ink">{item.role}</p>
                <p className="mt-0.5 text-sm text-sage">{item.does}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

export function About() {
  const listRef = useReveal<HTMLDivElement>()

  return (
    <section
      id="about"
      aria-labelledby="about-heading"
      className="scroll-mt-24 overflow-hidden bg-mist py-20 sm:py-28"
    >
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:gap-20 lg:px-8">
        <div>
          <SectionHeading
            id="about-heading"
            eyebrow="About MUSTANET"
            title="Clarity before code"
            description="Most software goes wrong long before the first line is written: the problem was never quite clear. MUSTANET exists to make it clear - who is affected, what goes wrong today, and what a good outcome looks like - and then to carry that clarity all the way through to delivery."
            align="start"
          />
          <div ref={listRef}>
            <ul className="mt-8 space-y-3.5">
              {POINTS.map((point) => (
                <li key={point} className="flex gap-3 text-[15px] leading-relaxed text-ink">
                  <CheckBadgeIcon className="mt-0.5 h-5 w-5 shrink-0 text-jade" />
                  {point}
                </li>
              ))}
            </ul>
            <p className="mt-8 text-sm font-semibold text-ink">Who it serves</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {AUDIENCES.map((audience) => (
                <li
                  key={audience}
                  className="rounded-full border border-jade/15 bg-white px-3.5 py-1.5 text-sm font-medium text-pine"
                >
                  {audience}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <CollaborationPanel />
      </div>
    </section>
  )
}
