# Backend

Django backend, organized as a modular monolith around business domains
(identity, organizations, ideas, reviews, opportunities, proposals,
developers, projects, tasks, notifications, impact, files, audit).

**Status:** Sprint 0, task S0-002 (Django Backend Foundation) — a bare
Django project with environment-driven settings. No business domain apps,
authentication, database, or GraphQL yet; those land in later sprints.

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

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example ../.env   # edit as needed
python manage.py migrate
python manage.py runserver
```

`DJANGO_SETTINGS_MODULE` defaults to `config.settings.local`. For
production, set it to `config.settings.production` and provide
`DJANGO_SECRET_KEY` and `DJANGO_ALLOWED_HOSTS` via the environment.

## Health check

`GET /health/` returns `{"status": "ok"}` with no auth and no
dependencies, for CI and deploy tooling.
