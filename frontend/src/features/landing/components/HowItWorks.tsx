import type { CSSProperties } from 'react'

import { useReveal } from '../hooks/useReveal'
import { SectionHeading } from './SectionHeading'

/* The real path an idea takes - docs/automation-lifecycle.md has the detail. */
const STAGES = [
  {
    title: 'Discover',
    summary: 'Describe a real-world problem.',
    detail:
      'Submit an idea with the story behind it: who is affected, what goes wrong today and what it costs. It can belong to you, a team or an organization.',
  },
  {
    title: 'Validate',
    summary: 'Clarify the need and refine the idea.',
    detail:
      'A review team assesses the idea, asks the owner questions and returns its decision. Approved ideas get a written proposal for the owner to read.',
  },
  {
    title: 'Build',
    summary: 'Organize requirements and implementation tasks.',
    detail:
      "After the owner's go-ahead, a developer is assigned and writes an implementation plan in stages, approved before the work starts.",
  },
  {
    title: 'Measure',
    summary: 'Review progress and understand outcomes.',
    detail:
      'Each stage is reported and approved, and every decision stays in the project history, so everyone can see where the solution stands.',
  },
]

function Stage({ stage, index }: { stage: (typeof STAGES)[number]; index: number }) {
  const ref = useReveal<HTMLLIElement>()

  return (
    <li
      ref={ref}
      style={{ '--reveal-delay': `${index * 140}ms` } as CSSProperties}
      className="relative pl-16 lg:pl-0"
    >
      <span className="absolute left-0 top-0 flex h-11 w-11 items-center justify-center rounded-full border border-mint/40 bg-forest text-sm font-bold text-mint shadow-[0_0_24px_-4px_rgba(85,230,176,0.6)] lg:relative">
        {String(index + 1).padStart(2, '0')}
      </span>
      <div className="rounded-2xl border border-white/15 bg-white/[0.07] p-5 backdrop-blur-md lg:mt-6">
        <h3 className="text-lg font-semibold text-white">{stage.title}</h3>
        <p className="mt-1 text-sm font-medium text-mint">{stage.summary}</p>
        <p className="mt-3 text-[15px] leading-relaxed text-white/75">{stage.detail}</p>
      </div>
    </li>
  )
}

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-heading"
      className="relative scroll-mt-24 overflow-hidden bg-forest py-20 sm:py-28"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(11,143,101,0.35),transparent_60%)]"
      />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id="how-heading"
          eyebrow="How it works"
          title="Four stages from a problem to a working solution"
          description="Every idea follows the same visible path, so its owner always knows what has happened and what comes next."
          tone="dark"
        />
        <div className="relative mt-14">
          {/* The connecting line: down the markers on small screens, from the first marker's
              centre to the last one's on large ones (four columns, gap-6). */}
          <span
            aria-hidden="true"
            className="absolute bottom-6 left-[1.375rem] top-6 w-px bg-gradient-to-b from-mint/50 to-mint/10 lg:bottom-auto lg:right-[calc(25%-2.5rem)] lg:top-[1.375rem] lg:h-px lg:w-auto lg:bg-gradient-to-r"
          />
          <ol className="relative grid gap-8 lg:grid-cols-4 lg:gap-6">
            {STAGES.map((stage, index) => (
              <Stage key={stage.title} stage={stage} index={index} />
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
