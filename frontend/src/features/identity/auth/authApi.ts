/**
 * GraphQL operations for authentication (login, refresh, logout), used
 * only by AuthContext - components call `useAuth()`, not these directly.
 * All requests go through the single shared `graphqlClient`
 * (frontend/src/graphql/client.ts); this module defines documents and
 * response shapes only, no client of its own.
 */

import { graphqlClient } from '../../../graphql/client'

export interface AuthUser {
  id: string
  email: string
  firstName: string
  lastName: string
  phoneNumber: string
  isActive: boolean
  isVerified: boolean
}

export interface AuthSession {
  accessToken: string
  accessTokenExpiresAt: string
  user: AuthUser
}

export interface AuthResult {
  success: boolean
  message: string
  session: AuthSession | null
}

/**
 * Shown when the request could not be made at all — the server is down, DNS
 * failed, CORS or a preflight blocked it — rather than when it was made and
 * refused.
 *
 * Deliberately different from every authentication-failure message, and not
 * a weakening of it. The backend collapses unknown email, wrong password,
 * inactive account, refused Google link and throttling into one generic
 * answer so nothing about the account can be inferred; that reasoning is
 * untouched. A transport failure is a different fact: the request never
 * reached an authentication decision, so answering "Invalid email or
 * password" would be reporting a verdict that was never given, and would
 * send the user off to re-type a password that was correct all along. It
 * also says nothing about the account either way.
 */
export const NETWORK_ERROR_MESSAGE = 'We could not reach the server. Please try again.'

interface RawAuthPayload {
  success: boolean
  message: string
  accessToken: string | null
  accessTokenExpiresAt: string | null
  user: AuthUser | null
}

const USER_FIELDS = `
  id
  email
  firstName
  lastName
  phoneNumber
  isActive
  isVerified
`

const LOGIN_MUTATION = `
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      success
      message
      accessToken
      accessTokenExpiresAt
      user { ${USER_FIELDS} }
    }
  }
`

const REFRESH_TOKEN_MUTATION = `
  mutation RefreshToken {
    refreshToken {
      success
      message
      accessToken
      accessTokenExpiresAt
      user { ${USER_FIELDS} }
    }
  }
`

const LOGOUT_MUTATION = `
  mutation Logout {
    logout {
      success
    }
  }
`

const GOOGLE_LOGIN_MUTATION = `
  mutation GoogleLogin($input: GoogleLoginInput!) {
    googleLogin(input: $input) {
      success
      message
      accessToken
      accessTokenExpiresAt
      user { ${USER_FIELDS} }
    }
  }
`

const ME_QUERY = `
  query Me {
    me { ${USER_FIELDS} }
  }
`

function toAuthResult(payload: RawAuthPayload): AuthResult {
  if (payload.success && payload.accessToken && payload.accessTokenExpiresAt && payload.user) {
    return {
      success: true,
      message: payload.message,
      session: {
        accessToken: payload.accessToken,
        accessTokenExpiresAt: payload.accessTokenExpiresAt,
        user: payload.user,
      },
    }
  }
  return { success: false, message: payload.message, session: null }
}

export async function loginRequest(email: string, password: string): Promise<AuthResult> {
  const data = await graphqlClient.request<{ login: RawAuthPayload }>(LOGIN_MUTATION, {
    input: { email, password },
  })
  return toAuthResult(data.login)
}

/**
 * Exchanges the browser's httpOnly refresh cookie (if any) for a fresh
 * access token, rotating the refresh credential. Called on app start to
 * silently re-establish a session after a reload - the access token itself
 * never survives a reload (it's memory-only), only the cookie does.
 */
export async function refreshTokenRequest(): Promise<AuthResult> {
  const data = await graphqlClient.request<{ refreshToken: RawAuthPayload }>(REFRESH_TOKEN_MUTATION)
  return toAuthResult(data.refreshToken)
}

export async function logoutRequest(): Promise<void> {
  await graphqlClient.request<{ logout: { success: boolean } }>(LOGOUT_MUTATION)
}

/**
 * Exchanges a Google ID token (from Google Identity Services, obtained by
 * `useGoogleSignIn`) for a platform session. The credential is opaque to
 * this module and to the backend's caller - only `identity.google_oauth`
 * verifies it; nothing here trusts anything about the signed-in Google
 * account beyond what that verification returns.
 */
export async function googleLoginRequest(credential: string): Promise<AuthResult> {
  const data = await graphqlClient.request<{ googleLogin: RawAuthPayload }>(GOOGLE_LOGIN_MUTATION, {
    input: { credential },
  })
  return toAuthResult(data.googleLogin)
}

/**
 * The one query AuthContext uses to confirm "who is the currently
 * authenticated user" for whatever access token is currently in
 * `tokenStore` - the canonical source of truth for bootstrapping a session
 * (see AuthContext's mount-time logic), not the `user` object embedded in
 * a login/refresh mutation's own response (which is a same-request
 * convenience, not re-checked independently). Returns `null` for the same
 * reason the backend's `me` resolver does - a missing, invalid, expired,
 * wrong-type, or inactive-user token - never throws for that; a thrown
 * error here means something else went wrong (network, transport).
 */
export async function meRequest(): Promise<AuthUser | null> {
  const data = await graphqlClient.request<{ me: AuthUser | null }>(ME_QUERY)
  return data.me
}

/** The fields the backend's `RegisterInput` requires. */
export interface RegisterInput {
  firstName: string
  lastName: string
  email: string
  phoneNumber: string
  password: string
}

export interface RegisterResult {
  success: boolean
  message: string
  /**
   * The `RegisterInput` field a failure applies to, in the same camelCase
   * naming the schema uses, or `null` for a whole-form failure. Lets the
   * form show a backend validation error next to the field that caused it,
   * exactly where it shows its own client-side ones.
   */
  field: string | null
}

const REGISTER_MUTATION = `
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      success
      message
      field
    }
  }
`

/**
 * Creates an account. The backend's `register` mutation creates the User
 * record only - it does not authenticate, so this returns no session and
 * the caller still has to sign in (see `SignUpForm`).
 *
 * A GraphQL-level `errors` array is *not* a registration failure: the
 * backend reports every input problem as `success: false` with a `field`,
 * so it is returned like any other outcome. A thrown error here therefore
 * means something the mutation never got to - a network failure, an
 * unreachable server - and callers must treat it as a distinct, whole-form
 * error rather than a validation result.
 */
export async function registerRequest(input: RegisterInput): Promise<RegisterResult> {
  const data = await graphqlClient.request<{ register: RegisterResult }>(REGISTER_MUTATION, {
    input,
  })
  return data.register
}
