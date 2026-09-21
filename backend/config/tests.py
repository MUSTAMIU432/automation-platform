import os
import subprocess
import sys
from pathlib import Path

from django.test import SimpleTestCase

BACKEND_DIR = Path(__file__).resolve().parent.parent

# A syntactically valid, obviously fake configuration. No connection is made:
# these tests only import settings.
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


def load_settings(module, overrides=None):
    """
    Import a settings module in a fresh interpreter and return the result.

    A subprocess is used so settings are evaluated from scratch, and
    backend/.env (which only fills in variables that are *unset*) can't leak
    values into a test: every variable a test cares about is set explicitly,
    with an empty string meaning "effectively unset".
    """
    env = {k: v for k, v in os.environ.items() if not k.startswith(('DJANGO_', 'CORS_', 'CSRF_'))}
    env.pop('ENVIRONMENT', None)
    env.pop('DATABASE_URL', None)
    env.update(VALID_PRODUCTION_ENV)
    env['DJANGO_SETTINGS_MODULE'] = module
    env.update(overrides or {})
    return subprocess.run(
        [sys.executable, '-c', f'import {module}'],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
    )


class ProductionSettingsValidationTests(SimpleTestCase):
    def assertRejected(self, overrides, message):
        result = load_settings('config.settings.production', overrides)
        self.assertNotEqual(result.returncode, 0, 'production settings should have been rejected')
        self.assertIn('ImproperlyConfigured', result.stderr)
        self.assertIn(message, result.stderr)

    def test_valid_configuration_loads(self):
        result = load_settings('config.settings.production')
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_missing_secret_key_is_rejected(self):
        # Blank counts as missing; an actually-absent variable is covered by
        # django-environ raising ImproperlyConfigured in base.py.
        self.assertRejected({'DJANGO_SECRET_KEY': ''}, 'DJANGO_SECRET_KEY')

    def test_placeholder_secret_key_is_rejected(self):
        self.assertRejected({'DJANGO_SECRET_KEY': 'change-me'}, 'DJANGO_SECRET_KEY')
        self.assertRejected({'DJANGO_SECRET_KEY': 'django-insecure-' + 'a' * 60}, 'DJANGO_SECRET_KEY')

    def test_debug_enabled_is_rejected(self):
        self.assertRejected({'DJANGO_DEBUG': 'True'}, 'DJANGO_DEBUG')

    def test_missing_or_wildcard_allowed_hosts_is_rejected(self):
        self.assertRejected({'DJANGO_ALLOWED_HOSTS': ''}, 'DJANGO_ALLOWED_HOSTS')
        self.assertRejected({'DJANGO_ALLOWED_HOSTS': '*'}, 'DJANGO_ALLOWED_HOSTS')

    def test_local_environment_name_is_rejected(self):
        self.assertRejected({'ENVIRONMENT': 'local'}, 'ENVIRONMENT')

    def test_insecure_or_wildcard_origins_are_rejected(self):
        for setting in ('CORS_ALLOWED_ORIGINS', 'CSRF_TRUSTED_ORIGINS'):
            with self.subTest(setting=setting):
                self.assertRejected({setting: 'http://app.example.test'}, setting)
                self.assertRejected({setting: 'https://*.example.test'}, setting)


class LocalSettingsTests(SimpleTestCase):
    def test_local_defaults_allow_vite_dev_server(self):
        result = subprocess.run(
            [
                sys.executable,
                '-c',
                'from config.settings import local as s; '
                'print(s.DEBUG, s.CORS_ALLOWED_ORIGINS, s.CSRF_TRUSTED_ORIGINS)',
            ],
            cwd=BACKEND_DIR,
            env={
                **{k: v for k, v in os.environ.items() if not k.startswith(('DJANGO_', 'CORS_', 'CSRF_'))},
                'DJANGO_SETTINGS_MODULE': 'config.settings.local',
                'DJANGO_SECRET_KEY': 'local-test-key',
                'DATABASE_URL': VALID_PRODUCTION_ENV['DATABASE_URL'],
                'CORS_ALLOWED_ORIGINS': '',
                'CSRF_TRUSTED_ORIGINS': '',
            },
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('http://localhost:5173', result.stdout)
