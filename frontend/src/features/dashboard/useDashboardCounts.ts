import { useEffect, useState } from 'react'

import { dashboardCountsRequest, type DashboardCounts } from './api/dashboardApi'

export type DashboardCountsState =
  | { status: 'loading' }
  | { status: 'ready'; counts: DashboardCounts }
  | { status: 'failed' }

/**
 * The dashboard's figures for the active organization, asked again when the
 * switcher changes it. A failure is its own state, so a card can say the
 * number is unavailable rather than show a made-up zero.
 */
export function useDashboardCounts(organizationId: string | null): DashboardCountsState {
  const [state, setState] = useState<{ key: string | null; value: DashboardCountsState }>({
    key: organizationId,
    value: { status: 'loading' },
  })

  // A new organization starts from "loading" rather than showing the last one's figures.
  if (state.key !== organizationId) {
    setState({ key: organizationId, value: { status: 'loading' } })
  }

  useEffect(() => {
    let cancelled = false
    dashboardCountsRequest(organizationId)
      .then((counts) => {
        if (!cancelled) setState({ key: organizationId, value: { status: 'ready', counts } })
      })
      .catch(() => {
        if (!cancelled) setState({ key: organizationId, value: { status: 'failed' } })
      })
    return () => {
      cancelled = true
    }
  }, [organizationId])

  return state.value
}
