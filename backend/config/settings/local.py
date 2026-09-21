"""
Local development settings.

Used when DJANGO_SETTINGS_MODULE is not overridden — the default for
running the project on a developer machine.
"""

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F403
from .base import ENVIRONMENT, env

# These settings are permissive by design (debug on by default, localhost
# origins). They serve a developer machine and CI only, so a deployed
# environment name here means production.py was forgotten - refuse to start.
_LOCAL_ENVIRONMENTS = ('local', 'ci')

if ENVIRONMENT not in _LOCAL_ENVIRONMENTS:
    raise ImproperlyConfigured(
        f'ENVIRONMENT {ENVIRONMENT!r} must not use config.settings.local, which is only '
        f'for {" and ".join(_LOCAL_ENVIRONMENTS)}. Deployed environments must set '
        'DJANGO_SETTINGS_MODULE=config.settings.production.'
    )

DEBUG = env.bool('DJANGO_DEBUG', default=True)

if not ALLOWED_HOSTS:  # noqa: F405
    ALLOWED_HOSTS = ['localhost', '127.0.0.1']

# The Vite dev server (frontend/) runs on :5173 and calls this API.
_LOCAL_FRONTEND_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173']

if not CORS_ALLOWED_ORIGINS:  # noqa: F405
    CORS_ALLOWED_ORIGINS = _LOCAL_FRONTEND_ORIGINS

if not CSRF_TRUSTED_ORIGINS:  # noqa: F405
    CSRF_TRUSTED_ORIGINS = _LOCAL_FRONTEND_ORIGINS
