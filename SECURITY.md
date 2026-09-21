# Security Policy

## Project Status

This repository is in Sprint 0 (foundation). The security **foundation**
described below is implemented and tested. **Authentication and authorization
(Identity) are not implemented** — they are planned for Sprint 1 — so the
application has no login, users, roles or permissions yet, and the GraphQL API
is unauthenticated.

## Reporting a Vulnerability

If you discover a security vulnerability, please report it privately
rather than opening a public issue. Contact the repository maintainer
directly (see the GitHub organization/repository owner) with:

- A description of the vulnerability
- Steps to reproduce
- Potential impact

Please allow reasonable time for a response and fix before public
disclosure.

## Current Security Foundation

Implemented and covered by automated tests (`backend/tests/test_security.py`,
`test_settings.py`). Every value is environment-driven; see
[`docs/environments.md`](docs/environments.md) for the variables.

### Secrets and configuration

- No secrets are committed. `.env` files are git-ignored; only `.env.example`
  files with placeholders are tracked. Deployed environments take secrets from
  secret management or injected environment variables, not from files.
- `DJANGO_SECRET_KEY` and `DATABASE_URL` are required in every environment and
  have no default.
- Deployed environments reject a placeholder or short (under 50 characters)
  secret key.
- CI uses throwaway, non-secret values and no repository secrets.

### Environment separation

- Local development uses `config.settings.local`; every deployed environment
  (development, staging, production) uses `config.settings.production`, so
  shared environments get production's security posture.
- The two cannot be mixed up: production settings reject `ENVIRONMENT` values
  other than `development`, `staging` and `production` (including `local` and
  `ci`), and local settings reject the deployed names. CI (`ENVIRONMENT=ci`)
  is a test context using local settings and cannot run as a deployed
  instance.
- Production settings refuse to start (`ImproperlyConfigured`) on unsafe
  configuration rather than falling back to a weaker one.

### Production settings (`config.settings.production`)

| Area | Behaviour |
| ---- | --------- |
| Debug | `DEBUG` is forced off; `DJANGO_DEBUG=True` is rejected. GraphiQL is served only when `DEBUG` is on |
| Hosts | `DJANGO_ALLOWED_HOSTS` is required; empty or `*` is rejected |
| HTTPS | HTTP is redirected to HTTPS (`DJANGO_SECURE_SSL_REDIRECT`, default on). Behind a TLS-terminating proxy, `DJANGO_TRUST_X_FORWARDED_PROTO` is an explicit opt-in and is off by default |
| Cookies | Session and CSRF cookies are always `Secure` (not configurable) |
| HSTS | Enabled, this host only. Default max-age is one year in `production` and one hour in `development` and `staging` (a short first-rollout window); `DJANGO_SECURE_HSTS_SECONDS` overrides either. `includeSubDomains` and `preload` are off by default and opt-in, and unsafe combinations are rejected |
| CSRF | `CSRF_TRUSTED_ORIGINS` is environment-driven; entries must be explicit `https://` origins with no wildcard |
| CORS | `CORS_ALLOWED_ORIGINS` must be explicit `https://` origins with no wildcard; empty means no cross-origin access. Applies to `/graphql/` only. `CORS_ALLOW_ALL_ORIGINS` and `CORS_ALLOW_CREDENTIALS` are off |

### Browser protections (all environments)

Set explicitly in `config.settings.base` so they cannot silently change:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` (clickjacking protection)
- `Referrer-Policy: same-origin`
- `Cross-Origin-Opener-Policy: same-origin`
- HttpOnly session cookie; `SameSite=Lax` session and CSRF cookies

Local development stays practical: HTTP localhost works, with no HTTPS
redirect, secure-only cookies or HSTS, and the Vite dev server origin
(`http://localhost:5173`) is allowed by default.

### Verification

`python manage.py check --deploy` against a valid production configuration
reports no issues other than the two deliberate opt-in warnings
(`security.W005` includeSubDomains, `security.W021` preload); a test enforces
this.

## Known Limitations (Sprint 0)

- No authentication or authorization. The GraphQL endpoint is unauthenticated
  and CSRF-exempt (there is no cookie-based session to protect yet); this must
  be revisited when Identity lands.
- Django's admin site is routed at `/admin/` (a default of the project
  template). No user accounts exist to sign in with, and it should be reviewed
  or restricted before any deployment.
- In deployed environments `/health/` is subject to the HTTPS redirect like
  every other route; see
  [`docs/environments.md`](docs/environments.md#https-behind-a-proxy) for
  health checks behind a proxy.
- No deployment infrastructure exists, so the production settings have been
  verified by tests and `check --deploy` only, not on a live host.

## Planned / Not Yet Implemented

- **Sprint 1 — Identity:** registration, login, sessions/tokens, password
  reset, roles and permissions, and the CSRF and credentialed-CORS decisions
  that come with them.
- Rate limiting and audit-logging architecture.
- Not yet scheduled: a Content-Security-Policy (depends on the frontend
  hosting model) and dependency/secret scanning in CI.
