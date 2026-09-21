"""
Settings validation.

Each case imports a settings module in a fresh interpreter so the module is
evaluated from scratch, and so backend/.env (which only fills in variables
that are *unset*) can't leak into a test. No database connection is made.
"""

import pytest

from .settings_helpers import import_settings


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
            'ENVIRONMENT': 'local',
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
