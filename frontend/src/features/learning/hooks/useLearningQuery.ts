import { useCallback, useEffect, useState } from 'react'

export interface LearningQuery<T> {
  data: T | null
  loading: boolean
  error: string | null
  reload: () => void
}

/**
 * One read, keyed by everything it depends on - the same discipline as the
 * console's `useAdminQuery`: an answer is matched to the request it answers by
 * key, so a superseded request (a new search, a reload) can never overwrite a
 * newer one, and a reload keeps the current answer on screen until the new one
 * lands. `key` must change whenever `load` would ask something different.
 */
export function useLearningQuery<T>(
  key: string,
  load: () => Promise<T>,
  errorMessage = 'We could not load this. Please try again.',
): LearningQuery<T> {
  const [reloadToken, setReloadToken] = useState(0)
  const requestKey = `${key}#${reloadToken}`
  const [answer, setAnswer] = useState<{ key: string; data: T } | null>(null)
  const [errorKey, setErrorKey] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    load()
      .then((data) => {
        if (cancelled) return
        setAnswer({ key: requestKey, data })
        setErrorKey(null)
      })
      .catch(() => {
        if (!cancelled) setErrorKey(requestKey)
      })
    return () => {
      cancelled = true
    }
    // `load` is a fresh closure every render; `requestKey` is what it depends on.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [requestKey])

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])
  const sameQuery = answer !== null && answer.key.startsWith(`${key}#`)
  const failed = errorKey === requestKey

  return {
    data: sameQuery ? answer.data : null,
    loading: !(answer !== null && answer.key === requestKey) && !failed,
    error: failed ? errorMessage : null,
    reload,
  }
}
