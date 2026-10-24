/**
 * The proposal an approved idea gets: written by the review team, released by an admin, read by
 * the owner. Refusals are payloads (`success: false` and the field they name); only a transport
 * failure rejects. Who may see or do what is the server's decision - the booleans in
 * `ProposalState` only decide what is drawn.
 */

import { graphqlClient } from '../../../graphql/client'
import { getAccessToken } from '../../../graphql/tokenStore'
import { env } from '../../../lib/env'

export interface IdeaProposal {
  ideaId: string
  ideaTitle: string
  teamName: string | null
  title: string
  executiveSummary: string
  problem: string
  proposedSolution: string
  requirementsSummary: string
  scope: string
  deliverables: string
  risks: string
  assumptions: string
  estimatedEffort: string
  estimatedTimeline: string
  acceptanceCriteria: string
  feasibility: string
  milestones: string
  financialRequirements: string
  /** `yes` (the owner pays), `no` (no charge), or `''` (not answered yet). */
  paymentRequired: '' | 'yes' | 'no'
  paymentPlan: string
  /** When the work is planned to begin and end, as ISO dates (`2026-11-02`), or null. */
  plannedStart: string | null
  plannedEnd: string | null
  status: string
  reviewFeedback: string
  /** When the team started writing it. */
  startedAt: string
  submittedAt: string | null
  decidedAt: string | null
  updatedAt: string
}

/** Someone on the writing team, or who wrote part of it, and what they have done. */
export interface ProposalParticipant {
  name: string
  email: string
  /** `former`: wrote part of it, no longer on the team. */
  role: 'lead' | 'member' | 'former'
  contributions: number
  /** The sections they changed. */
  sections: SectionKey[]
  lastContributedAt: string | null
}

export interface ProposalActivity {
  name: string
  action: 'started' | 'edited' | 'submitted'
  sections: SectionKey[]
  at: string
}

/** How far one approved idea's proposal has got, and who is writing it. */
export interface ProposalProgress {
  ideaId: string
  ideaTitle: string
  /** A proposal status, or `not_started`. */
  status: string
  teamName: string | null
  participants: ProposalParticipant[]
  filledSections: SectionKey[]
  totalSections: number
  missingRequired: SectionKey[]
  activity: ProposalActivity[]
  proposal: IdeaProposal | null
}

export type ViewerRole = 'writer' | 'admin' | 'owner' | null

export interface ProposalState {
  viewerRole: ViewerRole
  canStart: boolean
  /** Approved, but the platform admin has not confirmed it yet - the proposal waits for them. */
  waitingForAdmin: boolean
  canEdit: boolean
  canSubmit: boolean
  canDecide: boolean
  proposal: IdeaProposal | null
}

export interface ProposalOutcome {
  success: boolean
  message: string
  field: string | null
  proposal: IdeaProposal | null
}

export interface ViewReceipt {
  viewerName: string
  viewerEmail: string
  viewedAt: string
}

/**
 * The sections a proposal is made of, in reading order. `short` ones are single-line, `choice` is
 * the yes/no of whether the owner pays, and `required` ones must be written before the lead can
 * send it - the server's rule (`reviews.proposals._REQUIRED`), mirrored for the form. The payment
 * plan is required only when the owner pays.
 */
export const PROPOSAL_SECTIONS = [
  {
    key: 'title',
    label: 'Title',
    short: true,
    hint: 'A short name for the work, as the owner will see it.',
  },
  {
    key: 'executiveSummary',
    label: 'Executive summary',
    required: true,
    hint: 'The whole proposal in a few sentences: what will be built, why, and what it takes.',
  },
  {
    key: 'problem',
    label: 'Problem',
    required: true,
    hint: 'What goes wrong today, who it affects and what it costs them.',
  },
  {
    key: 'feasibility',
    label: 'Feasibility',
    required: true,
    hint: 'Whether this can be built, and what it depends on.',
  },
  {
    key: 'proposedSolution',
    label: 'Proposed solution',
    required: true,
    hint: 'What will be built and how it solves the problem.',
  },
  {
    key: 'requirementsSummary',
    label: 'Requirements',
    required: true,
    hint: 'What the solution needs: systems, data, access and people.',
  },
  {
    key: 'scope',
    label: 'Scope',
    required: true,
    hint: 'What is included, and just as clearly, what is not.',
  },
  {
    key: 'deliverables',
    label: 'Deliverables',
    required: true,
    hint: 'What the owner receives at the end.',
  },
  {
    key: 'estimatedTimeline',
    label: 'Overall timeline',
    required: true,
    hint: 'How long the work takes from start to finish, e.g. 8 weeks, and why.',
  },
  {
    key: 'milestones',
    label: 'Timeline and milestones',
    required: true,
    hint: 'The stages of the work and when each is reached.',
  },
  {
    key: 'estimatedEffort',
    label: 'Estimated effort',
    hint: 'The effort involved, e.g. 2 developers for 6 weeks, and what it is spent on.',
  },
  {
    key: 'financialRequirements',
    label: 'Financial requirements',
    required: true,
    hint: 'What the work costs, and what that money pays for.',
  },
  {
    key: 'paymentRequired',
    label: 'Does the owner pay?',
    choice: true,
    required: true,
    hint: 'Whether the owner is charged for this work.',
  },
  {
    key: 'paymentPlan',
    label: 'Payment plan',
    hint: 'How much the owner pays and when, e.g. by milestone.',
  },
  {
    key: 'risks',
    label: 'Risks',
    hint: 'What could go wrong, and how each risk will be handled.',
  },
  {
    key: 'assumptions',
    label: 'Assumptions',
    hint: 'What this proposal takes for granted.',
  },
  {
    key: 'acceptanceCriteria',
    label: 'Acceptance criteria',
    required: true,
    hint: 'How everyone will know the work is done and working.',
  },
] as const

