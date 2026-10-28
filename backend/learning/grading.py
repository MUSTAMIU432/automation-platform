"""
Grading an exercise against its server-side tests.

A test is the learner's code followed by the test's `call`, run in the sandbox
with the test's `stdin`. When there is a `call`, the grader prints a fresh
random marker just before it, and only what comes after the last marker is
compared - so whatever the learner's own code prints at import time cannot
pass a test for it.

The comparison happens here, on the server: `expected_output` is never sent
anywhere, not even to the sandbox. A hidden test's inputs do go to the sandbox
(they are part of the program it runs) but never to the learner - its result
carries only its name and whether it passed. Its output, its error and its
traceback can all repeat its inputs, so none of them is returned.

`run` is a parameter rather than an import so this module never decides where
code runs: `learning.services` passes the sandbox executor, and the content
tests pass a local runner for the course's own reference solutions.
"""

import secrets
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field

from learning.execution import ExecutionResult
from learning.models import ExerciseTestCase

Runner = Callable[[str, str], ExecutionResult]

# How much of an output or error a visible test result keeps for the learner.
DETAIL_LIMIT = 2_000


@dataclass(frozen=True)
class CheckResult:
    name: str
    hidden: bool
    passed: bool
    # Visible tests only; empty for a hidden one.
    stdin: str = ''
    call: str = ''
    expected: str = ''
    actual: str = ''
    error: str = ''

    def as_dict(self) -> dict:
        return {
            'name': self.name,
            'hidden': self.hidden,
            'passed': self.passed,
            'stdin': self.stdin,
            'call': self.call,
            'expected': self.expected,
            'actual': self.actual,
            'error': self.error,
        }


@dataclass(frozen=True)
class GradeResult:
    results: list[CheckResult] = field(default_factory=list)

    @property
    def passed_count(self) -> int:
        return sum(1 for result in self.results if result.passed)

    @property
    def passed(self) -> bool:
        return bool(self.results) and self.passed_count == len(self.results)


def normalize(output: str) -> str:
    """Trailing spaces on each line, and trailing blank lines, never decide a test."""
    return '\n'.join(line.rstrip() for line in output.strip('\n').splitlines()).rstrip('\n')


def build_program(code: str, test: ExerciseTestCase, marker: str) -> str:
    if not test.call:
        return code
    return f'{code}\n\nprint({marker!r})\n{test.call}\n'


def extract_output(stdout: str, test: ExerciseTestCase, marker: str) -> str | None:
    """What this test's output is, or None when the marker never printed."""
    if not test.call:
        return stdout
    _, found, tail = stdout.rpartition(marker + '\n')
    if not found:
        return None
    return tail


def _clip(text: str) -> str:
    return text if len(text) <= DETAIL_LIMIT else text[:DETAIL_LIMIT] + '\n…'


def _last_line(stderr: str) -> str:
    """The exception line of a traceback - `ValueError: ...` - for a visible test."""
    lines = [line for line in stderr.strip().splitlines() if line.strip()]
    return lines[-1] if lines else ''


def grade(code: str, tests: Iterable[ExerciseTestCase], run: Runner) -> GradeResult:
    results = []
    for test in tests:
        marker = f'--grader-{secrets.token_hex(16)}--'
        execution = run(build_program(code, test, marker), test.stdin)
        actual = extract_output(execution.stdout, test, marker)
        passed = (
            execution.succeeded
            and actual is not None
            and normalize(actual) == normalize(test.expected_output)
        )

        if test.is_hidden:
            results.append(CheckResult(name=test.name, hidden=True, passed=passed))
            continue

        if execution.killed:
            error = 'Stopped: the program took too long or used too much memory.'
        elif execution.exit_code not in (0, None) or actual is None:
            error = _last_line(execution.stderr) or 'The program stopped with an error.'
        else:
            error = ''
        results.append(
            CheckResult(
                name=test.name,
                hidden=False,
                passed=passed,
                stdin=test.stdin,
                call=test.call,
                expected=test.expected_output,
                actual=_clip(normalize(actual or '')),
                error=_clip(error),
            )
        )
    return GradeResult(results=results)
