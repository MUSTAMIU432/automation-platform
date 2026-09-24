# Environment Configuration

The same code runs in every environment. Only configuration changes:

```
CODE → ENVIRONMENT VARIABLES → ENVIRONMENT-SPECIFIC SETTINGS → APPLICATION
```

## Environments

| Environment   | Purpose                                                    | Django settings module         | `ENVIRONMENT` |
| ------------- | ---------------------------------------------------------- | ------------------------------ | ------------- |
| `local`       | Developer machine: development, debugging, local PostgreSQL and React | `config.settings.local` (default) | `local`       |
| `development` | Shared dev environment: integration, developer testing     | `config.settings.production`   | `development` |
| `staging`     | Production-like: QA, UAT, release validation               | `config.settings.production`   | `staging`     |
| `production`  | Live: real users and data, strict security, no debug       | `config.settings.production`   | `production`  |

Only `local` has a dedicated settings module. Every deployed environment
uses `config.settings.production`, so shared environments get the same
security posture as production; `ENVIRONMENT` just names which one it is.
No infrastructure for development, staging or production exists yet — this
is the configuration convention they will follow. Automated validation in
GitHub Actions is not one of these environments; see
[CI execution context](#ci-execution-context).

Settings layout (`backend/config/settings/`):

- `base.py` — common settings, all read from the environment, plus browser
  protections shared by every environment (see
  [`SECURITY.md`](../SECURITY.md#current-security-foundation))
- `local.py` — debug on, localhost defaults, Vite dev-server CORS/CSRF origins;
  **refuses to start** if `ENVIRONMENT` is anything other than `local` or `ci`,
  so a deployed environment can't run with these permissive settings
- `production.py` — validates configuration and enables secure defaults;
  **refuses to start** (`ImproperlyConfigured`) if any of these hold:
  `ENVIRONMENT` isn't development/staging/production, the secret key is
  missing, a placeholder, or under 50 characters, `DJANGO_DEBUG` is true,
  `DJANGO_ALLOWED_HOSTS` is empty or `*`, a CORS/CSRF origin is not an
  explicit `https://` origin, or the HSTS settings are unsafe (negative
  max-age, or preload without includeSubDomains and a one-year max-age).
  It always enables secure session and CSRF cookies.

## CI execution context

GitHub Actions ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)) runs
the backend and frontend checks on pull requests and on pushes to `develop`
and `main`. It is a **testing execution context, not a deployed
environment**, and is not equivalent to staging or production: nothing is
deployed, no real users or data exist, and it has no persistent
infrastructure.

What CI actually provides:

- The backend job starts a throwaway `postgres:16` service container for the
  duration of the run. It is not a shared or persistent database.
- Backend variables are set in the workflow file itself, with throwaway,
  non-secret values that have no use outside the job. No repository secrets
  are used.
- The Django settings module is the default, `config.settings.local` (chosen
  by `pytest.ini` and `manage.py`); CI does not run the app under
  `config.settings.production`. The production validation rules are covered by
  tests in `backend/tests/test_settings.py` and `test_security.py`, not by
  running CI as production.
- The frontend job needs no environment variables: the Vitest config fixes
  `VITE_GRAPHQL_URL`, and building does not read it.

| Variable | CI value |
| -------- | -------- |
| `ENVIRONMENT` | `ci` |
| `DJANGO_SECRET_KEY` | a fixed CI-only placeholder |
| `DJANGO_DEBUG` | `False` |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1` |
| `DATABASE_URL` | the CI PostgreSQL service on `localhost:5432` |

`ci` is a label for this context only. It is **not** an accepted value for a
deployed environment: `config.settings.production` rejects any `ENVIRONMENT`
other than `development`, `staging` or `production`, so `ci` cannot run a
deployed instance. The reverse also holds: `config.settings.local` accepts
only `local` and `ci`, so a deployed name can't use the local settings. What CI runs is described in
[`testing.md`](testing.md#continuous-integration).

## Backend variables (`backend/.env`)

Template: [`backend/.env.example`](../backend/.env.example).

| Variable                     | Secret | Required          | Purpose |
| ---------------------------- | :----: | ----------------- | ------- |
| `ENVIRONMENT`                |        | no (`local`)      | Environment name (see table above). CI sets `ci`; see [CI execution context](#ci-execution-context) |
| `DJANGO_SECRET_KEY`          | **yes**| **always**        | Django signing key. No default |
| `DJANGO_JWT_SIGNING_KEY`     | **yes**| **always**        | Signs JWT access tokens (Sprint 1). No default; must differ from `DJANGO_SECRET_KEY` when deployed |
| `ACCESS_TOKEN_LIFETIME_MINUTES` |     | no (`15`)         | JWT access token lifetime |
| `REFRESH_TOKEN_LIFETIME_DAYS` |       | no (`30`)         | Refresh session (`RefreshSession`) lifetime |
| `DJANGO_DEBUG`               |        | no                | Default `True` locally; rejected if true when deployed |
| `DJANGO_ALLOWED_HOSTS`       |        | deployed          | Comma-separated hostnames |
| `DATABASE_URL`               | **yes**| **always**        | PostgreSQL URL including the password. No default |
| `DATABASE_CONN_MAX_AGE`      |        | no                | Connection lifetime in seconds (0 local, 60 deployed) |
| `CORS_ALLOWED_ORIGINS`       |        | deployed          | Browser origins allowed to call `/graphql/`. Local defaults to `http://localhost:5173` |
| `CSRF_TRUSTED_ORIGINS`       |        | deployed          | Origins trusted for CSRF-protected requests. Local defaults to `http://localhost:5173` |
| `DJANGO_SECURE_SSL_REDIRECT` |        | no (`True`)       | HTTP→HTTPS redirect (deployed only) |
| `DJANGO_TRUST_X_FORWARDED_PROTO` |    | no (`False`)      | Trust the proxy's `X-Forwarded-Proto` to detect HTTPS (deployed only). See [HTTPS behind a proxy](#https-behind-a-proxy) |
| `DJANGO_SECURE_HSTS_SECONDS` |        | no (`31536000` production, `3600` development/staging) | HSTS max-age in seconds; `0` disables (deployed only) |
| `DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS` | | no (`False`)   | Extend HSTS to every subdomain (deployed only) |
| `DJANGO_SECURE_HSTS_PRELOAD` |        | no (`False`)      | Add the HSTS `preload` directive (deployed only). Requires includeSubDomains and a max-age of at least 31536000 |

Notes:

- Real environment variables override `backend/.env`. Deployed
  environments should not use a `.env` file at all.
- CORS applies only to `/graphql/`. `CORS_ALLOW_CREDENTIALS` is `True`
  (Sprint 1, S1-003): the refresh-token cookie needs credentialed
  cross-origin requests, and this is safe only because
  `CORS_ALLOWED_ORIGINS` stays an explicit, non-wildcard allow-list. The
  GraphQL endpoint remains CSRF-exempt even with that cookie present - see
  the comment in `backend/graphql_api/views.py` for the full reasoning
  (JSON-only requests can't be triggered by a bare HTML form, and the
  cookie's own `SameSite=Lax` blocks genuinely cross-site attachment).
  `CSRF_TRUSTED_ORIGINS` still affects only Django's own forms (e.g. admin).
- The GraphiQL IDE is served only when `DEBUG` is on, so it is never
  exposed in deployed environments.

## Frontend variables (`frontend/.env`)

Template: [`frontend/.env.example`](../frontend/.env.example).

| Variable           | Secret | Required | Purpose |
| ------------------ | :----: | -------- | ------- |
| `VITE_GRAPHQL_URL` | no     | yes      | Public URL of the backend GraphQL endpoint |

Vite is configured at **build time**: the value is compiled into the
bundle, so each environment needs its own build (or build-time variable).

## Backend secrets vs. frontend public configuration

Everything prefixed `VITE_` ships to every visitor's browser. It is public
by definition. Database credentials, `DJANGO_SECRET_KEY`, JWT signing keys,
OAuth client secrets and private API keys belong **only** in the backend
environment — never in a `VITE_` variable, even "temporarily".

## Local setup

```bash
cp backend/.env.example backend/.env      # then set DJANGO_SECRET_KEY and DATABASE_URL
cp frontend/.env.example frontend/.env
```

See [`backend/README.md`](../backend/README.md) for creating the local
PostgreSQL role and database, and [`development.md`](development.md) for the
full setup.

## Env file convention

| File            | Tracked | Purpose |
| --------------- | :-----: | ------- |
| `.env.example`  | yes     | Placeholder template, one per app (`backend/`, `frontend/`) |
| `.env`          | **no**  | Your local values, copied from the template |
| `.env.local`    | **no**  | Frontend only: Vite loads it after `.env` for personal overrides. The backend reads `.env` only |

Precedence (highest first): real environment variables, then the env file.
Deployed environments use real environment variables only.

## Deployed environment conventions

Nothing is provisioned yet; these are the rules the future infrastructure
follows.

- **Development** (shared integration): `ENVIRONMENT=development`,
  `config.settings.production`, its own database and its own secret key.
  Non-production data only.
- **Staging** (production-like QA/UAT): `ENVIRONMENT=staging`, same settings
  and topology as production, own database and secrets, never production
  data or production secrets.
- **Production**: `ENVIRONMENT=production`, secrets from secret management,
  explicit `https://` hostnames and origins, `DJANGO_DEBUG=False`.
- Each environment has its own values for every secret; secrets are never
  shared or reused across environments.
- The frontend is built once per environment with that environment's
  `VITE_GRAPHQL_URL`, and the backend's `CORS_ALLOWED_ORIGINS` must list that
  frontend's origin.
- HSTS is on in every deployed environment (this host only), so a deployed
  environment must be reachable over HTTPS before use. Browsers cache the
  policy, so the default max-age depends on the environment:

  | `ENVIRONMENT` | Default `DJANGO_SECURE_HSTS_SECONDS` |
  | ------------- | ------------------------------------ |
  | `production`  | `31536000` (one year) |
  | `staging`     | `3600` (one hour) |
  | `development` | `3600` (one hour) |

  Development and staging get a short window so a first rollout or a
  misconfigured host is quickly forgotten by browsers; set the variable
  explicitly to raise it (for example, to rehearse the production value on
  staging). Enable `includeSubDomains` and `preload` (both off by default)
  only once every subdomain is HTTPS-only; preload is effectively
  permanent. With those two left off, `manage.py check --deploy` reports
  warnings `security.W005` and `security.W021`; that is expected.

## HTTPS behind a proxy

Deployed environments redirect HTTP to HTTPS and send HSTS only for requests
Django recognises as secure. When TLS is terminated by a proxy or load
balancer, Django sees plain HTTP unless told to trust the proxy's
`X-Forwarded-Proto` header, and the redirect would loop.

Set `DJANGO_TRUST_X_FORWARDED_PROTO=True` **only** if the proxy sets that
header itself and strips any value sent by the client; otherwise a client
could spoof HTTPS. If the proxy already performs the redirect, you may
instead set `DJANGO_SECURE_SSL_REDIRECT=False`. Session and CSRF cookies stay
secure-only either way. Platform health checks that call `/health/` over
plain HTTP will receive the redirect unless the check uses HTTPS or the
forwarded header.

## Never commit

Real `.env` files (`.env`, `.env.local`, `.env.*.local`) are git-ignored;
only `.env.example` files are tracked, with placeholders only. Never commit
passwords, database URLs with real credentials, Django secret keys, API
keys, JWT or OAuth secrets, or private keys. If one is committed, treat it
as compromised and rotate it — deleting it from a later commit is not enough.

## Secret management

Sensitive values for deployed environments must come from secure secret
management, not files in the repository or on the server: deployment
platform secrets, CI/CD secrets, a cloud secret manager, or environment
variables injected securely by infrastructure. No provider is chosen or
integrated yet; the application only expects the values as environment
variables.
