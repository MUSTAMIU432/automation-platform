# Contributing

## Project Status

This repository is in early foundation stages (Sprint 0). Expect the setup
instructions in this document to expand as the backend and frontend
foundations land.

## Git Workflow

Branch flow:

```
feature/<domain>  →  PR  →  develop  →  staging  →  main  →  production
```

- Create feature/domain branches off `develop` (e.g.
  `feature/identity`, `chore/sprint-0-foundation`).
- Open a pull request into `develop` using the PR template.
- `main` represents production-ready code. Do not commit directly to
  `main` or `develop`.
- Keep PRs scoped to a single task where possible.

## Commit Messages

Use clear, descriptive commit messages that explain *why* a change was
made, not just what changed.

## Local Setup

Not yet available — the backend and frontend have not been scaffolded.
This section will be filled in as Sprint 0 tasks S0-002 (backend) and
S0-003 (frontend) are completed.

## Testing

Tests must pass locally before a PR is opened and before it is merged.

```bash
# Backend (PostgreSQL must be running; see backend/README.md)
cd backend && pip install -r requirements-dev.txt
pytest                # add --cov for coverage

# Frontend
cd frontend
npm run test:run      # non-interactive; `npm run test` watches
npm run test:coverage
```

Where tests belong:

| Kind | Location |
| ---- | -------- |
| Backend unit tests | `backend/tests/test_*.py` (pytest functions, no DB unless needed) |
| Backend integration tests (database, HTTP) | `backend/tests/`, using the `db` / `client` fixtures |
| GraphQL tests | `backend/tests/test_graphql.py`, through the real `/graphql/` endpoint |
| Frontend component tests | beside the component: `Foo.test.tsx` |
| Frontend utility / client tests | beside the module: `env.test.ts` |
| End-to-end tests | not set up yet; reserved for a later sprint |

Do not add models or fixtures only to have something to test. See
[`backend/README.md`](backend/README.md#testing) and
[`frontend/README.md`](frontend/README.md#testing) for details.

## Linting & Formatting

One tool per concern: **Ruff** for Python (lint, import sorting, format) and
**Oxlint + oxfmt** for the frontend, plus the TypeScript compiler for type
checking. Configuration lives in `backend/ruff.toml`,
`frontend/.oxlintrc.json` and `frontend/.oxfmtrc.json`.

```bash
# Backend (from backend/, venv active)
ruff check .              # lint (add --fix for safe auto-fixes)
ruff format --check .     # formatting check
ruff format .             # apply formatting

# Frontend (from frontend/)
npm run lint              # Oxlint; warnings fail the run
npm run typecheck         # tsc -b
npm run format:check      # formatting check
npm run format            # apply formatting
```

Recommended workflow: while working, run the formatter and the fast linters
(`ruff format . && ruff check --fix .`, `npm run format && npm run lint:fix`);
before opening a PR, run every check below.

**Required before merge:** all checks pass locally and in CI — lint, format
check, type check, tests, and the frontend build:

```bash
# backend/
ruff check . && ruff format --check . && python manage.py check && pytest
# frontend/
npm run lint && npm run typecheck && npm run format:check && npm run test:run && npm run build
```

## Continuous Integration

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every pull
request targeting `develop` or `main`, and on every push to those branches. It
is validation only: nothing is deployed and no secrets are needed. A PR should
not be merged until both jobs are green.

| Job | Runs (in `backend/` or `frontend/`) |
| --- | ----------------------------------- |
| Backend (Python 3.12, PostgreSQL 16 service) | `ruff check .`, `ruff format --check .`, `python manage.py check`, `python manage.py makemigrations --check --dry-run`, `python manage.py migrate`, `pytest --cov` |
| Frontend (Node.js 22) | `npm ci`, `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run test:run`, `npm run build` |

To reproduce a run locally, use the commands above, plus the missing-migrations
check the backend job adds:

```bash
# backend/ (PostgreSQL running, venv active)
python manage.py makemigrations --check --dry-run
```

CI uses throwaway, non-secret values for `DJANGO_SECRET_KEY`, `DATABASE_URL`
and the other backend variables; they live in the workflow file. Keep new
required settings covered there rather than adding repository secrets.

Fix the code rather than disabling a rule. If a suppression is genuinely
justified (`# noqa: <code>`, `// oxlint-disable-next-line <rule>`), scope it to
one line and say why. There are no pre-commit hooks by design; these
commands are the quality gate.

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to
`frontend/.env`, then fill in values for your environment. Never commit `.env`
files. See [`docs/environments.md`](docs/environments.md) for the environment
variable strategy.
