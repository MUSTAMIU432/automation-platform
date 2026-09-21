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

Code quality tooling and commands will be documented once established
(Sprint 0, task S0-008).

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to
`frontend/.env`, then fill in values for your environment. Never commit `.env`
files. See [`docs/environments.md`](docs/environments.md) for the environment
variable strategy.
