"""
Gunicorn settings for deployed environments.

Gunicorn loads ./gunicorn.conf.py on its own, so the plain start command
(`gunicorn config.wsgi:application`, run from backend/) picks this up with no
flag. It does not set `bind`: Gunicorn's default already listens on $PORT,
which is what the host (Render) provides.

On every start, the Python course is loaded and published if it is not loaded
yet (`seed_python_course --publish`), so a new deployment has the course a
local setup has without anyone running a command. Once loaded it is never
changed. Set `SEED_PYTHON_COURSE=false` to skip it.

On every start, lessons that have a PDF but no notes get notes made from it
(`write_pdf_lesson_notes`), alongside the server rather than before it. Set
`WRITE_PDF_LESSON_NOTES=false` to skip that.
"""

import os
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

    if _switched_on('SEED_PYTHON_COURSE'):
        _seed_python_course(server)
    if _switched_on('WRITE_PDF_LESSON_NOTES'):
        _write_pdf_lesson_notes(server)


def _switched_on(name: str) -> bool:
    """A start-up step that runs unless its variable says `false` (or `0`, `no`)."""
    return os.environ.get(name, '').strip().lower() not in {'0', 'false', 'no', 'off'}


def _write_pdf_lesson_notes(server):
    """Start filling PDF lessons that have no notes, without waiting for it.

    Reading many PDFs can take a while; the site starts serving meanwhile. Lessons
    with notes are never touched, so once done this finds nothing to do.
    """
    server.log.info('Writing notes for PDF lessons that have none, in the background')
    # Fixed interpreter and arguments - no untrusted input.
    subprocess.Popen(  # noqa: S603
        [sys.executable, str(_MANAGE_PY), 'write_pdf_lesson_notes']
    )


def _seed_python_course(server):
    """Load "Python Programming: Beginner to Advanced" and publish it, if it is not loaded.

    Safe on every start: once the course exists, administrators own it and the
    command changes nothing (not its content, and not its status - a course an
    administrator unpublished stays unpublished). A failure is logged and does
    not stop the site: the catalog is then empty, but sign-in and everything
    else still work.
    """
    server.log.info('Loading the Python course if it is not loaded yet')
    # Fixed interpreter and arguments - no untrusted input.
    result = subprocess.run(  # noqa: S603
        [sys.executable, str(_MANAGE_PY), 'seed_python_course', '--publish'], check=False
    )
    if result.returncode != 0:
        server.log.warning('Loading the Python course failed; see the output above.')
