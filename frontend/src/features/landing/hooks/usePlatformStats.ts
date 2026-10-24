import { useEffect, useState } from 'react'

import { platformStatsRequest, type PlatformStats } from '../api/statsApi'

/**
 * The platform's real figures, or null while loading or if they could not be
 * fetched - in which case the page shows a dash, never a made-up number.
 */
export function usePlatformStats(): PlatformStats | null {
  const [stats, setStats] = useState<PlatformStats | null>(null)

  useEffect(() => {
    let cancelled = false
    platformStatsRequest()
      .then((result) => {
        if (!cancelled) setStats(result)
      })
      .catch(() => {
        // The figures are decoration on top of the page; without them it still works.
      })
    return () => {
      cancelled = true
    }
  }, [])

  return stats
}
