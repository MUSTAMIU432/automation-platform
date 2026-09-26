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

Implemented: the Django project, split settings, the `graphql_api`
infrastructure app (not a business domain), and the first two business
domain apps — `identity` and `organizations`. The rest are
introduced incrementally in later sprints.

### API (target — foundation implemented)

GraphQL is the primary application API. REST is reserved for
infrastructure/specialized operations: file uploads/downloads, webhooks,
health checks, and OAuth callbacks.

Implemented: the `/graphql/` endpoint with a foundation schema and the
`/health/` check. No file, webhook or OAuth endpoints exist.

### Database (target — implemented)

PostgreSQL, configured entirely through environment variables — no
credentials committed to source control. Implemented via `DATABASE_URL`.
`identity` and `organizations` own the business models and
migrations; every other domain is still only Django's built-in tables.

### Asynchronous Processing (target — not yet implemented)

Redis + Celery for background jobs (email, notifications, AI processing,
analytics, scheduled tasks). Not present yet.

Redis (or Memcached, or a database) *is* nevertheless required today for
cache: the Google ID-token replay check and the authentication rate limits
both record state that every process has to agree on, so a per-process cache
would make both silently useless the moment a second worker exists. See
[Caching](#caching-target--implemented) under Security.

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
ALLOWED_HOSTS, CORS/CSRF strategy, security headers, authentication
(Sprint 1, Identity), organization-scoped authorization and tenant
isolation (Sprint 1), authentication rate limiting, and a shared cache for
cross-process security state. Audit logging is still a placeholder.

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
created earlier by a *different* Google identity - is refused.
Google/OAuth sign-in never auto-links by email, **regardless of
`email_verified`**.

The *refusal* is unconditional; the *message* is not, and this is a
deliberate, load-bearing exception to the project's generic-error rule rather
than a loosening of it. A caller whose credential Google verified as
`email_verified: true` is told the address already has an account, and given
the two real next steps (sign in with the existing account, or sign up with a
different address). Everybody else - invalid, expired, replayed, unverified
or unconfigured - still gets the single generic "Could not sign in with
Google.", byte for byte.

That gate is what makes the disclosure safe rather than an account-existence
oracle. Reaching it means the request presented a Google-issued ID token that
passed signature, issuer, audience and expiry checks, and that Google itself
asserts control of that mailbox - so the caller could have established the
fact by checking their own inbox. The attack this must not enable is asking
whether *someone else's* address is registered, and it cannot be: nobody can
present a Google credential for an address they do not control, so the only
addresses anyone can get an answer about are their own. A single message
covers the whole collision class, so a caller also cannot learn whether the
existing account is password-registered or belongs to a different Google
identity - that difference is the existing account's history, not theirs.
Enforced in `identity/authentication.py`'s `_email_collision_error`, and
reasoned through in `GoogleEmailInUseError`.

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
value in. See that module's docstring for the full reasoning.

The record is kept on a dedicated `replay_protection` cache alias rather
than the general `default` cache, so it can never be wiped by routine cache
housekeeping (S1-009). Which backend that alias resolves to is a deployment
requirement, not a local preference: a per-process backend makes the check
complete for a single-process deployment only, because a second worker would
never see what the first one recorded. `CACHE_URL` therefore selects a shared
backend and is **required** in every deployed environment;
`config/settings/production.py` refuses to start if the security-critical
aliases resolve to a local in-memory cache. Local development may use the
in-process backend, where there is only one process to agree with.

A new field-level decision: `User.phone_number` is `blank=True` at the
model level (`identity/migrations/0003_allow_blank_phone_number.py`) so a
Google-provisioned account can be created without one; registration's own
validation (`identity/services.py`) still requires a real phone number for
that path, unaffected. Collecting a phone number for a Google-provisioned
account is deferred to a future "complete your profile" step, not built in
S1-004.

Implemented (S1-005): the `me` query as the one authoritative answer to "who
is the currently authenticated user". It takes no arguments at all - the
access token is the only input - so no client-supplied value can influence
which user is returned, and an absent, invalid, expired, wrong-type or
deactivated-account token all resolve to `null` identically rather than
distinguishing why. On the client, `RequireAuth` gates `/app` on it and
`AuthProvider` uses it as the source of truth for bootstrapping a session.

Implemented (S1-006/S1-007/S1-008): the `organizations` app and
organization-scoped authorization. `Organization`, `Membership`,
`MembershipRole`, `Role` and `Permission` are separate models, and a role
is always scoped to one organization - a role id means nothing without the
organization it belongs to. Every organization-scoped resolver resolves the
caller's **active membership** of the organization being acted on, and
derives permission from the roles attached to that membership
(`organizations/authorization.py`); nothing reads a role, organization or
user from the request body or from a client-supplied claim. Reads
(`organization`, `organizationMembers`, `organizationRoles`) resolve to
`null` or `[]` for a tenant the caller is not an active member of, and
writes (`assignRoleToMembership`, `removeRoleFromMembership`) are refused
without confirming the target exists, so a cross-tenant request cannot be
used to probe which ids are real. The GraphQL surface takes no
organization id for the caller's own listings (`meOrganizations`,
`meMemberships`, `myOrganizationRoles`), so there is no argument to tamper
with there at all.

