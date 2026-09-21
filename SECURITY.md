# Security Policy

## Project Status

This repository is in early foundation stages (Sprint 0). Authentication
and authorization (Identity) are not yet implemented — they are planned for
Sprint 1. This document will be expanded as the security baseline
(Sprint 0, task S0-011) and Identity (Sprint 1) are implemented.

## Reporting a Vulnerability

If you discover a security vulnerability, please report it privately
rather than opening a public issue. Contact the repository maintainer
directly (see the GitHub organization/repository owner) with:

- A description of the vulnerability
- Steps to reproduce
- Potential impact

Please allow reasonable time for a response and fix before public
disclosure.

## Current Security Posture

- No secrets or credentials are committed to this repository.
- Environment-specific configuration is provided via `.env` files, which
  are excluded from Git (see `.gitignore`) and documented via
  `.env.example`. Deployed environments take secrets from secret
  management, and refuse to start on missing or unsafe configuration
  (see [`docs/environments.md`](docs/environments.md)).
- No authentication system exists yet, so there is no login/session
  surface to secure at this stage.

## Planned Security Baseline (Sprint 0, S0-011)

- DEBUG/production settings separation
- `ALLOWED_HOSTS` configuration
- CORS and CSRF strategy
- Security headers
- Rate-limiting architecture
- Audit-logging architecture

## Planned Authentication (Sprint 1)

Identity (registration, login, sessions/tokens, password reset, roles and
permissions) is explicitly out of scope until Sprint 1.
