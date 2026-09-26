# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added — Sprint 1: Identity & Access

- S1-002: User registration — the `identity` app's `User` model (email as
  the login identifier, Django's own password hashing) and a `register`
  GraphQL mutation with email normalization and password/phone validation.
  See `backend/identity/models.py` and `services.py`.
- S1-003: Email/password authentication — `login`/`refreshToken`/`logout`
  mutations, short-lived JWT access tokens held in memory only, and a
  persistent, rotating `RefreshSession` credential delivered as an HttpOnly
  cookie (never `localStorage`). `me` resolves the current user from the
  access token alone. `CORS_ALLOW_CREDENTIALS` is on for the cookie, still
  scoped to an explicit, non-wildcard origin allow-list.
- S1-004: Google sign-in — the `googleLogin` mutation over Google Identity
  Services' ID-token (OIDC) flow rather than an authorization-code exchange,
  so no client secret exists on either side. Credential verification
  (`backend/identity/google_oauth.py`) covers signature, issuer, audience
  and expiry, plus one-time-use replay protection keyed by the token's
  hash. **Account-linking policy: refuse, never link** — only an exact
  `(provider, provider_subject)` match authenticates into an existing
  account; a matching email is refused with the same generic message as an
  invalid credential, *regardless* of `email_verified`. Auto-linking by
  verified email was considered and rejected; the reasoning is recorded in
  `identity/authentication.py`.
- S1-005: Current user and protected application — the `me` query as the
  single authoritative identity source (no arguments, so no client value can
  influence it), `RequireAuth` gating `/app`, and the dashboard shell.
- S1-006: Organization membership — `Organization`/`Membership` models, the
  `createOrganization` bootstrap mutation, and `meOrganizations`/
  `meMemberships`. The bootstrap is deliberately gated on authentication
  alone: requiring a membership permission there would be circular, since
  the membership does not exist until the organization does.
- S1-007: Roles and permissions — `Role`, `Permission` and `MembershipRole`,
  all organization-scoped, with a system `Owner` role granted the full
  permission set at creation.
- S1-008: Authorization and tenant isolation — every organization-scoped
  operation resolves the caller's active membership and derives permission
  from it (`organizations/authorization.py`); nothing reads authorization
  input from the request. Cross-tenant requests return nothing and never
  confirm the target exists.
- S1-009: Sprint 1 integration and security hardening —
  - Fixed the backend Google configuration: `GOOGLE_OAUTH_CLIENT_ID` was
    read by the code while the local `backend/.env` stored the value under
    the wrong name, silently disabling Google sign-in. Corrected locally,
    documented in `backend/.env.example`, and pinned by tests that assert
    the exact variable name and that a misnamed one is ignored.
  - Removed a real Google client id from `frontend/.env.example`; the
    template is a placeholder again and a test rejects any real-looking
    client id in either template.
  - Added a shared cache abstraction: three separated aliases
    (`default`, `replay_protection`, `auth_throttle`) selected by
    `CACHE_URL`, which is now **required** in deployed environments and
    refused if it resolves to a per-process backend. Google replay
    protection and the new rate limits are correct across processes because
    of it, and both fail closed if the cache is unreachable.
  - Added authentication rate limiting (`identity/throttling.py`) on
    `login` (per account *and* per client), `googleLogin` (per client),
    `refreshToken` (per credential *and* per client) and `register` (per
    client), checked before the expensive work, with hashed subjects, a
    shared counter, recovery on window expiry, and no change to the generic
    authentication messages.
  - Reworked the frontend's access-token lifecycle: `tokenStore` holds the
    expiry alongside the token, and the new `tokenRefresh` refreshes
    proactively before expiry through a *single* in-flight promise (the
    refresh cookie is single-use, so overlapping refreshes would revoke
    each other), treats a failed refresh as terminal for the session
    instead of retrying, and writes nothing to browser storage.
  - Wired `SignUpForm` to the real `register` mutation, mapping the
    backend's field-level errors onto the matching fields and replacing the
    fake timeout. Registration does not authenticate, so success shows a
    confirmation leading to sign-in.
  - Added end-to-end HTTP integration suites: the complete authentication
    journey (cookie attributes, refresh rotation, replay rejection, logout,
    post-logout refresh), tenant isolation across two organizations, the
    Google sign-in flow end to end, the organization bootstrap model, the
    CSRF posture of `/graphql/`, and a two-sided GraphQL schema contract
    check shared with the frontend.
  - `.coveragerc` now includes `organizations`, so coverage reflects
    S1-006/S1-007/S1-008.
  - A refused Google account-linking collision is now reported
    specifically: a caller whose credential Google verified as
    `email_verified: true` is told the address already has an account, with
    the two real next steps, instead of a bare "Could not sign in with
    Google." with nothing to act on. The **refusal is unchanged** - Google
    sign-in still never auto-links by email, verified or not. The disclosure
    is gated on `email_verified` precisely so it cannot become an
    account-existence oracle: nobody can present a Google credential for an
    address they do not control, so the only addresses anyone can get an
    answer about are their own. Every other failure keeps the single generic
    message, and one message covers the whole collision class so a caller
    cannot learn whether the existing account is password-registered or
    belongs to a different Google identity. See
    `identity/authentication.py`'s `GoogleEmailInUseError`.
  - A transport failure during sign-in no longer rejects or strands the
    form. `login`/`loginWithGoogle` now always resolve to an outcome, so a
    backend that is simply not running shows an actionable error and
    re-enables the form instead of leaving the button spinning and logging
    an uncaught rejection. The message is deliberately not one of the
    backend's generic authentication messages - those report a decision the
    request never reached.
  - Documentation corrected: `frontend/README.md` described automatic
    Google account linking, a design that was rejected; `docs/architecture.md`
    now reflects S1-005 through S1-009 and `docs/environments.md` documents
    `CACHE_URL`.

