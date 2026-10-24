import type { ReactNode } from 'react'

import { formatPlannedDate, plannedDuration, type IdeaProposal } from '../api/proposalsApi'

/** One labelled fact on a proposal's cover; a null or empty value is left out. */
export type Fact = [label: string, value: ReactNode]

/** The planned start, end and the span between them, for a proposal's facts. */
export function plannedFacts(proposal: Pick<IdeaProposal, 'plannedStart' | 'plannedEnd'>): Fact[] {
  return [
    ['Planned start', formatPlannedDate(proposal.plannedStart) ?? 'To be confirmed'],
    ['Planned end', formatPlannedDate(proposal.plannedEnd) ?? 'To be confirmed'],
    ['Duration', plannedDuration(proposal.plannedStart, proposal.plannedEnd)],
  ]
}
