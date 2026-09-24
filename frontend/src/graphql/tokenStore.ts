/**
 * Holds the current short-lived access token in memory only - never in
 * localStorage/sessionStorage (a stolen token there survives an XSS
 * payload's next page load; an in-memory value doesn't survive any reload
 * at all, which is exactly the point - the httpOnly refresh cookie is what
 * re-establishes a session after a reload, not this).
 *
 * `graphql/client.ts` reads this to attach `Authorization: Bearer <token>`
 * to every request; `features/identity/auth/AuthContext.tsx` is the only
 * writer, updating it on login/refresh/logout. Nothing else should import
 * the setter.
 */

let accessToken: string | null = null

export function getAccessToken(): string | null {
  return accessToken
}

export function setAccessToken(token: string | null): void {
  accessToken = token
}
