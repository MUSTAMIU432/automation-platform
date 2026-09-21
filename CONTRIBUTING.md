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

Testing conventions will be documented once the testing foundation
(Sprint 0, task S0-007) is in place.

## Linting & Formatting

Code quality tooling and commands will be documented once established
(Sprint 0, task S0-008).

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to
`frontend/.env`, then fill in values for your environment. Never commit `.env`
files. See [`docs/environments.md`](docs/environments.md) for the environment
variable strategy.
