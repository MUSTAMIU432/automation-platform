"""
Production-grade settings.

Selected explicitly via DJANGO_SETTINGS_MODULE=config.settings.production and
used by every deployed environment (development, staging, production) so that
shared environments get the same security posture as production. The
environment is named by ENVIRONMENT.

All security-sensitive values must come from the environment — nothing here
should hardcode a secret or a permissive default. Missing or unsafe
configuration fails at startup with ImproperlyConfigured.
"""

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F403
from .base import (
    ALLOWED_HOSTS,
    CORS_ALLOWED_ORIGINS,
    CSRF_TRUSTED_ORIGINS,
    ENVIRONMENT,
    SECRET_KEY,
    env,
)

DEPLOYED_ENVIRONMENTS = ('development', 'staging', 'production')

_PLACEHOLDER_SECRET_MARKERS = ('change-me', 'changeme', 'django-insecure')
# Matches Django's own `check --deploy` threshold.
_MIN_SECRET_KEY_LENGTH = 50


if ENVIRONMENT not in DEPLOYED_ENVIRONMENTS:
    raise ImproperlyConfigured(
        f'ENVIRONMENT must be one of {", ".join(DEPLOYED_ENVIRONMENTS)} when using '
        f'config.settings.production (got {ENVIRONMENT!r}). Use config.settings.local '
        'for local development.'
    )

if len(SECRET_KEY) < _MIN_SECRET_KEY_LENGTH or any(
    marker in SECRET_KEY.lower() for marker in _PLACEHOLDER_SECRET_MARKERS
):
    raise ImproperlyConfigured(
        'DJANGO_SECRET_KEY must be a real, unique secret of at least '
        f'{_MIN_SECRET_KEY_LENGTH} characters, not a placeholder.'
    )

if env.bool('DJANGO_DEBUG', default=False):
    raise ImproperlyConfigured('DJANGO_DEBUG must not be enabled in a deployed environment.')

DEBUG = False

if not ALLOWED_HOSTS or '*' in ALLOWED_HOSTS:
    raise ImproperlyConfigured(
        'DJANGO_ALLOWED_HOSTS must list explicit hostnames (no wildcard) in a deployed environment.'
    )

for _setting_name, _origins in (
    ('CORS_ALLOWED_ORIGINS', CORS_ALLOWED_ORIGINS),
    ('CSRF_TRUSTED_ORIGINS', CSRF_TRUSTED_ORIGINS),
):
    for _origin in _origins:
        if '*' in _origin or not _origin.startswith('https://'):
            raise ImproperlyConfigured(
                f'{_setting_name} entries must be explicit https:// origins '
                f'without wildcards (got {_origin!r}).'
            )

SECURE_SSL_REDIRECT = env.bool('DJANGO_SECURE_SSL_REDIRECT', default=True)
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# Keep database connections open between requests (seconds).
DATABASES['default']['CONN_MAX_AGE'] = env.int('DATABASE_CONN_MAX_AGE', default=60)  # noqa: F405
DATABASES['default']['CONN_HEALTH_CHECKS'] = DATABASES['default']['CONN_MAX_AGE'] > 0  # noqa: F405
