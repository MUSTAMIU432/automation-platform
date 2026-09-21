# Backend

Django backend, organized as a modular monolith around business domains
(identity, organizations, ideas, reviews, opportunities, proposals,
developers, projects, tasks, notifications, impact, files, audit).

**Status:** Sprint 0, task S0-005 (GraphQL API Foundation) — a bare Django
project with environment-driven settings, a PostgreSQL database (S0-004),
and a foundation GraphQL endpoint. No business domain apps or
authentication yet; those land in later sprints.

See [`/docs/architecture.md`](../docs/architecture.md) for the target
backend architecture.

## Layout

```
backend/
├── manage.py
├── requirements.txt
├── config/
│   ├── settings/
│   │   ├── base.py         # shared settings, reads from environment
│   │   ├── local.py        # development defaults (DEBUG, Vite CORS/CSRF origins)
│   │   └── production.py   # deployed envs: validates config, secure defaults
│   ├── urls.py             # mounts /health/ and /graphql/
│   ├── views.py            # health check
│   ├── tests.py            # settings validation tests
│   ├── wsgi.py
│   └── asgi.py
└── graphql_api/            # GraphQL infrastructure (not a business domain)
    ├── apps.py
    ├── schema.py           # root Query/Mutation
    ├── views.py            # Strawberry Django view, mounted at /graphql/
    └── tests.py
```

## Setup

### 1. Create the PostgreSQL database

Requires a running local PostgreSQL server. Create a project-specific
role and database (do not use the `postgres` superuser role for the
app):

```bash
sudo -u postgres psql <<'EOF'
CREATE USER automation_platform WITH PASSWORD 'change-me';
CREATE DATABASE automation_platform_dev OWNER automation_platform;
\c automation_platform_dev
GRANT ALL ON SCHEMA public TO automation_platform;
EOF
```

Pick your own password and use it in `DATABASE_URL` below — never commit
a real password.

### 2. Configure the backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # set DJANGO_SECRET_KEY, DATABASE_URL and other values
python manage.py migrate
python manage.py runserver
```

`DJANGO_SETTINGS_MODULE` defaults to `config.settings.local`. Deployed
environments (development, staging, production) set it to
`config.settings.production`, which refuses to start on missing or unsafe
configuration. See [`/docs/environments.md`](../docs/environments.md) for
every variable and the environment conventions.

`DJANGO_SECRET_KEY` and `DATABASE_URL` (in `backend/.env`) are required and
have no defaults. `DATABASE_URL` must point at the database created above,
e.g.:

```
DATABASE_URL=postgres://automation_platform:<your-password>@localhost:5432/automation_platform_dev
```

### 3. Verify the connection

```bash
python manage.py check
python manage.py migrate
```

`python manage.py migrate` succeeding against PostgreSQL (rather than
failing to connect, or silently using SQLite) confirms the database is
wired up correctly. You can also confirm the active backend directly:

```bash
python manage.py shell -c "from django.db import connection; print(connection.vendor)"
# postgresql
```

## Health check

`GET /health/` returns `{"status": "ok"}` with no auth and no
dependencies, for CI and deploy tooling.

## GraphQL API

GraphQL is the primary application API; REST is reserved for
specialized/infrastructure operations (file uploads, webhooks, health
checks, OAuth callbacks). See [`/docs/architecture.md`](../docs/architecture.md).

**Endpoint:** `POST /graphql/` (a GraphiQL IDE is also served there in
development, when `DEBUG=True`).

**Foundation schema only:** `graphql_api/schema.py` currently exposes:

- `Query.apiStatus` — returns `{ status, version, djangoVersion }`, proving
  the GraphQL layer resolves end to end.
- `Mutation.ping(message)` — echoes its input, proving the mutation root
  resolves.

Neither is business-domain functionality. Business-domain schemas
(identity, organizations, ideas, ...) will be added as their own Django
apps in later sprints and merged into this root `Query`/`Mutation`, not
built into separate schema instances.

Built with [Strawberry](https://strawberry.rocks/) (`strawberry-graphql-django`),
a code-first, type-hint-driven GraphQL library.

Example query:

```bash
curl -X POST http://localhost:8000/graphql/ \
  -H "Content-Type: application/json" \
  -d '{"query": "{ apiStatus { status version djangoVersion } }"}'
```
