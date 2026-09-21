# Development Guide

How to set up and run Automation Platform on a developer machine. For what
the system is meant to become, see [`architecture.md`](architecture.md); for
running the checks, see [`testing.md`](testing.md); for branching and pull
requests, see [`git-workflow.md`](git-workflow.md).

The repository is a monorepo with two independent applications, `backend/`
(Django) and `frontend/` (React), that talk to each other over GraphQL. They
are run and configured separately.

## Prerequisites

| Tool | Version | Notes |
| ---- | ------- | ----- |
| Git | any recent | |
| Python | 3.12 | The version CI runs and Ruff targets (`backend/ruff.toml`) |
| PostgreSQL | 16 recommended | A local server. CI runs 16; no minimum is enforced |
| Node.js | 22+ | CI runs 22. Vite 8 requires 20.19+ or 22.12+ |
| npm | bundled with Node | |

## Repository

```bash
git clone https://github.com/MUSTAMIU432/automation-platform.git
cd automation-platform
```

Create your work on a branch off `develop`; see
[`git-workflow.md`](git-workflow.md).

## Backend

All backend commands run from `backend/`.

### 1. Create the PostgreSQL role and database

The backend requires PostgreSQL; there is no SQLite fallback. Create a
project-specific role and database (not the `postgres` superuser) as
described in [`backend/README.md`](../backend/README.md#1-create-the-postgresql-database).
The role needs `CREATEDB` so pytest can create its disposable test database.

### 2. Virtual environment and dependencies

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
```

| File | Contents |
| ---- | -------- |
| `requirements.txt` | Runtime dependencies (Django, `django-environ`, `psycopg`, `strawberry-graphql-django`, `django-cors-headers`), pinned |
| `requirements-dev.txt` | Includes `requirements.txt`, plus pytest, pytest-django, pytest-cov and Ruff. Install this for development |

Use `requirements.txt` alone only where the test and lint tooling is not
wanted.

### 3. Configure the environment

```bash
cp .env.example .env
```

- `backend/.env.example` is the tracked template. It contains placeholders
  only.
- `backend/.env` is your personal, git-ignored copy. Set at least
  `DJANGO_SECRET_KEY` and `DATABASE_URL` (both are required and have no
  default). `DATABASE_URL` uses the form
  `postgres://<user>:<password>@localhost:5432/<database>` and points at the
  database from step 1.
- Real environment variables take precedence over `.env`.

Never commit `.env` or put real credentials in a tracked file. Every
variable is documented in [`environments.md`](environments.md).

### 4. Migrate and run

```bash
python manage.py migrate
python manage.py runserver
```

`DJANGO_SETTINGS_MODULE` defaults to `config.settings.local`, so no extra
setup is needed locally. The server listens on `http://localhost:8000`:

| URL | What it serves |
| --- | -------------- |
| `/health/` | `{"status": "ok"}`, no dependencies |
| `/graphql/` | The GraphQL endpoint (GraphiQL in the browser when `DEBUG` is on) |

To confirm the database is wired up, `python manage.py check` and
`python manage.py migrate` should succeed against PostgreSQL. The GraphQL
schema currently holds only foundation operations (`apiStatus`, `ping`); see
[`backend/README.md`](../backend/README.md#graphql-api).

## Frontend

All frontend commands run from `frontend/`.

```bash
cd frontend
npm ci
cp .env.example .env
```

- `package-lock.json` is committed and is the source of truth for installed
  versions. `npm ci` installs exactly what it records, which is what CI does.
  Use `npm install <package>` only when deliberately adding or updating a
  dependency, and commit the resulting lockfile change.
- `frontend/.env.example` is the tracked template; `frontend/.env` is your
  git-ignored copy. It has a single variable, `VITE_GRAPHQL_URL` (default
  `http://localhost:8000/graphql/`, the local backend).
- Every `VITE_` variable is compiled into the browser bundle and is public.
  Never put secrets in it. See [`environments.md`](environments.md#backend-secrets-vs-frontend-public-configuration).

Start the Vite dev server:

```bash
npm run dev          # http://localhost:5173
```

The backend's local settings already allow `http://localhost:5173` for CORS
and CSRF, so the two run side by side without extra configuration.

Other scripts:

```bash
npm run build        # tsc -b, then vite build; output in dist/
npm run preview      # serve the production build locally
```

Frontend layout and conventions are described in
[`frontend/README.md`](../frontend/README.md).

## Running everything locally

Use two terminals:

```bash
# terminal 1: backend/ (venv active)
python manage.py runserver

# terminal 2: frontend/
npm run dev
```

No Redis, Celery, object storage or AI service is needed; none exists yet
(see [`architecture.md`](architecture.md)).

## Checks before opening a pull request

Run these from the directories shown. They are the same checks CI runs, so a
clean local run should mean a green pull request.

```bash
# backend/ (PostgreSQL running, venv active)
ruff check .
ruff format --check .
python manage.py check
python manage.py makemigrations --check --dry-run
pytest

# frontend/
npm run lint
npm run format:check
npm run typecheck
npm run test:run
npm run build
```

To auto-fix instead of just checking: `ruff format . && ruff check --fix .`
and `npm run format && npm run lint:fix`. What each check covers, and how CI
runs them, is in [`testing.md`](testing.md). There are no pre-commit hooks by
design; these commands are the quality gate.
