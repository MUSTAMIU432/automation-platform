import { Link } from 'react-router-dom'

import { ArrowRightIcon, ChartIcon } from '../../../components/AppIcons'
import type { Opportunity } from '../api/automationApi'
import { deliveryCardClass } from '../utils/deliverySteps'
import { CONTEXT_LABEL, label } from '../utils/labels'
import { DeliveryTracker } from './DeliverySteps'
import { Badge } from './ui'

/** One opportunity as a card, for the list and the developer queue. */
export function OpportunityCard({ opportunity }: { opportunity: Opportunity }) {
  return (
    <li>
      <Link to={`/app/automation/opportunities/${opportunity.id}`} className={deliveryCardClass}>
        <span className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-mint/40 to-mint/10 text-jade"
          >
            <ChartIcon className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-start justify-between gap-2">
              <span className="min-w-0">
                <span className="block text-base font-bold text-ink">{opportunity.title}</span>
                <span className="mt-0.5 block text-xs text-sage">
                  {CONTEXT_LABEL[opportunity.submissionContext]}
                  {opportunity.tenantName ? ` · ${opportunity.tenantName}` : ''} · Owned by{' '}
                  {opportunity.ownerName}
                </span>
              </span>
              <span className="flex shrink-0 flex-wrap items-center gap-2">
                <Badge
                  value={opportunity.priority}
                  text={`${label(opportunity.priority)} priority`}
                />
                <Badge value={opportunity.status} />
              </span>
            </span>
            {opportunity.problemStatement && (
              <span className="mt-2 line-clamp-2 block text-sm leading-6 text-ink/75">
                {opportunity.problemStatement}
              </span>
            )}
            <span className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3">
              <DeliveryTracker status={opportunity.status} />
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-jade">
                View
                <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </span>
          </span>
        </span>
      </Link>
    </li>
  )
}
