# Architecture

This document describes the **target architecture** for Automation
Platform, and calls out clearly what is **currently implemented** versus
what is planned for future sprints. See
[Current Implementation Status](#current-implementation-status) for what
exists today and [`CHANGELOG.md`](../CHANGELOG.md) for what has landed.

Sections headed "target" describe the intended design. Unless a section says
otherwise, they are not implemented.

## Product Flow

The platform turns real-world problems into delivered automation:

```
PROBLEM → IDEA → VALIDATION → AUTOMATION OPPORTUNITY → REQUIREMENTS
→ PROPOSAL → DEVELOPER/TEAM → PROJECT → DEVELOPMENT → TESTING
→ DEPLOYMENT → IMPACT
```

## Target High-Level Architecture

### Frontend (target — foundation implemented)

React + TypeScript + Vite, using React Router, Tailwind CSS, a GraphQL
client, and React Query for non-GraphQL concerns. Organized by feature so
that a future React Native client can reuse backend contracts without a
backend rewrite.

Implemented: the application shell, routing, Tailwind, a shared GraphQL
client, and an error boundary. Not implemented: React Query, feature
modules, and any business UI. See
[Current Implementation Status](#current-implementation-status).

### Backend (target — foundation implemented)

Django, structured as a **modular monolith**: one Django project containing
separate apps per business domain, rather than one large application.
Expected future domains:

- identity
- organizations
- ideas
- reviews
- opportunities
- proposals
- developers
- projects
- tasks
- notifications
- impact
- files
- audit

Implemented: the Django project, split settings, and a `graphql_api`
infrastructure app (not a business domain). No business domain apps exist
yet. They will be introduced incrementally, starting with Identity in
Sprint 1.

### API (target — foundation implemented)

GraphQL is the primary application API. REST is reserved for
infrastructure/specialized operations: file uploads/downloads, webhooks,
health checks, and OAuth callbacks.

Implemented: the `/graphql/` endpoint with a foundation schema and the
`/health/` check. No file, webhook or OAuth endpoints exist.

### Database (target — implemented)

PostgreSQL, configured entirely through environment variables — no
credentials committed to source control. Implemented via `DATABASE_URL`.
There are no business models or migrations of our own yet, only Django's
built-in ones.

### Asynchronous Processing (target — not yet implemented)

Redis + Celery for background jobs (email, notifications, AI processing,
analytics, scheduled tasks). Not present yet.

### AI Architecture (target — not yet implemented)

AI functionality will live behind a dedicated gateway/service abstraction
rather than being scattered across business domain apps, and its output
will be treated as a recommendation subject to human validation. No AI
functionality exists yet.

### Storage (target — not yet implemented)

Object storage (e.g. S3-compatible) for files, rather than storing large
binary content in PostgreSQL. Not present yet.

### Security (target — partly implemented)

Environment-driven secrets, DEBUG/production settings separation,
ALLOWED_HOSTS, CORS/CSRF strategy, security headers, rate-limiting and audit
architecture placeholders. Authentication itself is explicitly out of scope
until Sprint 1 (Identity).

Implemented: environment-driven secrets, the local/production settings
split with fail-fast validation, `ALLOWED_HOSTS`, and CORS/CSRF
configuration. Rate limiting, audit logging and authentication are not
implemented. The rest of the baseline is tracked as S0-011; see
[`SECURITY.md`](../SECURITY.md).

### Multi-Tenancy (target — not yet implemented)

Organization → Department → Membership → User, with resources (Ideas,
Projects, etc.) optionally scoped to an organization for tenant isolation.
Not present yet.

### Environments (target — convention implemented)

LOCAL, DEVELOPMENT, STAGING, PRODUCTION, each configured via environment
variables rather than source-code branching. The configuration convention is
implemented; only a local environment exists, with no deployed
infrastructure. See [`environments.md`](environments.md).

## Current Implementation Status

The repository is in **Sprint 0 — Foundation**. The engineering foundation is
in place; **no business functionality is implemented**, and identity and
authentication begin in Sprint 1.

### Implemented (Sprint 0)

| Area | What exists | Task |
| ---- | ----------- | ---- |
| Repository | Monorepo layout, root docs, `.gitignore`, issue and PR templates | S0-001 |
| Backend | Django 5.2 project (`backend/config`), split settings (`base`, `local`, `production`), `/health/` endpoint | S0-002 |
| Frontend | React 19 + TypeScript + Vite 8, React Router, Tailwind CSS 4, shared GraphQL client, error boundary | S0-003 |
| Database | PostgreSQL via `DATABASE_URL` (`psycopg`); no SQLite fallback | S0-004 |
| GraphQL | `/graphql/` via Strawberry Django with a foundation schema (`apiStatus` query, `ping` mutation) | S0-005 |
| Environment configuration | `ENVIRONMENT` convention, per-app `.env.example`, fail-fast production validation, CORS/CSRF settings | S0-006 |
| Testing | Backend pytest + pytest-django + pytest-cov; frontend Vitest + React Testing Library | S0-007 |
| Code quality | Backend Ruff; frontend Oxlint, oxfmt and TypeScript checking | S0-008 |
| CI | GitHub Actions workflow validating backend and frontend on pull requests and pushes to `develop`/`main`; no deployment | S0-009 |
| Documentation | Development, testing, Git workflow and environment guides | S0-010 |

How these are used day to day: [`development.md`](development.md),
[`testing.md`](testing.md), [`git-workflow.md`](git-workflow.md).

### Not implemented (planned)

- Business domain apps: identity, organizations, ideas, reviews,
  opportunities, proposals, developers, projects, tasks, notifications,
  impact, files, audit
- Authentication and authorization (Sprint 1)
- Multi-tenancy (organizations, departments, memberships)
- Redis + Celery background processing
- AI gateway
- Object storage
- Rate limiting and audit logging
- React Query and feature modules in the frontend
- Deployment automation and any deployed environment (development, staging,
  production)

## Repository Structure

```
automation-platform/
├── backend/                  # Django project
│   ├── config/               # settings (base/local/production), urls, health view, wsgi/asgi
│   ├── graphql_api/          # GraphQL infrastructure (not a business domain)
│   ├── tests/                # pytest suite
│   ├── manage.py
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   ├── pytest.ini
│   ├── ruff.toml
│   ├── .coveragerc
│   └── .env.example
├── frontend/                 # React + TypeScript + Vite app
│   ├── src/                  # app, components, graphql, layouts, lib, routes, test, types
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.ts        # Vite and Vitest configuration
│   ├── .oxlintrc.json
│   ├── .oxfmtrc.json
│   └── .env.example
├── docs/
│   ├── architecture.md
│   ├── environments.md
│   ├── development.md
│   ├── testing.md
│   └── git-workflow.md
├── infrastructure/           # Placeholder: no infrastructure implemented yet
├── scripts/                  # Placeholder: no scripts yet
├── .github/
│   ├── workflows/ci.yml      # CI (validation only)
│   ├── ISSUE_TEMPLATE/
│   └── PULL_REQUEST_TEMPLATE.md
├── .env.example              # index pointing at the per-app templates
├── .gitignore
├── README.md
├── CONTRIBUTING.md
├── SECURITY.md
├── CHANGELOG.md
└── LICENSE
```
