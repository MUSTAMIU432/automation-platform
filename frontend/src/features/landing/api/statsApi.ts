/**
 * The platform's headline figures (`platformStats`, backend/website/stats.py):
 * real aggregate counts, public, refreshed by the backend every few minutes.
 */

import { graphqlClient } from '../../../graphql/client'

export interface PlatformStats {
  ideasSubmitted: number
  organizations: number
  projects: number
  activeUsers: number
  reviewsCompleted: number
}

const PLATFORM_STATS_QUERY = `
  query PlatformStats {
    platformStats {
      ideasSubmitted
      organizations
      projects
      activeUsers
      reviewsCompleted
    }
  }
`

export async function platformStatsRequest(): Promise<PlatformStats> {
  const data = await graphqlClient.request<{ platformStats: PlatformStats }>(PLATFORM_STATS_QUERY)
  return data.platformStats
}
