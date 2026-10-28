"""
Fixtures for the Learning suites: a small published course, learners, a GraphQL
caller, and a stand-in for the sandbox.

`sandbox` replaces the execution service with `run_trusted` - the snippets these
tests submit are the tests' own code, so running them locally is safe here. In
the application, code only ever reaches `learning.execution.PistonExecutor`.
"""

import json

import pytest

from identity.models import User
from identity.tokens import issue_access_token
from learning import execution
from learning.content import sync_course
from learning.tests.trusted import run_trusted

PASSWORD = 'a-strong-unique-pass-1'

MODULE = """
position = 1
slug = "basics"
title = "Basics"
summary = "The basics."
project = "A project."

[[lessons]]
slug = "first"
title = "First lesson"
body = "## Hello\\nRead me."

[[lessons]]
slug = "second"
title = "Second lesson"
body = "More reading."

[[exercises]]
slug = "add"
title = "Add two numbers"
lesson = "first"
instructions = "Write add(a, b)."
starter = "def add(a, b):\\n    pass"
solution = "def add(a, b):\\n    return a + b"
hints = ["Use +.", "Return the result.", "Really, return a + b."]
[[exercises.tests]]
name = "add(2, 3)"
call = "print(add(2, 3))"
expected = "5"
[[exercises.tests]]
name = "Secret case"
call = "print(add(-40, 2))"
expected = "-38"
hidden = true

[quiz]
title = "Basics quiz"
pass_percentage = 50
[[quiz.questions]]
prompt = "Pick a."
options = ["a", "b"]
correct = [0]
explanation = "It was a."
[[quiz.questions]]
prompt = "Pick a and c."
kind = "multiple"
options = ["a", "b", "c"]
correct = [0, 2]
explanation = "Both a and c."
"""

COURSE = """
slug = "mini"
title = "Mini course"
level = "beginner"
[capstone]
brief = "Build it."
requirements = ["Tests"]
[[capstone.options]]
key = "api"
title = "An API"
summary = "Build an API."
"""


@pytest.fixture
def course(db, tmp_path):
    (tmp_path / 'modules').mkdir()
    (tmp_path / 'course.toml').write_text(COURSE, encoding='utf-8')
    (tmp_path / 'modules' / '01.toml').write_text(MODULE, encoding='utf-8')
    return sync_course(tmp_path, publish=True).course


def make_user(email: str, **extra) -> User:
    return User.objects.create_user(
        email=email, password=PASSWORD, first_name='Ada', last_name='Learner', **extra
    )


def grant_course_management(user: User) -> User:
    """Console access and the courses permission: a course manager."""
    from django.contrib.auth.models import Permission

    user.user_permissions.add(
        Permission.objects.get(codename='access_console', content_type__app_label='administration'),
        Permission.objects.get(codename='change_course', content_type__app_label='learning'),
    )
    return User.objects.get(pk=user.pk)  # a fresh instance: permissions are cached per object


@pytest.fixture
def manager(db):
    return grant_course_management(make_user('manager@example.com'))


@pytest.fixture
def learner(db):
    return make_user('learner@example.com')


@pytest.fixture
def other_learner(db):
    return make_user('other@example.com')


@pytest.fixture
def gql(client):
    def call(query: str, variables: dict | None = None, user: User | None = None) -> dict:
        headers = {}
        if user is not None:
            headers['HTTP_AUTHORIZATION'] = f'Bearer {issue_access_token(user.pk)[0]}'
        response = client.post(
            '/graphql/',
            data=json.dumps({'query': query, 'variables': variables or {}}),
            content_type='application/json',
            **headers,
        )
        body = response.json()
        assert 'errors' not in body, body['errors']
        return body['data']

    return call


class LocalSandbox:
    """Counts what would have been sent to the sandbox, and runs it locally (tests only)."""

    def __init__(self):
        self.calls: list[tuple[str, str]] = []

    def run(self, source: str, stdin: str = '') -> execution.ExecutionResult:
        self.calls.append((source, stdin))
        return run_trusted(source, stdin)


@pytest.fixture
def sandbox(monkeypatch, settings):
    settings.CODE_EXECUTION_URL = 'https://sandbox.example.invalid'
    local = LocalSandbox()
    monkeypatch.setattr(execution, 'executor', lambda: local)
    return local
