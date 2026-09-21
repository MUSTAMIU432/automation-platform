# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added — Sprint 0: Foundation

- S0-001: Repository foundation — `frontend/`, `backend/`, `docs/`,
  `infrastructure/`, `scripts/` directory boundaries; `.github/` workflow,
  issue, and PR templates; root `.gitignore`, `.env.example`, `README.md`,
  `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`, and `LICENSE`.
- S0-002: Django backend foundation — bare Django project under
  `backend/config`, environment-driven settings split into
  `base`/`local`/`production` via `django-environ`, SQLite placeholder
  database, and a dependency-free `/health/` endpoint. No business domain
  apps, authentication, PostgreSQL, or GraphQL yet.
- S0-006: Environment configuration — `ENVIRONMENT` convention (local,
  development, staging, production); required `DJANGO_SECRET_KEY` with no
  default; environment-driven CORS (`django-cors-headers`, `/graphql/` only)
  and CSRF trusted origins; fail-fast validation in
  `config.settings.production`; per-app `.env.example` files
  (`backend/`, `frontend/`); `docs/environments.md`.
- S0-007: Testing foundation — backend `pytest` + `pytest-django` +
  `pytest-cov` (`backend/tests/`, `requirements-dev.txt`); frontend Vitest +
  React Testing Library + jsdom with V8 coverage (`test`, `test:run`,
  `test:coverage`); existing GraphQL and settings tests migrated to pytest;
  a blank `DATABASE_URL` now fails at startup.
- S0-008: Code quality foundation — backend Ruff (lint, import sorting,
  format) configured in `backend/ruff.toml`; frontend Oxlint config expanded
  (React hooks, a11y, import, vitest rules; warnings fail CI) plus `oxfmt`
  formatter and `typecheck`/`format`/`format:check`/`lint:fix` scripts;
  existing code made compliant. No pre-commit hooks: local checks (and CI,
  once workflows exist) are the quality gate.
- S0-009: GitHub Actions CI foundation — `.github/workflows/ci.yml` runs
  backend (Ruff, Django checks, migration check, pytest with coverage against
  a PostgreSQL service) and frontend (Oxlint, oxfmt, `tsc`, Vitest, production
  build) jobs on pull requests to and pushes to `develop`/`main`. Read-only
  permissions, no secrets, no deployment.
- S0-010: Documentation foundation — new `docs/development.md`,
  `docs/testing.md` and `docs/git-workflow.md`; `docs/architecture.md`
  current-implementation status and repository structure brought up to date
  (target architecture preserved); `docs/environments.md` documents the CI
  execution context; `README.md` and `CONTRIBUTING.md` corrected for stale
  Sprint 0 statements and linked to the new guides.
