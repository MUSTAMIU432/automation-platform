"""
Settings validation.

Each case imports a settings module in a fresh interpreter so the module is
evaluated from scratch, and so backend/.env (which only fills in variables
that are *unset*) can't leak into a test. No database connection is made.
"""

import os
import subprocess
import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent

# A syntactically valid, obviously fake production configuration.
VALID_PRODUCTION_ENV = {
    'DJANGO_SETTINGS_MODULE': 'config.settings.production',
    'ENVIRONMENT': 'staging',
    'DJANGO_SECRET_KEY': 'x7Kp2mQ9vL4nR8tW1yB6cD3fG5hJ0sZaE2uI4oP7qA9wX1eV3b',
    'DJANGO_DEBUG': 'False',
    'DJANGO_ALLOWED_HOSTS': 'api.example.test',
    'DATABASE_URL': 'postgres://app_user:app-password@db.example.test:5432/app',
    'CORS_ALLOWED_ORIGINS': 'https://app.example.test',
    'CSRF_TRUSTED_ORIGINS': 'https://app.example.test',
}


def import_settings(module, overrides=None, code=None):
    """Import `module` in a clean subprocess. An empty override means "unset"."""
    env = {k: v for k, v in os.environ.items() if not k.startswith(('DJANGO_', 'CORS_', 'CSRF_'))}
    env.pop('ENVIRONMENT', None)
    env.pop('DATABASE_URL', None)
    env.update(VALID_PRODUCTION_ENV)
    env['DJANGO_SETTINGS_MODULE'] = module
    env.update(overrides or {})
    # Fixed interpreter and a code string built by the tests themselves - no untrusted input.
    return subprocess.run(  # noqa: S603
        [sys.executable, '-c', code or f'import {module}'],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
    )


def assert_rejected(overrides, message):
    result = import_settings('config.settings.production', overrides)
    assert result.returncode != 0, 'production settings should have been rejected'
    assert 'ImproperlyConfigured' in result.stderr
    assert message in result.stderr


def test_valid_production_configuration_loads():
    result = import_settings('config.settings.production')

    assert result.returncode == 0, result.stderr


def test_missing_secret_key_is_rejected():
    # Blank counts as missing; an absent variable is rejected by django-environ.
    assert_rejected({'DJANGO_SECRET_KEY': ''}, 'DJANGO_SECRET_KEY')


@pytest.mark.parametrize('secret', ['change-me', 'django-insecure-' + 'a' * 60, 'short'])
def test_placeholder_or_short_secret_key_is_rejected(secret):
    assert_rejected({'DJANGO_SECRET_KEY': secret}, 'DJANGO_SECRET_KEY')


def test_debug_enabled_is_rejected():
    assert_rejected({'DJANGO_DEBUG': 'True'}, 'DJANGO_DEBUG')


@pytest.mark.parametrize('hosts', ['', '*'])
def test_missing_or_wildcard_allowed_hosts_is_rejected(hosts):
    assert_rejected({'DJANGO_ALLOWED_HOSTS': hosts}, 'DJANGO_ALLOWED_HOSTS')


def test_local_environment_name_is_rejected_in_production_settings():
    assert_rejected({'ENVIRONMENT': 'local'}, 'ENVIRONMENT')


@pytest.mark.parametrize('setting', ['CORS_ALLOWED_ORIGINS', 'CSRF_TRUSTED_ORIGINS'])
@pytest.mark.parametrize('origin', ['http://app.example.test', 'https://*.example.test'])
def test_insecure_or_wildcard_origins_are_rejected(setting, origin):
    assert_rejected({setting: origin}, setting)


def test_missing_database_url_is_rejected():
    result = import_settings('config.settings.production', {'DATABASE_URL': ''})

    assert result.returncode != 0
    assert 'DATABASE_URL' in result.stderr


def test_local_defaults_allow_vite_dev_server():
    result = import_settings(
        'config.settings.local',
        {
            'DJANGO_SETTINGS_MODULE': 'config.settings.local',
            'DJANGO_SECRET_KEY': 'local-test-key',
            'CORS_ALLOWED_ORIGINS': '',
            'CSRF_TRUSTED_ORIGINS': '',
        },
        code=(
            'from config.settings import local as s; '
            'print(s.CORS_ALLOWED_ORIGINS, s.CSRF_TRUSTED_ORIGINS)'
        ),
    )

    assert result.returncode == 0, result.stderr
    assert 'http://localhost:5173' in result.stdout
