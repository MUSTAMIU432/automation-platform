"""
Project-wide pytest fixtures.

Kept minimal and infrastructural - fixtures specific to one app's tests
belong in that app's own tests, not here.
"""

import pytest
from django.core.cache import cache


@pytest.fixture(autouse=True)
def _clear_cache():
    """
    Isolate Django's cache framework between tests.

    Unlike the database (which pytest-django wraps in a rolled-back
    transaction per test), Django's cache is not reset automatically -
    anything a test's code path writes to it (e.g.
    `identity.google_oauth`'s Google ID token replay-protection record)
    would otherwise leak into every later test in the same run, especially
    ones reusing the same literal token string as a test fixture.
    """
    cache.clear()
    yield
    cache.clear()
