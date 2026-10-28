"""
Gunicorn settings for deployed environments.

Gunicorn loads ./gunicorn.conf.py on its own, so the plain start command
(`gunicorn config.wsgi:application`, run from backend/) picks this up with no
flag. It does not set `bind`: Gunicorn's default already listens on $PORT,
which is what the host (Render) provides.
"""

import subprocess
import sys
from pathlib import Path

_MANAGE_PY = Path(__file__).resolve().parent / 'manage.py'


def on_starting(server):
    """Apply database migrations before any worker serves a request.

    A fresh database otherwise has no tables, and every request fails with
    `relation ... does not exist`. Already-applied migrations are skipped, so
    this is a no-op on an up-to-date database. It runs in a separate process
    so no database connection is opened in the master and inherited by the
    forked workers. A failure stops Gunicorn, so the deploy fails visibly
    instead of serving a half-migrated schema.
    """
    server.log.info('Applying database migrations')
    # Fixed interpreter and arguments - no untrusted input.
    subprocess.run(  # noqa: S603
        [sys.executable, str(_MANAGE_PY), 'migrate', '--noinput'], check=True
    )
