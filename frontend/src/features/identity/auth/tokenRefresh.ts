/**
 * Keeping the access token alive (S1-009).
 *
 * Authentication is token-based, with no cookie: the access token is a
 * short-lived JWT held only in memory (`graphql/tokenStore.ts`), and the
 * refresh token - kept in `localStorage`, shared by every tab - is presented
 * to `refreshToken`, which rotates it server-side every time it is used. This
 * module is the scheduling and the concurrency control around that. The
 * shared state lives in `tokenRefreshState.ts`; this file is the policy that
 * acts on it.
 *
 * Three problems it solves:
 *
 * 1. **Proactive refresh.** `refreshToken` is called shortly *before* the
 *    current access token expires, using the `accessTokenExpiresAt` the
 *    backend already returns, instead of waiting for a request to come back
 *    unauthenticated. A user mid-click never sees the gap.
 *
 * 2. **One refresh at a time.** The refresh token is single-use: every
 *    `refreshToken` rotates it, and the old one is revoked. So two
 *    overlapping refreshes are not merely wasteful - the second presents an
 *    already-revoked token. Within a tab, concurrent callers share a single
 *    in-flight promise; across tabs, a Web Lock makes them take turns, and
 *    each reads the stored token only once it holds the lock, so it always
 *    presents the newest one. (The server also honours a just-rotated token
 *    for a few seconds, for a browser without Web Locks.)
 *
 * 3. **No retry loops.** A failed refresh is terminal for the session, not
 *    an event to retry: the failure handler signs the user out, the
 *    schedule is cancelled, and a `failed` latch short-circuits any further
 *    refresh call - including one from a scheduled timer that was already
 *    queued - until a real sign-in lifts it. There is no code path from
 *    "refresh failed" back to "refresh again".
 *
 * The minimum-interval floor is the other half of that guarantee, and it
 * protects the *success* path: a backend (or a test clock) handing out a
 * token whose lifetime is shorter than the refresh skew would otherwise
 * have this module refresh continuously. The floor makes the fastest
 * possible refresh cadence one per `MIN_REFRESH_INTERVAL_MS`, whatever the
 * token lifetime says.
 */

