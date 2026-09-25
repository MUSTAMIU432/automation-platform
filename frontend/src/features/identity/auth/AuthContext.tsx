import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { getAccessToken, setAccessToken } from '../../../graphql/tokenStore'
import {
  googleLoginRequest,
  loginRequest,
  logoutRequest,
  meRequest,
  refreshTokenRequest,
  type AuthUser,
} from './authApi'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

export interface LoginOutcome {
  success: boolean
  message: string
}

interface AuthContextValue {
  status: AuthStatus
  user: AuthUser | null
  login: (email: string, password: string) => Promise<LoginOutcome>
  loginWithGoogle: (credential: string) => Promise<LoginOutcome>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

interface ResolvedSession {
  accessToken: string
  user: AuthUser
}

/**
 * Establishes the current session the way `me` makes authoritative: an
 * in-memory access token (if any) is confirmed via `me` first, rather than
 * assumed valid; if that doesn't resolve to a user (no token yet, or an
 * expired/invalid one), the existing refresh mechanism is tried exactly
 * once, and `me` is checked again with whatever token that produces. Never
 * loops beyond that single refresh attempt - a failed refresh (or a `me`
 * that still fails afterwards) resolves to `null`, not another retry.
 *
 * Used for the mount-time bootstrap below. `login`/`loginWithGoogle`
 * deliberately don't route through this - their own mutation's returned
 * `user` is already a fresh, server-validated result from the same
 * request, and re-querying `me` immediately afterwards would just be an
 * extra round trip proving what the mutation already established.
 */
async function resolveSession(isCurrent: () => boolean): Promise<ResolvedSession | null> {
  const existingToken = getAccessToken()
  if (existingToken && isCurrent()) {
    const user = await meRequest().catch(() => null)
    if (!isCurrent()) return null
    if (user) return { accessToken: existingToken, user }
  }

  if (!isCurrent()) return null
  const refreshResult = await refreshTokenRequest().catch(() => null)
  if (!isCurrent() || !refreshResult?.success || !refreshResult.session) return null

  setAccessToken(refreshResult.session.accessToken)
  const user = await meRequest().catch(() => null)
  if (!isCurrent() || !user) return null

  return { accessToken: refreshResult.session.accessToken, user }
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
  const authVersionRef = useRef(0)
  const bootstrapPromiseRef = useRef<Promise<ResolvedSession | null> | null>(null)

  const applySession = useCallback((session: ResolvedSession | null) => {
    authVersionRef.current += 1
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
    // holds, if any - so resolveSession()'s own token check is normally a
    // no-op here and it goes straight to refresh; the check still exists
    // because this effect is the same bootstrap path a provider remount
    // within an already-running tab would take, and that case *can* have
    // a token already in memory.
    let cancelled = false
    const authVersion = authVersionRef.current
    const isCurrent = () => authVersionRef.current === authVersion
    const bootstrapPromise = bootstrapPromiseRef.current ?? resolveSession(isCurrent)
    bootstrapPromiseRef.current = bootstrapPromise

    bootstrapPromise
      .then((session) => {
        if (!cancelled && isCurrent()) applySession(session)
      })
      .catch(() => {
        if (!cancelled && isCurrent()) applySession(null)
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

  const loginWithGoogle = useCallback(
    async (credential: string): Promise<LoginOutcome> => {
      const result = await googleLoginRequest(credential)
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
    const request = logoutRequest()
    applySession(null)
    try {
      await request
    } catch {
      // Best-effort: the server-side session may not have been revoked,
      // but there is nothing actionable for the caller to do about it.
    }
    // react-hooks/exhaustive-deps requires applySession here; oxlint's own
    // react/memo-dependencies flags the same dependency as unnecessary
    // (it's a stable, empty-deps callback) - the two rules disagree on
    // this exact case, so the latter is suppressed rather than dropping a
    // dependency exhaustive-deps correctly requires.
    // oxlint-disable-next-line react/memo-dependencies
  }, [applySession])

  const value = useMemo(
    () => ({ status, user, login, loginWithGoogle, logout }),
    [status, user, login, loginWithGoogle, logout],
  )

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
