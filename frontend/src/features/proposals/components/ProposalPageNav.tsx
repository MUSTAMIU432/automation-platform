import { Link } from 'react-router-dom'

import { ArrowRightIcon } from '../../../components/AppIcons'
import { useReturnHere } from '../../../lib/returnTo'
import { opportunityForIdeaRequest, traceabilityRequest } from '../../automation/api/automationApi'
import { useLoad } from '../../automation/utils/useLoad'

/**
 * The foot of the proposal: back to the idea, and on to the next step of the
 * pipeline - the automation delivery - once there is one. The next step goes to
 * the furthest stage that exists (the project, else the opportunity), the same
 * place the idea's own delivery card leads, and comes back here.
 */
export function ProposalPageNav({ ideaId }: { ideaId: string }) {
  const opportunity = useLoad(() => opportunityForIdeaRequest(ideaId), `prop-opp:${ideaId}`)
  const chain = useLoad(() => traceabilityRequest(ideaId), `prop-chain:${ideaId}`)
  const returnHere = useReturnHere()

  const projectId = chain.data?.projectId ?? null
  const next = projectId
    ? `/app/automation/projects/${projectId}`
    : opportunity.data
      ? `/app/automation/opportunities/${opportunity.data.id}`
      : null

  return (
    <nav
      aria-label="Proposal steps"
      className="mt-8 flex flex-col-reverse gap-3 border-t border-gray-100 pt-6 sm:flex-row sm:items-center sm:justify-between"
    >
      <Link
        to={`/app/ideas/${ideaId}`}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 text-sm font-semibold text-ink hover:border-jade/40 hover:bg-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-jade/40"
      >
        <ArrowRightIcon className="h-4 w-4 rotate-180" />
        Back to the idea
      </Link>
      {next && (
        <Link
          to={next}
          state={returnHere('Back to the proposal')}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-forest px-5 text-sm font-semibold text-white hover:bg-pine focus:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
        >
          Next: Automation delivery
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      )}
    </nav>
  )
}
