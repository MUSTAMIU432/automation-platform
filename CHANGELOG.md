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
