import { ProposalAnswerCard } from '../../proposals/components/ProposalAnswerSummary'
import { cancelOpportunity, type Opportunity } from '../api/automationApi'
import { label } from '../utils/labels'
import { useOutcome } from '../utils/useOutcome'
import { cardClass, dangerButton, NoticeBanner } from './ui'

const CANCELLABLE = new Set(['ready_for_assignment', 'assigned'])

export function OverviewTab({
  opportunity,
  onChanged,
}: {
  opportunity: Opportunity
  onChanged: () => void
}) {
  const stage = useOutcome()
  const closed = opportunity.status === 'cancelled' || opportunity.status === 'completed'

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-5">
        {/* The owner's terms for going ahead, read before assigning and building. */}
        <ProposalAnswerCard
          ideaId={opportunity.ideaId}
          title="What the owner asked for"
          className=""
        />
        <section className={cardClass} aria-labelledby="ov-problem">
          <h3 id="ov-problem" className="text-base font-bold text-ink">
            The problem
          </h3>
          <p className="mt-2 text-sm leading-6 whitespace-pre-line text-gray-700">
            {opportunity.problemStatement || 'No problem statement was recorded.'}
          </p>
          <h3 className="mt-5 text-base font-bold text-ink">Goal</h3>
          <p className="mt-2 text-sm leading-6 whitespace-pre-line text-gray-700">
            {opportunity.automationGoal || 'No goal was recorded.'}
          </p>
          <h3 className="mt-5 text-base font-bold text-ink">Expected benefit</h3>
          <p className="mt-2 text-sm leading-6 whitespace-pre-line text-gray-700">
            {opportunity.expectedBenefit || 'No expected benefit was recorded.'}
          </p>
        </section>
      </div>

      <aside className="space-y-5">
        <section className={cardClass} aria-labelledby="ov-next">
          <h3 id="ov-next" className="text-base font-bold text-ink">
            What happens next
          </h3>
          <NoticeBanner notice={stage.notice} />
          {closed ? (
            <p className="mt-2 text-sm text-gray-600">
              This opportunity is {label(opportunity.status).toLowerCase()}.
            </p>
          ) : (
            <p className="mt-2 text-sm text-gray-600">
              {opportunity.status === 'ready_for_assignment'
                ? 'The owner accepted the proposal. A developer or team is assigned next - see the Assignment tab.'
                : opportunity.status === 'assigned'
                  ? 'It is assigned. The developer creates the project - see the Assignment tab.'
                  : 'The project is under way. Follow it in the Project tab.'}
            </p>
          )}
          {CANCELLABLE.has(opportunity.status) && opportunity.capabilities.canTransition && (
            <button
              type="button"
              disabled={stage.busy}
              onClick={() => {
                if (
                  window.confirm('Cancel this opportunity? The idea can start again afterwards.')
                ) {
                  void stage.run(() => cancelOpportunity(opportunity.id), onChanged)
                }
              }}
              className={`mt-3 w-full ${dangerButton}`}
            >
              Cancel opportunity
            </button>
          )}
        </section>
      </aside>
    </div>
  )
}