### Added — Sprint 0: Foundation

- S0-001: Repository foundation — `frontend/`, `backend/`, `docs/`,
  `infrastructure/`, `scripts/` directory boundaries; `.github/` workflow,
  issue, and PR templates; root `.gitignore`, `.env.example`, `README.md`,
  `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`, and `LICENSE`.
- S0-002: Django backend foundation — bare Django project under
  `backend/config`, environment-driven settings split into
  `base`/`local`/`production` via `django-environ`, SQLite placeholder
  database, and a dependency-free `/health/` endpoint. No business domain
  apps, authentication, PostgreSQL, or GraphQL yet.
- S0-006: Environment configuration — `ENVIRONMENT` convention (local,
  development, staging, production); required `DJANGO_SECRET_KEY` with no
  default; environment-driven CORS (`django-cors-headers`, `/graphql/` only)
  and CSRF trusted origins; fail-fast validation in
  `config.settings.production`; per-app `.env.example` files
  (`backend/`, `frontend/`); `docs/environments.md`.
- S0-007: Testing foundation — backend `pytest` + `pytest-django` +
  `pytest-cov` (`backend/tests/`, `requirements-dev.txt`); frontend Vitest +
  React Testing Library + jsdom with V8 coverage (`test`, `test:run`,
  `test:coverage`); existing GraphQL and settings tests migrated to pytest;
  a blank `DATABASE_URL` now fails at startup.
- S0-008: Code quality foundation — backend Ruff (lint, import sorting,
  format) configured in `backend/ruff.toml`; frontend Oxlint config expanded
  (React hooks, a11y, import, vitest rules; warnings fail CI) plus `oxfmt`
  formatter and `typecheck`/`format`/`format:check`/`lint:fix` scripts;
  existing code made compliant. No pre-commit hooks: local checks (and CI,
  once workflows exist) are the quality gate.
- S0-009: GitHub Actions CI foundation — `.github/workflows/ci.yml` runs
  backend (Ruff, Django checks, migration check, pytest with coverage against
  a PostgreSQL service) and frontend (Oxlint, oxfmt, `tsc`, Vitest, production
  build) jobs on pull requests to and pushes to `develop`/`main`. Read-only
  permissions, no secrets, no deployment.
- S0-010: Documentation foundation — new `docs/development.md`,
  `docs/testing.md` and `docs/git-workflow.md`; `docs/architecture.md`
  current-implementation status and repository structure brought up to date
  (target architecture preserved); `docs/environments.md` documents the CI
  execution context; `README.md` and `CONTRIBUTING.md` corrected for stale
  Sprint 0 statements and linked to the new guides.
- S0-011: Security foundation — explicit shared browser protections in
  `base.py` (nosniff, referrer policy, COOP, `X-Frame-Options: DENY`,
  HttpOnly/SameSite cookies, CORS wildcard and credentials off);
  production HSTS (default one year in production, one hour in
  development/staging, environment-driven, `includeSubDomains`
  and `preload` opt-in and validated) and opt-in proxy HTTPS detection
  (`DJANGO_TRUST_X_FORWARDED_PROTO`); `config.settings.local` now refuses
  deployed `ENVIRONMENT` names so neither local nor CI can run as production;
  `tests/test_security.py` (settings invariants, response headers, HTTPS
  redirect, `check --deploy`); `SECURITY.md` rewritten to match. No
  authentication or authorization yet (Sprint 1).