**Organization bootstrap, and why it is the one permission-gated exception.**
`createOrganization` is gated on being an active authenticated user and
*nothing else*. Requiring a membership permission would be circular: the
membership that carries the grant does not exist until the organization
does, and the grant itself is created by the very call being checked. The
bootstrap is therefore
`authenticated user → organization → creator membership → Owner role →
Owner permissions`, and the `organization.create` permission is still
provisioned and still granted to Owner (so the role's permission set
describes the organization surface completely) but is never used as a gate.
Nothing else is a bootstrap: every *subsequent* operation on the new
organization is permission-checked and tenant-isolated like any other. See
`organizations/services.create_organization_for_user`'s docstring for the
full argument and `organizations/authorization.py`'s module docstring for
what that module deliberately does not do.

Implemented (S1-009): authentication rate limiting (`identity/throttling.py`)
on the four unauthenticated entry points, with the scope chosen per
operation because the threats differ: **login** is limited per account
(credential guessing) *and* per client address (password spraying);
**googleLogin** per client address (there is no account to key on before
verification, and a replayed credential is already refused by the replay
check); **refreshToken** per refresh credential (a stolen cookie being
grounded against the server) *and* per client address (a loop, which
rotation alone would not catch since every successful refresh hands the
caller a fresh budget); **register** per client address. Counters are
fixed-window, on the shared `auth_throttle` cache alias rather than in
process memory, and every attempt is counted *before* the work it would
trigger, so a throttled caller never gets a password hashed or a Google
signature verified on their behalf. A successful sign-in clears that
account's own counter (so a run of typos does not compound), and a throttle
is otherwise lifted only by the window expiring. Rate limiting is not
signalled by a different authentication error: the generic invalid-credential
and Google messages are unchanged, and the throttle answer carries no
account, address or operation detail - it depends only on how many attempts
the caller has made, never on whether the submitted address has an account,
so it cannot be used as an existence oracle.

### Caching (target — implemented)

Django's cache framework with three deliberately separated aliases
(`config/settings/base.py`): `default` for general-purpose caching, and
`replay_protection` and `auth_throttle` for the two pieces of state that
decide a security outcome. The latter two are isolated so a routine
`cache.clear()` on general caching can never erase them, and
`config/settings/production.py` requires a backend every process shares
(`CACHE_URL`) and refuses to start otherwise. What makes this necessary
rather than merely tidy is that a per-process cache is a per-process *copy*:
with one worker it is correct, and with two it is worse than useless for
this purpose, because the second worker admits what the first one blocked.
Both consumers fail **closed** if the cache is unreachable - the alternative
is a silent, invisible removal of a security control.

Not yet implemented: email verification (the `User.is_verified` flag
exists and is now set for Google sign-ins, but registration still leaves
it `False` and current policy lets an unverified user log in either way),
the forgot-password and reset-password *backend* (the frontend UI exists;
no mutation backs it yet), an authenticated "link this Google account to my
existing session" flow (today's Google sign-in only ever authenticates or
provisions - it never links to an existing account), member invitations, a
role-management UI, logout-everywhere, and audit logging. See
[`SECURITY.md`](../SECURITY.md).

### Multi-Tenancy (target — organization tier implemented)

