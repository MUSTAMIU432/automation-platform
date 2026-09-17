# Backend

Django backend, organized as a modular monolith around business domains
(identity, organizations, ideas, reviews, opportunities, proposals,
developers, projects, tasks, notifications, impact, files, audit).

**Status:** Sprint 0, task S0-004 (PostgreSQL Database Foundation) — a
bare Django project with environment-driven settings and a PostgreSQL
database. No business domain apps, authentication, or GraphQL yet; those
land in later sprints.

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
│   │   ├── local.py        # development defaults (DEBUG=True)
│   │   └── production.py   # production overrides
│   ├── urls.py
│   ├── views.py            # health check
│   ├── wsgi.py
│   └── asgi.py
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
cp ../.env.example .env   # edit DATABASE_URL and other values as needed
python manage.py migrate
python manage.py runserver
```

`DJANGO_SETTINGS_MODULE` defaults to `config.settings.local`. For
production, set it to `config.settings.production` and provide
`DJANGO_SECRET_KEY` and `DJANGO_ALLOWED_HOSTS` via the environment.

`DATABASE_URL` (in `backend/.env`) is required and must point at the
database created above, e.g.:

```
DATABASE_URL=postgres://automation_platform:change-me@localhost:5432/automation_platform_dev
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
