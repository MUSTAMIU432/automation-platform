/**
 * A hook the GraphQL client awaits before every request, so the request goes out with an
 * access token that is still valid.
 *
 * It lives here, apart from both the client and the token-refresh code, because the
 * refresh itself is a GraphQL request: the client cannot import the refresh module
 * without a cycle. `features/identity/auth/tokenRefresh.ts` registers the guard; the
 * client only knows that there may be one.
 */

export type RequestGuard = (operationName: string | undefined) => Promise<void>

let guard: RequestGuard | null = null

export function setRequestGuard(next: RequestGuard | null): void {
  guard = next
}

export function getRequestGuard(): RequestGuard | null {
  return guard
}
