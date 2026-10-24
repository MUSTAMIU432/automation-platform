import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { useAuth } from '../../identity/auth/AuthContext'
import {
  adminCapabilitiesRequest,
  NO_ADMIN_CAPABILITIES,
  type AdminCapabilities,
} from '../api/capabilitiesApi'
import { AdminCapabilitiesContext, type AdminCapabilitiesValue } from './AdminCapabilitiesContext'

interface Answer {
  key: string
  userId: string | null
  capabilities: AdminCapabilities | null
}

/**
 * What the signed-in user may do in the administration console, asked once per
 * signed-in user and shared by the navigation and the console's own layout.
 *
 * **An offer, never a grant.** This decides whether to show the "Admin" link
 * and which action buttons to render; the server authorizes every console
 * query and mutation on its own, so a wrong answer here can only hide or show
 * a control. A failed request is reported as `error` with no capabilities -
 * fail closed - rather than as "not an administrator", so the console can say
 * "could not check" instead of "not allowed".
 */
export function AdminCapabilitiesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [reloadToken, setReloadToken] = useState(0)
  const key = JSON.stringify([userId, reloadToken])
  const [answer, setAnswer] = useState<Answer | null>(null)

  useEffect(() => {
    if (userId === null) return

    let cancelled = false
    adminCapabilitiesRequest()
      .then((capabilities) => {
        if (!cancelled) setAnswer({ key, userId, capabilities })
      })
      .catch(() => {
        if (!cancelled) setAnswer({ key, userId, capabilities: null })
      })
    return () => {
      cancelled = true
    }
  }, [userId, key])

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  // Permissions change while the app is open - a role given, a new permission added - so
  // ask again whenever the tab comes back into view, rather than only at sign-in.
  useEffect(() => {
    if (userId === null) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') reload()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [userId, reload])

  const value = useMemo<AdminCapabilitiesValue>(() => {
    // While a refresh for the same person is in flight, the last answer stands: asking
    // again must not flash the app back to "no permissions".
    const current =
      answer !== null && (answer.key === key || (answer.userId === userId && answer.capabilities))
        ? answer
        : null
    if (userId === null) {
      return { status: 'ready', capabilities: NO_ADMIN_CAPABILITIES, reload }
    }
    if (current === null) {
      return { status: 'loading', capabilities: NO_ADMIN_CAPABILITIES, reload }
    }
    if (current.capabilities === null) {
      return { status: 'error', capabilities: NO_ADMIN_CAPABILITIES, reload }
    }
    return { status: 'ready', capabilities: current.capabilities, reload }
  }, [answer, key, userId, reload])

  return (
    <AdminCapabilitiesContext.Provider value={value}>{children}</AdminCapabilitiesContext.Provider>
  )
}
