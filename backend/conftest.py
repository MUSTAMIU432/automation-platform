"""
Project-wide pytest fixtures.

Kept minimal and infrastructural - fixtures specific to one app's tests
belong in that app's own tests, not here.
"""

import pytest
from django.core.cache import caches


@pytest.fixture(autouse=True)
def _clear_cache():
    """
    Isolate Django's cache framework between tests.

    Unlike the database (which pytest-django wraps in a rolled-back
    transaction per test), Django's caches are not reset automatically -
    anything a test's code path writes to one (e.g. `identity.google_oauth`'s
    Google ID token replay-protection records, or `identity.throttling`'s
    rate-limit counters) would otherwise leak into every later test in the
    same run, especially ones reusing the same literal token or email as a
    test fixture.

    Every alias is cleared, not just `default`: the security-critical
    `replay_protection` alias (see config/settings/base.py) is exactly the one
    where a leaked record would silently fail a test.
    """
    for cache in caches.all():
        cache.clear()
    yield
    for cache in caches.all():
        cache.clear()


@pytest.fixture(autouse=True)
def _fast_password_hasher(settings):
    """
    Use a cheap password hasher in tests.

    Django's default PBKDF2 hasher runs ~1M iterations per hash, and every
    user a test creates or logs in pays for it - enough to leave the suite
    CPU-bound for 20+ minutes. Production hashing is unaffected; a test that
    asserts on the real hasher overrides this through the same `settings`
    fixture.
    """
    settings.PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']


@pytest.fixture(autouse=True)
def _local_file_storage(settings, tmp_path):
    """
    Keep every test's uploaded files in its own temporary directory.

    A developer's backend/.env may hold real R2 credentials, which switch the
    `default` and `attachments` storages to the bucket (config/settings/base.py).
    Without this, a test that uploads without choosing its own storage would
    write to that bucket. Tests that exercise R2 replace this with an
    in-process fake (ideas/tests/test_r2_storage.py).
    """
    local = {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
        'OPTIONS': {'location': str(tmp_path)},
    }
    settings.STORAGES = {**settings.STORAGES, 'default': local, 'attachments': local}
