# Frontend

React + TypeScript + Vite web application.

**Status:** Sprint 0 (S0-003) delivered the infrastructure foundation.
Sprint 1 has added the Identity feature: the `/auth` sign in/up/forgot-
password UI (S1-002), real email/password authentication - login, an
in-memory access token, and session persistence via the backend's refresh
cookie (S1-003) - and Google/OAuth sign-in via Google Identity Services,
wired into the same `AuthContext`/session mechanics (S1-004). See
[`/docs/architecture.md`](../docs/architecture.md) for the target frontend
architecture.

## Stack

- React 19 + TypeScript
- Vite 8
- React Router (`react-router-dom`) — client-side routing
- Tailwind CSS 4 (via `@tailwindcss/vite`)
- `graphql-request` — minimal GraphQL client, no cache/store to configure

## Prerequisites

- Node.js 22+
- npm

## Installation

```bash
cd frontend
npm install
cp .env.example .env
```

## Development

```bash
npm run dev
```

## Production build

```bash
npm run build   # runs `tsc -b` then `vite build`, output in dist/
npm run preview # serve the production build locally
```

## Code quality

Oxlint (lint), the TypeScript compiler (types, including unused
locals/parameters) and oxfmt (formatting, the Oxc formatter that pairs with
Oxlint) are the only quality tools. Config: [`.oxlintrc.json`](.oxlintrc.json),
[`.oxfmtrc.json`](.oxfmtrc.json), `tsconfig.*.json`.

```bash
npm run lint           # Oxlint; warnings fail the run (CI-friendly)
npm run lint:fix       # apply safe auto-fixes
npm run typecheck      # tsc -b
npm run format:check   # formatting check for src/ and vite.config.ts
npm run format         # apply formatting
```

Oxlint enables the correctness rules plus React hooks, accessibility
(`jsx-a11y`), import, TypeScript and Vitest rules. `format` covers source code
only (`src/`, `vite.config.ts`), not JSON or Markdown.

## Testing

Vitest + React Testing Library + jsdom, configured in `vite.config.ts`.

```bash
npm run test           # watch mode (development)
npm run test:run       # single non-interactive run (CI, pre-PR)
npm run test:coverage  # single run with V8 coverage; report in coverage/
```

Tests sit next to the code they cover (`Foo.tsx` → `Foo.test.tsx`).
Shared helpers live in `src/test/`. Tests never call a real backend:
`VITE_GRAPHQL_URL` is fixed in the Vitest config and network calls are
stubbed, so results don't depend on `frontend/.env`.

## Environment configuration

Vite only exposes variables prefixed `VITE_` to the browser bundle — never
put secrets (API keys, credentials, backend secret keys) here.

| Variable            | Purpose                                      |
| ------------------- | --------------------------------------------- |
| `VITE_GRAPHQL_URL`  | Public URL of the Django GraphQL endpoint (required) |
| `VITE_GOOGLE_OAUTH_CLIENT_ID` | Google OAuth client id for "Sign in with Google" (optional - the button is disabled, not broken, when unset) |

Values are compiled into the bundle at build time. See
[`/docs/environments.md`](../docs/environments.md) for the environment
strategy.

See `.env.example`. Access env vars through [`src/lib/env.ts`](src/lib/env.ts)
rather than reading `import.meta.env` directly in components.

## Architecture

```
src/
├── app/            # App root wiring: route tree (routes.tsx)
├── components/     # Shared reusable UI (ErrorBoundary, etc.)
├── features/
│   └── identity/   # Sign in/up/forgot-password UI, auth state (auth/)
├── graphql/         # Centralized GraphQL client (client.ts), token store
├── layouts/        # Page shells (RootLayout)
├── lib/            # Cross-cutting utilities (env access)
├── routes/         # Route-level page components (HomePage, DashboardPage, ...)
├── types/          # Ambient TypeScript declarations
├── App.tsx         # Root component: ErrorBoundary + AuthProvider + RouterProvider
└── main.tsx        # Entry point
```

`hooks/` is intentionally not created yet — it'll be added when the first
shared hook (outside a feature) actually needs it.

### GraphQL client

