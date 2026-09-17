# Architecture

This document describes the **target architecture** for Automation
Platform, and calls out clearly what is **currently implemented** versus
what is planned for future sprints. See [`CHANGELOG.md`](../CHANGELOG.md)
for what has actually landed.

## Product Flow

The platform turns real-world problems into delivered automation:

```
PROBLEM → IDEA → VALIDATION → AUTOMATION OPPORTUNITY → REQUIREMENTS
→ PROPOSAL → DEVELOPER/TEAM → PROJECT → DEVELOPMENT → TESTING
→ DEPLOYMENT → IMPACT
```

## Target High-Level Architecture

### Frontend (target — not yet implemented)

React + TypeScript + Vite, using React Router, Tailwind CSS, a GraphQL
client, and React Query for non-GraphQL concerns. Organized by feature so
that a future React Native client can reuse backend contracts without a
backend rewrite.

### Backend (target — not yet implemented)

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

No business domain apps exist yet. They will be introduced incrementally,
starting with Identity in Sprint 1.

### API (target)

GraphQL is the primary application API. REST is reserved for
infrastructure/specialized operations: file uploads/downloads, webhooks,
health checks, and OAuth callbacks.

### Database (target)

PostgreSQL, configured entirely through environment variables — no
credentials committed to source control.

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

### Security (target)

Environment-driven secrets, DEBUG/production settings separation,
ALLOWED_HOSTS, CORS/CSRF strategy, security headers, rate-limiting and audit
architecture placeholders. Authentication itself is explicitly out of scope
until Sprint 1 (Identity).

### Multi-Tenancy (target — not yet implemented)

Organization → Department → Membership → User, with resources (Ideas,
Projects, etc.) optionally scoped to an organization for tenant isolation.
Not present yet.

### Environments (target)

LOCAL, DEVELOPMENT, STAGING, PRODUCTION, each configured via environment
variables rather than source-code branching.

## Current Implementation Status

As of this commit, the repository contains **only the repository
foundation** (Sprint 0, task S0-001):

- Top-level directory boundaries (`frontend/`, `backend/`, `docs/`,
  `infrastructure/`, `scripts/`, `.github/`)
- Root documentation (`README.md`, `CONTRIBUTING.md`, `SECURITY.md`,
  `CHANGELOG.md`, `LICENSE`)
- `.gitignore` and `.env.example` scaffolding
- GitHub issue/PR templates

No Django project, no React app, no database connection, no GraphQL
endpoint, and no CI workflows exist yet. These are tracked as subsequent
Sprint 0 tasks (S0-002 through S0-012) and will be documented here as they
land.

## Repository Structure

```
automation-platform/
├── frontend/          # React app (not yet scaffolded)
├── backend/           # Django project (not yet scaffolded)
├── docs/              # Documentation
├── infrastructure/    # IaC / deployment config (empty placeholder)
├── scripts/           # Developer utility scripts (empty placeholder)
├── .github/
│   ├── workflows/            # CI/CD (not yet implemented)
│   ├── ISSUE_TEMPLATE/
│   └── PULL_REQUEST_TEMPLATE.md
├── .env.example
├── .gitignore
├── README.md
├── CONTRIBUTING.md
├── SECURITY.md
├── CHANGELOG.md
└── LICENSE
```
