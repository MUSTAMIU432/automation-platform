"""
Running a learner's Python code: never here, always in an isolated sandbox.

Learner code is untrusted code. It is never imported, `exec`'d, compiled or run
in a subprocess by this application - not in the web process, not in a worker.
It is sent to a separate execution service whose whole job is to run it under
limits this process could not enforce on itself:

- a CPU-time and wall-clock timeout, and a memory ceiling, per run;
- no network;
- a throwaway filesystem with nothing of the host in it;
- no environment variables, so no secrets - the service holds none of ours;
- a fresh sandbox per run, removed afterwards.

The protocol is [Piston](https://github.com/engineer-man/piston)'s
`POST /api/v2/execute`, which a self-hosted Piston speaks natively and which is
small enough to put in front of another runner. Piston enforces the list above
with `isolate` (Linux namespaces and cgroups); it must be deployed with
networking disabled for runs, which is its default. See docs/learning.md.

**Off unless configured.** With `CODE_EXECUTION_URL` unset, `executor()` raises
`ExecutionUnavailable` and the API says so - it never falls back to running code
some other way.
"""

import logging
from dataclasses import dataclass

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

# Never return more than this much of a stream to a caller: a `while True: print()`
# that the sandbox cut off at its own limit is still a lot of text to store and render.
OUTPUT_LIMIT = 16_000


class ExecutionUnavailable(Exception):
    """No execution service is configured, or it could not be reached."""


@dataclass(frozen=True)
class ExecutionResult:
    stdout: str
    stderr: str
    exit_code: int | None
    # Stopped by the sandbox: over its time or memory limit.
    killed: bool

    @property
    def succeeded(self) -> bool:
        return self.exit_code == 0 and not self.killed


def is_configured() -> bool:
    return bool(settings.CODE_EXECUTION_URL)


def _clip(text: str) -> str:
    if len(text) <= OUTPUT_LIMIT:
        return text
    return text[:OUTPUT_LIMIT] + '\n… output truncated …'


class PistonExecutor:
    """A Piston-compatible execution service at `base_url`."""

    def __init__(self, base_url: str, token: str = ''):
        self.endpoint = base_url.rstrip('/') + '/api/v2/execute'
        self.token = token

    def run(self, source: str, stdin: str = '') -> ExecutionResult:
        timeout_ms = settings.CODE_EXECUTION_TIMEOUT_MS
        payload = {
            'language': 'python',
            'version': settings.CODE_EXECUTION_PYTHON_VERSION,
            'files': [{'name': 'main.py', 'content': source}],
            'stdin': stdin,
            'run_timeout': timeout_ms,
            'compile_timeout': timeout_ms,
            'run_memory_limit': settings.CODE_EXECUTION_MEMORY_LIMIT_BYTES,
        }
        headers = {'Authorization': f'Bearer {self.token}'} if self.token else {}
        try:
            response = requests.post(
                self.endpoint,
                json=payload,
                headers=headers,
                # Our own ceiling on waiting: the sandbox's timeout plus room to
                # create and tear down the sandbox around it.
                timeout=timeout_ms / 1000 + 10,
            )
            response.raise_for_status()
            run = response.json()['run']
        except (requests.RequestException, ValueError, KeyError, TypeError):
            logger.warning('The code execution service failed.', exc_info=True)
            raise ExecutionUnavailable(
                'Code could not be run right now. Please try again in a moment.'
            ) from None

        signal = run.get('signal')
        exit_code = run.get('code')
        return ExecutionResult(
            stdout=_clip(run.get('stdout') or ''),
            stderr=_clip(run.get('stderr') or ''),
            exit_code=exit_code if isinstance(exit_code, int) else None,
            # Piston stops a run over its time or memory limit with SIGKILL.
            killed=signal == 'SIGKILL',
        )


def executor() -> PistonExecutor:
    if not is_configured():
        raise ExecutionUnavailable(
            'Running code is not available on this platform yet. You can still read, '
            'write and save your answer here.'
        )
    return PistonExecutor(settings.CODE_EXECUTION_URL, settings.CODE_EXECUTION_TOKEN)
