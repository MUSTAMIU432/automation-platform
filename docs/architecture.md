# Architecture

This document describes the **target architecture** for Automation
Platform, and calls out clearly what is **currently implemented** versus
what is planned for future sprints. See
[Current Implementation Status](#current-implementation-status) for what
exists today and [`CHANGELOG.md`](../CHANGELOG.md) for what has landed.

Sections headed "target" describe the intended design. Unless a section says
otherwise, they are not implemented.

## Product Flow

The platform turns real-world problems into delivered automation:

```
PROBLEM → IDEA → VALIDATION → AUTOMATION OPPORTUNITY → REQUIREMENTS
→ PROPOSAL → DEVELOPER/TEAM → PROJECT → DEVELOPMENT → TESTING
→ DEPLOYMENT → IMPACT
```

## Target High-Level Architecture

### Frontend (target — foundation implemented)

React + TypeScript + Vite, using React Router, Tailwind CSS, a GraphQL
client, and React Query for non-GraphQL concerns. Organized by feature so
that a future React Native client can reuse backend contracts without a
backend rewrite.

Implemented: the application shell, routing, Tailwind, a shared GraphQL
client, and an error boundary. Not implemented: React Query, feature
modules, and any business UI. See
[Current Implementation Status](#current-implementation-status).

### Backend (target — foundation implemented)

Django, structured as a **modular monolith**: one Django project containing
separate apps per business domain, rather than one large application.
Expected future domains:

- identity
- organizations
- ideas
- reviews
- opportunities
- proposals
- developers
- projects
- tasks
- notifications
- impact
- files
- audit

Implemented: the Django project, split settings, and a `graphql_api`
infrastructure app (not a business domain). No business domain apps exist
yet. They will be introduced incrementally, starting with Identity in
Sprint 1.

### API (target — foundation implemented)

GraphQL is the primary application API. REST is reserved for
infrastructure/specialized operations: file uploads/downloads, webhooks,
health checks, and OAuth callbacks.

Implemented: the `/graphql/` endpoint with a foundation schema and the
`/health/` check. No file, webhook or OAuth endpoints exist.

### Database (target — implemented)

PostgreSQL, configured entirely through environment variables — no
credentials committed to source control. Implemented via `DATABASE_URL`.
There are no business models or migrations of our own yet, only Django's
built-in ones.

### Asynchronous Processing (target — not yet implemented)

Redis + Celery for background jobs (email, notifications, AI processing,
analytics, scheduled tasks). Not present yet.

### AI Architecture (target — not yet implemented)

AI functionality will live behind a dedicated gateway/service abstraction
rather than being scattered across business domain apps, and its output
will be treated as a recommendation subject to human validation. No AI
functionality exists yet.

### Storage (target — not yet implemented)

Object storage (e.g. S3-compatible) for files, rather than storing large
binary content in PostgreSQL. Not present yet.

### Security (target — partly implemented)

Environment-driven secrets, DEBUG/production settings separation,
ALLOWED_HOSTS, CORS/CSRF strategy, security headers, rate-limiting and audit
architecture placeholders, plus authentication (Sprint 1, Identity).

Implemented (S0-011): environment-driven secrets, the local/production
settings split with fail-fast validation, `ALLOWED_HOSTS`, CORS/CSRF
configuration, secure cookies, HTTPS redirect, HSTS and browser security
headers, with automated tests.

Implemented (S1-002/S1-003): the `identity` app's `User` model (email as the
login identifier, Django's own password hashing), email/password
registration and login, short-lived JWT access tokens, and a persistent,
rotating `RefreshSession` credential delivered as an HttpOnly cookie (never
`localStorage`). `CORS_ALLOW_CREDENTIALS` is on for this reason, still
scoped to an explicit, non-wildcard origin allow-list. See
[`environments.md`](environments.md) for the cookie/CORS/CSRF reasoning and
`backend/identity/` (`models.py`, `services.py`, `authentication.py`,
`tokens.py`, `schema.py`) for the implementation.

Implemented (S1-004): Google/OAuth sign-in via Google Identity Services'
ID-token (OIDC) flow, not the classic authorization-code exchange - the
backend never needs a client secret, since a Google-signed credential is
verified directly against Google's public keys
(`backend/identity/google_oauth.py`) rather than exchanged for one. The
existing `ExternalIdentity(provider='google', provider_subject=<sub>)`
table backs it, unmodified; a successful Google sign-in produces the exact
same JWT access token + `RefreshSession` as email/password login
(`identity/authentication.py`'s `authenticate_with_google`).

Account-linking policy (revised after a dedicated security review; this is
the load-bearing decision in S1-004, not a footnote): the **only** thing
that ever authenticates into an *existing* account is an exact
`(provider='google', provider_subject=<sub>)` match. A first-time Google
identity with no matching `ExternalIdentity` and no existing `User` for its
email provisions a brand-new account (`phone_number` is left blank -
Google never provides one, see below - and `is_verified` is set from
Google's own `email_verified` claim). A first-time Google identity whose
email matches *any* existing account - a password-registered one, or one
created earlier by a *different* Google identity - is refused, with the
same generic message as an invalid credential, **regardless of
`email_verified`**. Google/OAuth sign-in never auto-links by email.

An earlier version of this design *did* auto-link when `email_verified`
was true, reasoning it was equivalent to a password-reset-by-email flow's
trust level. A dedicated review rejected that: `email_verified=true` only
proves Google confirmed mailbox control *at some point in the past* - not
that today's Google sign-in is the same person who registered the platform
account, particularly once an email address can be reassigned outside this
platform's control (e.g. a company reissuing a departed employee's address
to someone new, who gets a fresh Google identity with `email_verified=true`
for it). Auto-linking would have silently and permanently handed that new
mailbox holder the *old* account - with no consent, no notification to the
original owner, and no audit trail - and would have done so as this
platform's first email-provenance-based path into an existing account,
since no password-reset-by-email flow exists yet to compare the risk
against. (The earlier reasoning also cited Firebase Authentication's
default behavior as precedent; that citation was wrong - Firebase's actual
default for a colliding email is to reject the sign-in and require the
existing method first, which is this same refuse-first policy.) An
authenticated "link this Google account to my current session" flow,
initiated by an already-logged-in user, is the intended way to add Google
sign-in to an existing password account, and remains out of scope for
S1-004. See `identity/authentication.py`'s `authenticate_with_google` and
`_resolve_google_user` docstrings for the full reasoning and for how a
provisioning race is prevented from re-opening this via a timing window
(a collision is never resolved by trusting "whichever account has this
email now" - it re-checks from scratch).

Replay protection: Google ID tokens are also rejected on a second use,
even if the token itself is still within its lifetime and would otherwise
still verify (`identity/google_oauth.py`'s `_reject_if_already_used`, keyed
by the token's SHA-256 hash via Django's cache framework, TTL matching the
token's own remaining lifetime). This is deliberately a one-time-use check
rather than a transmitted OIDC `nonce`: GIS's button flow delivers the
credential directly via a JS callback rather than a browser redirect, so
the leak vector a nonce exists to close (a captured authorization redirect
replayed into a different browser session) mostly doesn't apply, and there
is no pre-existing client-side session to have stored an expected nonce
value in. See that module's docstring for the full reasoning, and its
explicit caveat: the default per-process cache backend makes this complete
for a single-process deployment only - a real multi-process/multi-instance
deployment needs a shared cache (Redis/Memcached, not yet configured
anywhere in this project) for the protection to hold across every worker.

A new field-level decision: `User.phone_number` is `blank=True` at the
model level (`identity/migrations/0003_allow_blank_phone_number.py`) so a
Google-provisioned account can be created without one; registration's own
validation (`identity/services.py`) still requires a real phone number for
that path, unaffected. Collecting a phone number for a Google-provisioned
account is deferred to a future "complete your profile" step, not built in
S1-004.

Not yet implemented: email verification (the `User.is_verified` flag
exists and is now set for Google sign-ins, but registration still leaves
it `False` and current policy lets an unverified user log in either way),
the forgot-password and reset-password *backend* (the frontend UI exists;
no mutation backs it yet), an authenticated "link this Google account to my
existing session" flow (today's Google sign-in only ever authenticates or
provisions - it never links to an existing account), a shared cache backend
for Google ID token replay protection across multiple processes/instances,
rate limiting, and audit logging. See [`SECURITY.md`](../SECURITY.md).

### Multi-Tenancy (target — not yet implemented)

Organization → Department → Membership → User, with resources (Ideas,
Projects, etc.) optionally scoped to an organization for tenant isolation.
Not present yet.

### Environments (target — convention implemented)

LOCAL, DEVELOPMENT, STAGING, PRODUCTION, each configured via environment
variables rather than source-code branching. The configuration convention is
implemented; only a local environment exists, with no deployed
infrastructure. See [`environments.md`](environments.md).

## Current Implementation Status

Sprint 0 established the engineering foundation. Sprint 1 (Identity) is
under way: user registration (S1-002), email/password login (S1-003) and
Google/OAuth sign-in (S1-004) are implemented; the rest of Identity and
every other business domain are not.

### Implemented (Sprint 1, in progress)

| Area | What exists | Task |
| ---- | ----------- | ---- |
| Identity domain | `identity` app: `User` (email login, hashed passwords), `ExternalIdentity` foundation | S1-002 |
| Registration | `register` GraphQL mutation, email normalization, password/phone validation | S1-002 |
| Authentication | `login`/`refreshToken`/`logout` mutations, JWT access tokens, rotating `RefreshSession` refresh credential in an HttpOnly cookie, `me` query | S1-003 |
| Frontend auth state | `AuthProvider`/`useAuth()`, in-memory access token, `/app` protected route | S1-003 |
| Google/OAuth sign-in | `googleLogin` GraphQL mutation, Google ID-token (OIDC) verification, account provisioning/linking policy, `GoogleAuthButton` wired to Google Identity Services | S1-004 |

### Implemented (Sprint 0)

| Area | What exists | Task |
| ---- | ----------- | ---- |
| Repository | Monorepo layout, root docs, `.gitignore`, issue and PR templates | S0-001 |
| Backend | Django 5.2 project (`backend/config`), split settings (`base`, `local`, `production`), `/health/` endpoint | S0-002 |
| Frontend | React 19 + TypeScript + Vite 8, React Router, Tailwind CSS 4, shared GraphQL client, error boundary | S0-003 |
| Database | PostgreSQL via `DATABASE_URL` (`psycopg`); no SQLite fallback | S0-004 |
| GraphQL | `/graphql/` via Strawberry Django with a foundation schema (`apiStatus` query, `ping` mutation) | S0-005 |
| Environment configuration | `ENVIRONMENT` convention, per-app `.env.example`, fail-fast production validation, CORS/CSRF settings | S0-006 |
| Security foundation | Production HTTPS/HSTS/cookie/header settings, local-vs-production guards, security tests | S0-011 |
| Testing | Backend pytest + pytest-django + pytest-cov; frontend Vitest + React Testing Library | S0-007 |
| Code quality | Backend Ruff; frontend Oxlint, oxfmt and TypeScript checking | S0-008 |
| CI | GitHub Actions workflow validating backend and frontend on pull requests and pushes to `develop`/`main`; no deployment | S0-009 |
| Documentation | Development, testing, Git workflow and environment guides | S0-010 |

How these are used day to day: [`development.md`](development.md),
[`testing.md`](testing.md), [`git-workflow.md`](git-workflow.md).

### Not implemented (planned)

- Business domain apps other than `identity`: organizations, ideas, reviews,
  opportunities, proposals, developers, projects, tasks, notifications,
  impact, files, audit
- Email verification and the forgot-password/reset-password backend
  (frontend UI for these exists; see
  [Security](#security-target--partly-implemented) above); an
  authenticated Google-account-linking flow (today's linking is automatic,
  by verified email, not user-initiated)
- Authorization (roles/permissions) and multi-tenancy (organizations,
  departments, memberships)
- Redis + Celery background processing
- AI gateway
- Object storage
- Rate limiting and audit logging
- React Query and feature modules in the frontend
- Deployment automation and any deployed environment (development, staging,
  production)

## Repository Structure

```
automation-platform/
├── backend/                  # Django project
│   ├── config/               # settings (base/local/production), urls, health view, wsgi/asgi
│   ├── graphql_api/          # GraphQL infrastructure (not a business domain)
│   ├── tests/                # pytest suite
│   ├── manage.py
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   ├── pytest.ini
│   ├── ruff.toml
│   ├── .coveragerc
│   └── .env.example
├── frontend/                 # React + TypeScript + Vite app
│   ├── src/                  # app, components, graphql, layouts, lib, routes, test, types
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.ts        # Vite and Vitest configuration
│   ├── .oxlintrc.json
│   ├── .oxfmtrc.json
│   └── .env.example
├── docs/
│   ├── architecture.md
│   ├── environments.md
│   ├── development.md
│   ├── testing.md
│   └── git-workflow.md
├── infrastructure/           # Placeholder: no infrastructure implemented yet
├── scripts/                  # Placeholder: no scripts yet
├── .github/
│   ├── workflows/ci.yml      # CI (validation only)
│   ├── ISSUE_TEMPLATE/
│   └── PULL_REQUEST_TEMPLATE.md
├── .env.example              # index pointing at the per-app templates
├── .gitignore
├── README.md
├── CONTRIBUTING.md
├── SECURITY.md
├── CHANGELOG.md
└── LICENSE
```
