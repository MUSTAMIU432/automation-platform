/**
 * The figures on the signed-in dashboard (`dashboardCounts`,
 * backend/dashboard/counts.py). Each counts what the page its card leads to
 * would list for the viewer, so the number and the page always agree.
 */

import { graphqlClient } from '../../../graphql/client'

export interface DashboardCounts {
  ideas: number
  reviewQueue: number
  myIdeasInReview: number
  opportunities: number
  projects: number
}

const DASHBOARD_COUNTS_QUERY = `
  query DashboardCounts($organizationId: ID) {
    dashboardCounts(organizationId: $organizationId) {
      ideas
      reviewQueue
      myIdeasInReview
      opportunities
      projects
    }
  }
`

/** `organizationId` is the switcher's organization, whose review queue counts for a reviewer there. */
export async function dashboardCountsRequest(
  organizationId: string | null,
): Promise<DashboardCounts> {
  const data = await graphqlClient.request<{ dashboardCounts: DashboardCounts }>(
    DASHBOARD_COUNTS_QUERY,
    { organizationId },
  )
  return data.dashboardCounts
}
