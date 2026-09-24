import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { setAccessToken } from '../../../graphql/tokenStore'
import { loginRequest, logoutRequest, refreshTokenRequest, type AuthUser } from './authApi'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

export interface LoginOutcome {
  success: boolean
  message: string
}

interface AuthContextValue {
  status: AuthStatus
  user: AuthUser | null
  login: (email: string, password: string) => Promise<LoginOutcome>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

/**
 * Owns the app's authentication state, so it isn't scattered across
 * components - everything else reads it through `useAuth()`.
 *
 * The access token itself is never exposed here (or anywhere else in
 * component state): it's held only in the shared GraphQL client's
 * in-memory token store (graphql/tokenStore.ts) and attached automatically
 * to outgoing requests. This context only ever hands components `status`
 * and `user`.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<AuthUser | null>(null)

  const applySession = useCallback((session: { accessToken: string; user: AuthUser } | null) => {
    if (session) {
      setAccessToken(session.accessToken)
      setUser(session.user)
      setStatus('authenticated')
    } else {
      setAccessToken(null)
      setUser(null)
      setStatus('unauthenticated')
    }
  }, [])

  useEffect(() => {
    // On first load (including a hard refresh) there's no access token in
    // memory yet - only the httpOnly refresh cookie the browser already
    // holds, if any. Try to exchange it for a fresh access token before
    // deciding whether the app is authenticated.
    let cancelled = false

    refreshTokenRequest()
      .then((result) => {
        if (cancelled) return
        applySession(result.success && result.session ? result.session : null)
      })
      .catch(() => {
        if (!cancelled) applySession(null)
      })

    return () => {
      cancelled = true
    }
  }, [applySession])

  const login = useCallback(
    async (email: string, password: string): Promise<LoginOutcome> => {
      const result = await loginRequest(email, password)
      applySession(result.success && result.session ? result.session : null)
      return { success: result.success, message: result.message }
    },
    [applySession],
  )

  const logout = useCallback(async () => {
    // Local state is cleared even if the network call fails - the user
    // asked to log out, and the access token being dropped from memory
    // here means this tab can't make authenticated requests regardless of
    // whether the server-side session was also revoked. The network error
    // (if any) is deliberately swallowed, not just ignored via `finally`:
    // callers can treat `logout()` as always succeeding locally, the same
    // way the backend's own logout mutation is designed to never fail.
    try {
      await logoutRequest()
    } catch {
      // Best-effort: the server-side session may not have been revoked,
      // but there is nothing actionable for the caller to do about it.
    } finally {
      applySession(null)
    }
    // react-hooks/exhaustive-deps requires applySession here; oxlint's own
    // react/memo-dependencies flags the same dependency as unnecessary
    // (it's a stable, empty-deps callback) - the two rules disagree on
    // this exact case, so the latter is suppressed rather than dropping a
    // dependency exhaustive-deps correctly requires.
    // oxlint-disable-next-line react/memo-dependencies
  }, [applySession])

  const value = useMemo(() => ({ status, user, login, logout }), [status, user, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// The Provider and its matching hook belong in one small, cohesive module;
// splitting them into two files purely for a Fast-Refresh optimization
// isn't worth the fragmentation for a file this size.
// oxlint-disable-next-line react/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
