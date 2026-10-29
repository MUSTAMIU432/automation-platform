/**
 * The session's two tokens. Authentication is token-based, with no cookie.
 *
 * - The **access token** - a short-lived JWT - is held in memory only and
 *   attached to every request as `Authorization: Bearer` by
 *   `graphql/client.ts`. Its expiry is stored alongside it: a client can only
 *   refresh *proactively* if it knows when the token stops working, and
 *   keeping the two together makes it impossible to hold one without the
 *   other. `clearAccessToken()` resets both for the same reason.
 * - The **refresh token** - single-use, rotated on every refresh and
 *   revocable on the server - is kept in `localStorage`, so it survives a
 *   reload and is shared by every tab; it is what re-establishes a session
 *   after a reload. Where storage is unavailable (a private window that
 *   refuses it) it falls back to memory: the session then lasts for this tab.
 *
 * `features/identity/auth/AuthContext.tsx` and `tokenRefresh.ts` are the only
 * writers. Nothing else should import the setters.
 */

let accessToken: string | null = null
let accessTokenExpiresAt: number | null = null

export function getAccessToken(): string | null {
  return accessToken
}

/**
 * The current access token's expiry as a Unix epoch in milliseconds, or
 * `null` when there is no token (or its expiry was never recorded).
 *
 * Parsed once, on the way in, so every reader compares numbers rather than
 * re-parsing an ISO string - and so an unparseable value becomes `null`
 * ("unknown", which refreshes sooner) rather than `NaN`, which would make
 * every comparison false and never refresh at all.
 */
export function getAccessTokenExpiresAt(): number | null {
  return accessTokenExpiresAt
}

/**
 * The same expiry as an ISO 8601 string - the shape the backend sends and
 * the shape `tokenRefresh` schedules from - or `null` when there is none.
 * Exposed so a consumer that needs to re-arm the refresh schedule (a
 * provider remounting mid-session, say) can do so from the token already in
 * memory without having to invent its own deadline.
 */
export function getAccessTokenExpiresAtIso(): string | null {
  return accessTokenExpiresAt === null ? null : new Date(accessTokenExpiresAt).toISOString()
}

export function setAccessToken(token: string | null, expiresAt?: string | null): void {
  accessToken = token
  accessTokenExpiresAt = token && expiresAt ? Date.parse(expiresAt) : null
  if (accessTokenExpiresAt !== null && Number.isNaN(accessTokenExpiresAt)) {
    accessTokenExpiresAt = null
  }
}

export function clearAccessToken(): void {
  setAccessToken(null)
}

/** Where the refresh token is kept; other tabs watch this key to follow a sign-out. */
export const REFRESH_TOKEN_STORAGE_KEY = 'mustanet.refreshToken'

let memoryRefreshToken: string | null = null

export function getRefreshToken(): string | null {
  try {
    return window.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY) ?? memoryRefreshToken
  } catch {
    return memoryRefreshToken
  }
}

export function setRefreshToken(token: string | null): void {
  memoryRefreshToken = token
  try {
    if (token) window.localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, token)
    else window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY)
  } catch {
    // Storage refused: the in-memory copy above carries this tab's session.
  }
}