/** Words for the answer to "Does the owner pay?". */
export const PAYMENT_WORDS = {
  yes: 'Yes - the owner pays',
  no: 'No - no charge to the owner',
} as const

/** Whether `key` is part of this proposal: the payment plan only when the owner pays. */
export function sectionApplies(key: string, paymentRequired: string): boolean {
  return key !== 'paymentPlan' || paymentRequired === 'yes'
}

export type SectionKey = (typeof PROPOSAL_SECTIONS)[number]['key']

const FIELDS = `ideaId ideaTitle teamName title executiveSummary problem proposedSolution
  requirementsSummary scope deliverables risks assumptions estimatedEffort estimatedTimeline
  acceptanceCriteria feasibility milestones financialRequirements paymentRequired paymentPlan
  plannedStart plannedEnd status reviewFeedback startedAt submittedAt decidedAt updatedAt`

export async function proposalStateRequest(ideaId: string): Promise<ProposalState> {
  const data = await graphqlClient.request<{ ideaProposalState: ProposalState }>(
    `query($ideaId: ID!) {
       ideaProposalState(ideaId: $ideaId) {
         viewerRole canStart waitingForAdmin canEdit canSubmit canDecide proposal { ${FIELDS} }
       }
     }`,
    { ideaId },
  )
  return data.ideaProposalState
}

export async function proposalsForReleaseRequest(): Promise<IdeaProposal[]> {
  const data = await graphqlClient.request<{ proposalsForRelease: IdeaProposal[] }>(
    `query { proposalsForRelease { ${FIELDS} } }`,
  )
  return data.proposalsForRelease
}

/** Admin: every approved idea's proposal as far as it has got, with who is writing it. */
export async function proposalProgressRequest(): Promise<ProposalProgress[]> {
  const data = await graphqlClient.request<{ proposalProgress: ProposalProgress[] }>(
    `query {
       proposalProgress {
         ideaId ideaTitle status teamName filledSections totalSections missingRequired
         participants { name email role contributions sections lastContributedAt }
         activity { name action sections at }
         proposal { ${FIELDS} }
       }
     }`,
  )
  return data.proposalProgress
}

/** The label of a section, by its key. */
export function sectionLabel(key: string): string {
  return (
    PROPOSAL_SECTIONS.find((section) => section.key === key)?.label ??
    PLANNED_DATES.find((field) => field.key === key)?.label ??
    key
  )
}

/** The planned dates on the proposal's cover: set with the sections, but not sections. */
export const PLANNED_DATES = [
  { key: 'plannedStart', label: 'Planned start' },
  { key: 'plannedEnd', label: 'Planned end' },
] as const

export type DateKey = (typeof PLANNED_DATES)[number]['key']

/** What the editor sends: any sections, and the planned dates ('' clears one). */
export type ProposalValues = Partial<Record<SectionKey | DateKey, string>>

/** An ISO date (`2026-11-02`) as words, read as a calendar day rather than a moment. */
export function formatPlannedDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** How long the planned dates span, inclusive: "12 weeks 4 days", or null without both. */
export function plannedDuration(
  start: string | null | undefined,
  end: string | null | undefined,
): string | null {
  if (!start || !end) return null
  const days = Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1
  if (!Number.isFinite(days) || days < 1) return null
  const weeks = Math.floor(days / 7)
  const rest = days % 7
  const part = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
  if (weeks === 0) return part(days, 'day')
  return rest ? `${part(weeks, 'week')} ${part(rest, 'day')}` : part(weeks, 'week')
}

function outcome(root: string, decl: string, args: string) {
  const document = `mutation(${decl}) { ${root}(${args}) { success message field proposal { ${FIELDS} } } }`
  return async (variables: Record<string, unknown>): Promise<ProposalOutcome> => {
    const data = await graphqlClient.request<Record<string, ProposalOutcome>>(document, variables)
    return data[root]
  }
}

export const startProposalRequest = outcome('startIdeaProposal', '$ideaId: ID!', 'ideaId: $ideaId')
export const submitProposalRequest = outcome(
  'submitIdeaProposal',
  '$ideaId: ID!',
  'ideaId: $ideaId',
)
export const releaseProposalRequest = outcome(
  'releaseIdeaProposal',
  '$ideaId: ID!',
  'ideaId: $ideaId',
)
export const requestProposalChangesRequest = outcome(
  'requestIdeaProposalChanges',
  '$ideaId: ID!, $feedback: String!',
  'ideaId: $ideaId, feedback: $feedback',
)
export const declineProposalRequest = outcome(
  'declineIdeaProposal',
  '$ideaId: ID!, $reason: String!',
  'ideaId: $ideaId, reason: $reason',
)

