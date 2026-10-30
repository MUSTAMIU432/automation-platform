"""The Gunicorn start hook: migrations, then the Python course and PDF lesson notes."""

import importlib.util
import subprocess
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

import pytest

_CONF = Path(__file__).resolve().parent.parent / 'gunicorn.conf.py'


def _load_conf():
    spec = importlib.util.spec_from_file_location('gunicorn_conf', _CONF)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _server():
    return SimpleNamespace(log=mock.Mock())


def _commands(run):
    return [call.args[0][2:] for call in run.call_args_list]


@pytest.fixture(autouse=True)
def background(monkeypatch):
    """Nothing here starts a real process; a test that cares looks at the mock."""
    popen = mock.Mock()
    monkeypatch.setattr(subprocess, 'Popen', popen)
    return popen


@pytest.mark.parametrize('value', ['false', 'FALSE', '0', 'no', 'off'])
def test_seeding_can_be_switched_off(monkeypatch, value):
    monkeypatch.setenv('SEED_PYTHON_COURSE', value)
    conf = _load_conf()
    with mock.patch.object(subprocess, 'run') as run:
        conf.on_starting(_server())

    assert _commands(run) == [['migrate', '--noinput']]


@pytest.mark.parametrize('value', [None, '', 'true', '1'])
def test_migrates_then_seeds_and_publishes_the_course_by_default(monkeypatch, value):
    if value is None:
        monkeypatch.delenv('SEED_PYTHON_COURSE', raising=False)
    else:
        monkeypatch.setenv('SEED_PYTHON_COURSE', value)
    conf = _load_conf()
    with mock.patch.object(
        subprocess, 'run', return_value=subprocess.CompletedProcess([], 0)
    ) as run:
        conf.on_starting(_server())

    assert _commands(run) == [['migrate', '--noinput'], ['seed_python_course', '--publish']]


def test_a_failed_seed_is_logged_and_does_not_stop_the_site(monkeypatch):
    monkeypatch.setenv('SEED_PYTHON_COURSE', 'true')
    conf = _load_conf()
    server = _server()
    with mock.patch.object(subprocess, 'run', return_value=subprocess.CompletedProcess([], 1)):
        conf.on_starting(server)

    server.log.warning.assert_called_once()


def test_a_failed_migration_still_stops_gunicorn(monkeypatch):
    monkeypatch.setenv('SEED_PYTHON_COURSE', 'true')
    conf = _load_conf()
    with (
        mock.patch.object(
            subprocess, 'run', side_effect=subprocess.CalledProcessError(1, 'migrate')
        ) as run,
        pytest.raises(subprocess.CalledProcessError),
    ):
        conf.on_starting(_server())

    assert _commands(run) == [['migrate', '--noinput']]


def test_pdf_lesson_notes_are_written_in_the_background_by_default(monkeypatch, background):
    monkeypatch.delenv('WRITE_PDF_LESSON_NOTES', raising=False)
    conf = _load_conf()
    with mock.patch.object(subprocess, 'run'):
        conf.on_starting(_server())

    assert [call.args[0][2:] for call in background.call_args_list] == [['write_pdf_lesson_notes']]


def test_pdf_lesson_notes_can_be_switched_off(monkeypatch, background):
    monkeypatch.setenv('WRITE_PDF_LESSON_NOTES', 'false')
    conf = _load_conf()
    with mock.patch.object(subprocess, 'run'):
        conf.on_starting(_server())

    background.assert_not_called()
