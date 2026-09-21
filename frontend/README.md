# Frontend

React + TypeScript + Vite web application. This is the Sprint 0
infrastructure foundation — no authentication or business-domain features
exist yet.

**Status:** Sprint 0, task S0-003 (React Frontend Foundation). See
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

## Type checking & lint

```bash
npx tsc -b --noEmit
npm run lint    # oxlint
```

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
├── graphql/         # Centralized GraphQL client (client.ts)
├── layouts/        # Page shells (RootLayout)
├── lib/            # Cross-cutting utilities (env access)
├── routes/         # Route-level page components (HomePage, NotFoundPage)
├── types/          # Ambient TypeScript declarations
├── App.tsx         # Root component: ErrorBoundary + RouterProvider
└── main.tsx        # Entry point
```

`features/` and `hooks/` are intentionally not created yet — they'll be
added when the first business domain (Identity, in Sprint 1) or the first
shared hook actually needs them.

### GraphQL client

[`src/graphql/client.ts`](src/graphql/client.ts) exports a single shared
`graphqlClient` (a `graphql-request` `GraphQLClient`) configured from
`VITE_GRAPHQL_URL`. Future feature modules import this client rather than
constructing their own or hardcoding a URL. No queries, auth headers, or
domain requests are implemented yet — this is infrastructure only.

### Error handling

[`src/components/ErrorBoundary.tsx`](src/components/ErrorBoundary.tsx)
wraps the router in `App.tsx` so a render error in any route shows a
fallback message instead of an uncontrolled blank page.

### Routing

[`src/app/routes.tsx`](src/app/routes.tsx) defines the route tree via
`createBrowserRouter`. Currently only `/` (`HomePage`) and a catch-all
(`NotFoundPage`) are registered. Future business domains each get their own
route module under `src/features/<domain>` and are wired into this tree —
none exist yet.

## What this is not

No Identity/authentication, organizations, ideas, reviews, projects,
notifications, dashboards, or any other business-domain feature exists in
this codebase yet. Those are implemented in later sprints.
