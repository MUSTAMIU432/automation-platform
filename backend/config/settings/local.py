"""
Local development settings.

Used when DJANGO_SETTINGS_MODULE is not overridden — the default for
running the project on a developer machine.
"""

from .base import *  # noqa: F401,F403

DEBUG = True

if not ALLOWED_HOSTS:  # noqa: F405
    ALLOWED_HOSTS = ['localhost', '127.0.0.1']
