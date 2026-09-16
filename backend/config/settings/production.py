"""
Production settings.

Selected explicitly via DJANGO_SETTINGS_MODULE=config.settings.production.
All security-sensitive values must come from the environment — nothing
here should hardcode a secret or a permissive default.
"""

from .base import *  # noqa: F401,F403
from .base import env

DEBUG = False

if not ALLOWED_HOSTS:  # noqa: F405
    raise ValueError('DJANGO_ALLOWED_HOSTS must be set in production')

SECURE_SSL_REDIRECT = env.bool('DJANGO_SECURE_SSL_REDIRECT', default=True)
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