import {
  REFRESH_TOKEN_STORAGE_KEY,
  clearAccessToken,
  getAccessToken,
  getAccessTokenExpiresAt,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from '../../../graphql/tokenStore'
import { setRequestGuard } from '../../../graphql/requestGuard'
import { refreshTokenRequest, type AuthSession } from './authApi'
import { resetTokenRefreshState, tokenRefreshState as state } from './tokenRefreshState'

/**
 * How long before expiry a refresh is scheduled.
 *
 * A minute of headroom is enough to cover a slow network round trip and the
 * request that was already on the wire when the timer fired, without
 * meaningfully shortening the session.
 */
export const REFRESH_SKEW_MS = 60_000

/**
 * The fastest this module will ever refresh, whatever the token's lifetime
 * claims. Bounds the success path against a pathological (or mocked)
 * lifetime; see the module docstring.
 */
export const MIN_REFRESH_INTERVAL_MS = 30_000

/**
 * The largest delay a browser `setTimeout` can actually represent.
 *
 * Anything above this overflows the 32-bit signed millisecond counter and
 * fires *immediately* instead - which, for a schedule derived from a long
 * token lifetime, turns "refresh once in a very long while" into "refresh
 * continuously". Clamping here is what makes a far-future expiry (a test
 * fixture, a clock skew, a genuinely long-lived token) schedule correctly
 * rather than becoming a busy loop.
 */
const MAX_TIMEOUT_MS = 2_147_483_647

/** The Web Lock every tab of this app refreshes under. */
const REFRESH_LOCK = 'mustanet-auth-refresh'

/**
 * Runs `work` while holding the cross-tab refresh lock, so tabs refresh one
 * after another; without Web Locks (an old browser, a test runner) it simply runs.
 */
function withRefreshLock<T>(work: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  if (!locks?.request) return work()
  return locks.request(REFRESH_LOCK, work) as Promise<T>
}

/**
 * Registers what should happen when a refresh fails. Called by AuthContext;
 * replacing rather than adding to, so a remount cannot leave two handlers
 * behind and sign the user out twice.
 */
export function setAuthenticationFailureHandler(handler: (() => void) | null): void {
  state.onAuthenticationFailure = handler
}

/**
 * Marks the start of a real, user-driven session and clears any leftover
 * failure state.
 *
 * Called after `login`/`loginWithGoogle` succeed, and at the start of the
 * mount-time bootstrap - which is itself a first sign-in attempt, and the
 * only thing that should be able to clear a latch left behind by a previous
 * session. Deliberately not called from anywhere else: within a session, a
 * failed refresh must stay failed.
 */
export function beginSession(): void {
  state.failed = false
}

/**
 * Refreshes the access token, at most once at a time.
 *
 * Every concurrent caller - the proactive timer, a request that needs a
 * guaranteed-fresh token, a component reacting to expiry - receives the same
 * promise and therefore the same single network round trip and the same
 * single cookie rotation. Resolves with the new session, or `null` when the
 * session could not be renewed.
 */
export function refreshAccessToken(): Promise<AuthSession | null> {
  if (state.failed) {
    return Promise.resolve(null)
  }
  if (state.inFlight) {
    return state.inFlight as Promise<AuthSession | null>
  }

  // The session this refresh belongs to. Refreshes are not instant, and one
  // can easily be overtaken while it waits: the app loads, the bootstrap
  // refresh goes out, and the user signs in before it comes back. A refresh
  // that has been superseded must not overwrite - or tear down - the session
  // that replaced it, so both outcomes below are checked against this.
  const tokenAtStart = getAccessToken()
  const isSuperseded = () => getAccessToken() !== tokenAtStart

  const attempt = (async (): Promise<AuthSession | null> => {
    try {
      const result = await withRefreshLock(async () => {
        // Read only now, holding the lock: another tab may have just rotated it.
        // With none stored the server simply answers "not signed in", as for
        // any signed-out visitor.
        const presented = getRefreshToken() ?? ''
        const answer = await refreshTokenRequest(presented)
        if (answer.success && answer.session?.refreshToken) {
          setRefreshToken(answer.session.refreshToken)
        } else if (!answer.success && presented && getRefreshToken() === presented) {
          // Refused by the server, not merely unreachable: the stored token is dead.
          setRefreshToken(null)
        }
        return answer
      })
      if (!result?.success || !result.session) {
        throw new Error('refresh rejected')
      }
      if (isSuperseded()) {
        // Someone signed in or out while this was in flight. The browser
        // cookie has already rotated either way, so there is nothing useful
        // to install - and installing it would sign the newer session out.
        return null
      }
      setAccessToken(result.session.accessToken, result.session.accessTokenExpiresAt)
      beginSession()
      scheduleProactiveRefresh(result.session.accessTokenExpiresAt)
      return result.session
    } catch {
      if (isSuperseded()) {
        return null
      }
      // Terminal, and deliberately not retried. `beginSession` is the only
      // way back, and only a real sign-in calls it.
      state.failed = true
      clearAccessToken()
      cancelProactiveRefresh()
      state.onAuthenticationFailure?.()
      return null
    } finally {
      state.inFlight = null
    }
  })()

  state.lastRefreshStartedAt = Date.now()
  state.inFlight = attempt
  return attempt
}

/**
 * Refreshes only if the current token is at (or past) its expiry margin,
 * otherwise resolves with `null` without a request. For callers that need a
 * token guaranteed valid for the request they are about to make.
 */
export async function ensureFreshAccessToken(): Promise<AuthSession | null> {
  if (!isRefreshDue()) {
    return null
  }
  return refreshAccessToken()
}

/**
 * Whether the current token is gone, unmeasured, or within the refresh
 * margin. An unknown expiry counts as due: refreshing early is cheap,
 * discovering the deadline after the server starts rejecting requests is
 * not.
 */
export function isRefreshDue(now = Date.now()): boolean {
  const expiresAt = getAccessTokenExpiresAt()
  if (expiresAt === null) return true
  return expiresAt - now <= REFRESH_SKEW_MS
}

/**
 * Schedules the next proactive refresh for `accessTokenExpiresAt`.
 *
 * Replaces any pending schedule rather than adding to it, so a session
 * established twice (StrictMode, a fast re-login) leaves exactly one timer.
 */
export function scheduleProactiveRefresh(accessTokenExpiresAt: string | null): void {
  cancelProactiveRefresh()
  if (!accessTokenExpiresAt) return

  const expiresAt = Date.parse(accessTokenExpiresAt)
  if (Number.isNaN(expiresAt)) return

  const untilRefresh = expiresAt - Date.now() - REFRESH_SKEW_MS
  const sinceLastRefresh = state.lastRefreshStartedAt
    ? state.lastRefreshStartedAt + MIN_REFRESH_INTERVAL_MS - Date.now()
    : 0
  const delay = Math.min(Math.max(untilRefresh, sinceLastRefresh, 0), MAX_TIMEOUT_MS)

  state.scheduledTimer = setTimeout(() => {
    state.scheduledTimer = null
    // Resolves either way: a failure signs the user out via the handler, and
    // the `failed` latch means a second fire is a no-op.
    void refreshAccessToken()
  }, delay)
}

/** Cancels any pending proactive refresh. */
export function cancelProactiveRefresh(): void {
  if (state.scheduledTimer !== null) {
    clearTimeout(state.scheduledTimer)
    state.scheduledTimer = null
  }
}

/** Whether a proactive refresh is currently scheduled. */
export function isProactiveRefreshScheduled(): boolean {
  return state.scheduledTimer !== null
}

/**
 * The session's own requests: they run without a usable access token by nature, and the
 * refresh must never wait on itself.
 */
const SESSION_OPERATIONS = new Set(['RefreshToken', 'Login', 'GoogleLogin', 'Logout'])

/**
 * Before any other request of a signed-in session, renew an access token that is expired
 * or about to be. Requests made while a refresh is running wait for that same refresh.
 */
export async function guardRequest(operationName: string | undefined): Promise<void> {
  if (operationName && SESSION_OPERATIONS.has(operationName)) return
  if (getAccessToken() === null || state.failed) return
  if (isRefreshDue()) await refreshAccessToken()
}

setRequestGuard(guardRequest)

/**
 * Signing out in one tab removes the shared refresh token; every other tab follows,
 * rather than carrying on with an access token whose session has ended.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== REFRESH_TOKEN_STORAGE_KEY || event.newValue !== null) return
    if (getAccessToken() === null) return
    clearAccessToken()
    cancelProactiveRefresh()
    state.onAuthenticationFailure?.()
  })
}

/**
 * A tab coming back into view - a laptop waking, most often - may hold a token that
 * expired while its refresh timer was paused. Renew it at once rather than on the next
 * request.
 */
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    if (getAccessToken() === null || state.failed || !isRefreshDue()) return
    void refreshAccessToken()
  })
}

export { resetTokenRefreshState }
