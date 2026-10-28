"""
Running the course's own trusted code - reference solutions and test snippets - in
a fresh local interpreter. Tests only: learner code never runs this way, it only
ever goes to the sandbox (`learning/execution.py`).
"""

import subprocess
import sys

from learning.execution import ExecutionResult


def run_trusted(source: str, stdin: str) -> ExecutionResult:
    """Run the course's own reference code - never a learner's - in a fresh interpreter."""
    completed = subprocess.run(  # noqa: S603 - our own content, a fixed interpreter
        [sys.executable, '-I', '-c', source],
        input=stdin,
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    return ExecutionResult(
        stdout=completed.stdout,
        stderr=completed.stderr,
        exit_code=completed.returncode,
        killed=False,
    )
