import { useState } from 'react'

import { opportunitiesRequest } from '../api/automationApi'
import { label } from '../utils/labels'
import { useLoad } from '../utils/useLoad'
import { OpportunityCard } from './OpportunityCard'
import { Empty, Loading, LoadFailed } from './ui'

const STATUSES = [
  'draft',
  'discovery',
  'requirements',
  'solution_design',
  'proposal',
  'ready_for_assignment',
  'assigned',
  'project_created',
  'completed',
  'cancelled',
]

/** Every opportunity the reader may see, newest first, filterable by stage. */
export function OpportunitiesPage() {
  const [status, setStatus] = useState('')
  const list = useLoad(() => opportunitiesRequest(status || undefined), `opps:${status}`)

  return (
    <section aria-labelledby="opps-heading" className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 id="opps-heading" className="text-xl font-bold text-ink">
            Automation opportunities
          </h2>
          {list.data && (
            <span className="rounded-full bg-mist px-3 py-1 text-sm font-semibold text-jade ring-1 ring-inset ring-jade/15">
              {list.data.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="opp-status" className="text-sm font-medium text-sage">
            Stage
          </label>
          <select
            id="opp-status"
            className="h-10 w-48 rounded-xl border border-gray-200 bg-white px-3 text-sm text-ink focus:border-jade/50 focus:outline-none focus:ring-2 focus:ring-mint/40"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">Any stage</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {label(value)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {list.loading ? (
        <Loading what="opportunities" />
      ) : list.failed ? (
        <LoadFailed what="the opportunities" onRetry={list.reload} />
      ) : list.data && list.data.length > 0 ? (
        <ul className="mt-4 space-y-4">
          {list.data.map((opportunity) => (
            <OpportunityCard key={opportunity.id} opportunity={opportunity} />
          ))}
        </ul>
      ) : (
        <div className="mt-4">
          <Empty title="No automation opportunities yet.">
            Approved ideas will appear here when they are ready for implementation.
          </Empty>
        </div>
      )}
    </section>
  )
}