[`src/graphql/client.ts`](src/graphql/client.ts) exports a single shared
`graphqlClient` (a `graphql-request` `GraphQLClient`) configured from
`VITE_GRAPHQL_URL`. Feature modules import this client rather than
constructing their own or hardcoding a URL. Two things make every request
authenticated automatically, without a second "authenticated client":
`credentials: 'include'` (so the backend's refresh-token cookie flows with
cross-origin requests) and a `headers` function that reads the current
access token from [`src/graphql/tokenStore.ts`](src/graphql/tokenStore.ts)
and attaches `Authorization: Bearer <token>` when one is set.

### Authentication (Sprint 1, S1-003/S1-004)

[`src/features/identity/auth/`](src/features/identity/auth) owns all
authentication state:

- `authApi.ts` — the `login`/`googleLogin`/`refreshToken`/`logout` GraphQL
  operations.
- `AuthContext.tsx` — `AuthProvider` (wraps the router in `App.tsx`) and the
  `useAuth()` hook, exposing `status` (`'loading' | 'authenticated' |
  'unauthenticated'`), `user`, `login()`, `loginWithGoogle()` and
  `logout()`. On mount, it silently calls `refreshToken` once to
  re-establish a session from the backend's cookie (see below) before
  deciding the status. `loginWithGoogle()` and `login()` both funnel into
  the same `applySession()` - a successful Google sign-in is
  indistinguishable, from `AuthContext`'s point of view, from a password
  login.
- `useGoogleSignIn.ts` — wires the existing, custom-styled
  `GoogleAuthButton` to Google Identity Services (GIS), loaded dynamically
  from `accounts.google.com` (never bundled). GIS only issues a credential
  from a real click on a button *it* rendered, so this renders GIS's own
  button into a visually hidden container and forwards a click on
  `GoogleAuthButton` to it - Google's own documented pattern for a
  custom-styled trigger. Returns `isConfigured` (false, and the button
  stays inertly disabled, when `VITE_GOOGLE_OAUTH_CLIENT_ID` is unset) and
  `trigger()`. Used from both `SignInForm` and `SignUpForm` - Google
  sign-in doesn't distinguish signing up from signing in, so both call the
  same `loginWithGoogle()`.

**Token storage, deliberately:** the short-lived access token lives only in
`graphql/tokenStore.ts` - a plain in-memory module variable, never
`localStorage`/`sessionStorage`. It does not survive a page reload by
design; `AuthContext`'s mount-time `refreshToken` call is what re-establishes
a session afterwards, using the backend's `HttpOnly` refresh-session cookie
(which JavaScript can't read at all, by design - see `backend/README.md`'s
GraphQL API section and `docs/architecture.md` for the full cookie/CORS/CSRF
design).

`src/features/identity/components/RequireAuth.tsx` gates the `/app` route:
it shows a neutral loading state while the initial `refreshToken` call is in
flight, redirects to `/auth` if it comes back unauthenticated, and renders
the protected route otherwise.

### Error handling

[`src/components/ErrorBoundary.tsx`](src/components/ErrorBoundary.tsx)
wraps the router in `App.tsx` so a render error in any route shows a
fallback message instead of an uncontrolled blank page.

### Routing

[`src/app/routes.tsx`](src/app/routes.tsx) defines the route tree via
`createBrowserRouter`:

- `/` (`HomePage`) and a catch-all (`NotFoundPage`).
- `/auth` (`AuthPage`) — sign in, sign up and forgot password, combined into
  one view that swaps in place (see the Identity feature's own docs in
  `src/features/identity/`).
- `/reset-password` (`ResetPasswordPage`) — UI only; no backend mutation
  exists yet (see What this is not).
- `/app` (`RequireAuth` → `DashboardPage`) — the authenticated area,
  redirecting to `/auth` when there's no session. `DashboardPage` is a
  placeholder proving the login/session lifecycle end to end, not a real
  product surface.

Future business domains each get their own route module under
`src/features/<domain>` and are wired into this tree.

## What this is not

Real product features (organizations, ideas, reviews, projects,
notifications, ...) don't exist yet - only Identity's sign-in/registration
UI and authentication. Within Identity itself, the forgot-password/
reset-password *backend* is not implemented (the UI is ready for it); the
reset-password form is a visual placeholder. Those land in later Identity
tasks. `GoogleAuthButton` is no longer a placeholder (S1-004) - see
Authentication above - but there is no authenticated "link this Google
account to my existing session" flow; linking an existing password account
happens automatically, by verified email, only during a Google sign-in
attempt.
