/*
  The delivery journey in three steps a reader can hold in their head:
  an approved idea becomes an opportunity, then a project, then a delivered
  solution. Shown as a guide at the top of Automation, and as a small tracker
  on every opportunity and project, so "where is it?" has one answer.
*/

import { deliveryStep } from '../utils/deliverySteps'

const STEPS = ['Opportunity', 'Project', 'Delivered'] as const

/** The small three-step tracker on a card. */
export function DeliveryTracker({ status }: { status: string }) {
  const step = deliveryStep(status)
  if (step < 0) {
    return <p className="text-xs font-medium text-sage">Cancelled - delivery stopped.</p>
  }
  return (
    <ol className="flex flex-wrap items-center gap-1.5 sm:gap-2" aria-label="Delivery progress">
      {STEPS.map((name, index) => {
        const done = index < step
        const current = index === step
        return (
          <li key={name} className="flex items-center gap-1.5 sm:gap-2">
            {index > 0 && (
              <span
                aria-hidden="true"
                className={`h-px w-3 sm:w-10 ${index <= step ? 'bg-jade' : 'bg-jade/20'}`}
              />
            )}
            <span
              className={`inline-flex items-center gap-1.5 text-xs ${
                current ? 'font-bold text-jade' : done ? 'font-semibold text-ink' : 'text-sage'
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-2 w-2 rounded-full ${
                  done || current ? 'bg-jade' : 'border border-jade/30 bg-white'
                } ${current ? 'ring-4 ring-mint/40' : ''}`}
              />
              {name}
              <span className="sr-only">
                {current ? ' (now)' : done ? ' (done)' : ' (to come)'}
              </span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

const GUIDE = [
  { name: 'Opportunity', text: 'Your approved idea, prepared for a developer.' },
  { name: 'Project', text: 'A developer builds it, stage by stage, each one approved.' },
  { name: 'Delivered', text: 'Tested, deployed and its impact measured.' },
]

/** "How delivery works", across the top of the Automation area. */
export function DeliveryGuide() {
  return (
    <section
      aria-label="How delivery works"
      className="rounded-3xl border border-jade/15 bg-gradient-to-br from-mint/25 via-white to-white p-4 sm:p-5"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-jade">
        How delivery works
      </p>
      <ol className="mt-3 grid gap-3 sm:grid-cols-3 sm:gap-4">
        {GUIDE.map((step, index) => (
          <li key={step.name} className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-jade text-xs font-bold text-white">
              {index + 1}
            </span>
            <span>
              <span className="block text-sm font-bold text-ink">{step.name}</span>
              <span className="block text-xs leading-5 text-sage">{step.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