/** How long a download's blob URL is kept; the same 40 s the attachment downloads use. */
const BLOB_URL_LIFETIME_MS = 40_000

/**
 * Admin: download the proposal as a PDF stamped with the admin's name, email and the time.
 * The server builds it, checks the release permission and records the download. A plain link
 * cannot carry the bearer token, so it is fetched and handed to the browser as a blob.
 */
export async function downloadProposalPdfRequest(ideaId: string): Promise<void> {
  const token = getAccessToken()
  const response = await fetch(`${env.apiBaseUrl}/administration/proposals/${ideaId}/pdf/`, {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok) throw new Error('Could not download this proposal.')

  const disposition = response.headers.get('Content-Disposition') ?? ''
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `proposal-${ideaId}.pdf`
  const url = URL.createObjectURL(await response.blob())
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), BLOB_URL_LIFETIME_MS)
  }
}

export interface ProposalDraft {
  success: boolean
  message: string
  field: string | null
  text: string | null
}

/**
 * An AI first draft of one section, from the idea and the editor's current (unsaved) text.
 * Nothing is saved: the draft goes into the editor for the writer to change and save.
 */
export async function draftProposalSectionRequest(
  ideaId: string,
  section: SectionKey,
  values: ProposalValues,
  instructions = '',
): Promise<ProposalDraft> {
  const data = await graphqlClient.request<{ draftIdeaProposalSection: ProposalDraft }>(
    `mutation($input: UpdateIdeaProposalInput!, $section: String!, $instructions: String) {
       draftIdeaProposalSection(input: $input, section: $section, instructions: $instructions) {
         success message field text
       }
     }`,
    { input: { ideaId, ...values }, section, instructions },
  )
  return data.draftIdeaProposalSection
}

export function updateProposalRequest(
  ideaId: string,
  values: ProposalValues,
): Promise<ProposalOutcome> {
  return outcome(
    'updateIdeaProposal',
    '$input: UpdateIdeaProposalInput!',
    'input: $input',
  )({ input: { ideaId, ...values } })
}

/** Announces that the owner opened the released proposal; the answer feeds the watermark. */
export async function recordProposalViewRequest(
  ideaId: string,
): Promise<{ success: boolean; message: string; receipt: ViewReceipt | null }> {
  const data = await graphqlClient.request<{
    recordProposalView: { success: boolean; message: string; receipt: ViewReceipt | null }
  }>(
    `mutation($ideaId: ID!) {
       recordProposalView(ideaId: $ideaId) {
         success message receipt { viewerName viewerEmail viewedAt }
       }
     }`,
    { ideaId },
  )
  return data.recordProposalView
}

export function statusWords(status: string): string {
  return (
    {
      not_started: 'Not started',
      draft: 'Being written',
      submitted: 'With the platform admin',
      changes_requested: 'Sent back for changes',
      released: 'Released to the owner',
      declined: 'Declined',
    }[status] ?? status
  )
}

// --- the owner's answers to the released proposal ------------------------------------

export type Agreement = 'yes' | 'discuss'

/** What the owner answered: go ahead (on these terms) or not. */
export interface ProposalAnswer {
  decision: 'proceed' | 'decline'
  timeline: Agreement | ''
  payment: Agreement | ''
  preferredStart: string | null
  conditions: string
  declineReason: string
  answeredByName: string
  answeredAt: string
}

export interface ProposalAnswerInput {
  ideaId: string
  decision: 'proceed' | 'decline'
  timeline?: Agreement | ''
  payment?: Agreement | ''
  preferredStart?: string | null
  conditions?: string
  declineReason?: string
}

const ANSWER_FIELDS =
  'decision timeline payment preferredStart conditions declineReason answeredByName answeredAt'

/** The owner's answers, for those who act on them; null before the owner has answered. */
export async function proposalAnswerRequest(ideaId: string): Promise<ProposalAnswer | null> {
  const data = await graphqlClient.request<{ proposalAnswer: ProposalAnswer | null }>(
    `query($ideaId: ID!) { proposalAnswer(ideaId: $ideaId) { ${ANSWER_FIELDS} } }`,
    { ideaId },
  )
  return data.proposalAnswer
}

/** Answer the released proposal. Going ahead is also the go-ahead itself. */
export async function answerProposalRequest(
  input: ProposalAnswerInput,
): Promise<{ success: boolean; message: string; field: string | null }> {
  const data = await graphqlClient.request<{
    answerProposal: { success: boolean; message: string; field: string | null }
  }>(
    `mutation($input: ProposalAnswerInput!) {
       answerProposal(input: $input) { success message field }
     }`,
    { input: { ...input, preferredStart: input.preferredStart || null } },
  )
  return data.answerProposal
}

export const AGREEMENT_WORDS: Record<Agreement, string> = {
  yes: 'Agreed',
  discuss: 'Needs discussion',
}
