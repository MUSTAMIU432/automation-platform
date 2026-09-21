# Environment Configuration

The same code runs in every environment. Only configuration changes:

```
CODE → ENVIRONMENT VARIABLES → ENVIRONMENT-SPECIFIC SETTINGS → APPLICATION
```

## Environments

| Environment   | Purpose                                                    | Django settings module         | `ENVIRONMENT` |
| ------------- | ---------------------------------------------------------- | ------------------------------ | ------------- |
| `local`       | Developer machine: development, debugging, local PostgreSQL and React | `config.settings.local` (default) | `local`       |
| `development` | Shared dev environment: integration, developer testing, CI validation | `config.settings.production`   | `development` |
| `staging`     | Production-like: QA, UAT, release validation               | `config.settings.production`   | `staging`     |
| `production`  | Live: real users and data, strict security, no debug       | `config.settings.production`   | `production`  |

Only `local` has a dedicated settings module. Every deployed environment
uses `config.settings.production`, so shared environments get the same
security posture as production; `ENVIRONMENT` just names which one it is.
No infrastructure for development, staging or production exists yet — this
is the configuration convention they will follow.

Settings layout (`backend/config/settings/`):

- `base.py` — common settings, all read from the environment
- `local.py` — debug on, localhost defaults, Vite dev-server CORS/CSRF origins
- `production.py` — validates configuration and enables secure defaults;
  **refuses to start** (`ImproperlyConfigured`) if any of these hold:
  `ENVIRONMENT` isn't development/staging/production, the secret key is
  missing, a placeholder, or under 50 characters, `DJANGO_DEBUG` is true,
  `DJANGO_ALLOWED_HOSTS` is empty or `*`, or a CORS/CSRF origin is not an
  explicit `https://` origin.

## Backend variables (`backend/.env`)

Template: [`backend/.env.example`](../backend/.env.example).

| Variable                     | Secret | Required          | Purpose |
| ---------------------------- | :----: | ----------------- | ------- |
| `ENVIRONMENT`                |        | no (`local`)      | Environment name (see table above) |
| `DJANGO_SECRET_KEY`          | **yes**| **always**        | Django signing key. No default |
| `DJANGO_DEBUG`               |        | no                | Default `True` locally; rejected if true when deployed |
| `DJANGO_ALLOWED_HOSTS`       |        | deployed          | Comma-separated hostnames |
| `DATABASE_URL`               | **yes**| **always**        | PostgreSQL URL including the password. No default |
| `DATABASE_CONN_MAX_AGE`      |        | no                | Connection lifetime in seconds (0 local, 60 deployed) |
| `CORS_ALLOWED_ORIGINS`       |        | deployed          | Browser origins allowed to call `/graphql/`. Local defaults to `http://localhost:5173` |
| `CSRF_TRUSTED_ORIGINS`       |        | deployed          | Origins trusted for CSRF-protected requests. Local defaults to `http://localhost:5173` |
| `DJANGO_SECURE_SSL_REDIRECT` |        | no (`True`)       | HTTP→HTTPS redirect (deployed only) |

Notes:

- Real environment variables override `backend/.env`. Deployed
  environments should not use a `.env` file at all.
- CORS applies only to `/graphql/`. The GraphQL endpoint is CSRF-exempt until
  authentication exists, so `CSRF_TRUSTED_ORIGINS` currently affects only
  Django's own forms (e.g. admin).
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
PostgreSQL role and database.

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
- `SECURE_HSTS_SECONDS` is not set yet (`check --deploy` warns about it).
  Enable it deliberately once HTTPS is confirmed on the real domains, since
  browsers cache the policy.

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