Organization → Membership → User, with resources (Ideas, Projects, etc.)
optionally scoped to an organization for tenant isolation. The
Organization → Membership → User tier and its authorization model are
implemented (S1-006/S1-007/S1-008) - see
[Security](#security-target--partly-implemented) for the enforcement model
and the one bootstrap exception.

### Environments (target — convention implemented)

LOCAL, DEVELOPMENT, STAGING, PRODUCTION, each configured via environment
variables rather than source-code branching. The configuration convention is
implemented; only a local environment exists, with no deployed
infrastructure. See [`environments.md`](environments.md).

## Current Implementation Status

Sprint 0 established the engineering foundation. Sprint 1 (Identity) is
substantially implemented: user registration (S1-002), email/password login
with rotating refresh sessions (S1-003), Google/OAuth sign-in (S1-004), the
current-user query and protected application route (S1-005), organizations
and membership (S1-006), roles and permissions (S1-007), authorization and
tenant isolation (S1-008), and the integration/security hardening pass
(S1-009). What remains inside Identity is the forgot-password/reset-password
backend, email verification, and an authenticated Google-account-linking
flow.

### Implemented (Sprint 1, in progress)

| Area | What exists | Task |
| ---- | ----------- | ---- |
| Identity domain | `identity` app: `User` (email login, hashed passwords), `ExternalIdentity` foundation | S1-002 |
| Registration | `register` GraphQL mutation, email normalization, password/phone validation | S1-002 |
| Authentication | `login`/`refreshToken`/`logout` mutations, JWT access tokens, rotating `RefreshSession` refresh credential in an HttpOnly cookie, `me` query | S1-003 |
| Frontend auth state | `AuthProvider`/`useAuth()`, in-memory access token, `/app` protected route | S1-003 |
| Google/OAuth sign-in | `googleLogin` GraphQL mutation, Google ID-token (OIDC) verification, account provisioning/linking policy, `GoogleAuthButton` wired to Google Identity Services | S1-004 |
| Current user | `me` query as the authoritative identity source, `RequireAuth` gating `/app`, `OrganizationSwitcher`/workspace | S1-005 |
| Organizations | `Organization`/`Membership` models, `createOrganization` bootstrap mutation, `meOrganizations`/`meMemberships` | S1-006 |
| Roles and permissions | `Role`/`Permission`/`MembershipRole`, organization-scoped system `Owner` role, `organizationRoles` | S1-007 |
| Authorization | Permission-gated `organization`/`organizationMembers`/`organizationRoles` queries and `assignRoleToMembership`/`removeRoleFromMembership` mutations; tenant isolation across every one | S1-008 |
| Access-token lifecycle | `tokenStore` holding the token *and* its expiry; `tokenRefresh` proactive, single-flight refresh; `registerRequest` wired into `SignUpForm` | S1-009 |
| Security hardening | Authentication rate limiting (login/googleLogin/refreshToken/register), shared `replay_protection`/`auth_throttle` cache aliases required in deployed environments, end-to-end auth, tenant-isolation and Google-flow integration suites | S1-009 |

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

- Business domain apps other than `identity` and `organizations`: ideas,
  reviews, opportunities, proposals, developers, projects, tasks,
  notifications, impact, files, audit
- Email verification and the forgot-password/reset-password backend
  (frontend UI for these exists; see
  [Security](#security-target--partly-implemented) above); an
  authenticated Google-account-linking flow (today's Google sign-in only
  ever authenticates or provisions a *new* account - it never links to an
  existing one, by verified email or otherwise)
- Member invitations, a role-management or permission-editor UI, and
  logout-everywhere
- Redis + Celery background processing
- AI gateway
- The object storage bucket, presigned uploads and signed downloads
- Audit logging
- React Query in the frontend
- Deployment automation and any deployed environment (development, staging,
  production)

## Repository Structure

```
automation-platform/
├── backend/                  # Django project
│   ├── config/               # settings (base/local/production), urls, health view, wsgi/asgi
│   ├── graphql_api/          # GraphQL infrastructure (not a business domain)
│   ├── identity/             # business domain: accounts, sessions, external identities
│   ├── organizations/        # business domain: organizations, memberships, roles, permissions
│   ├── tests/                # cross-cutting pytest suite (settings, security, integration)
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
