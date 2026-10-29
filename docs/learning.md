# Learning: courses, exercises and quizzes

The platform's learning area (`/app/learn`) and its authoring console
(`/app/admin/courses`). It ships with one course, **Python Programming: Beginner
to Advanced**, loaded once as a starting draft that administrators then own.

- Backend: `backend/learning/` (Django app, GraphQL in `schema.py` and `authoring_schema.py`)
- Frontend: `frontend/src/features/learning/` (learner pages) and the console's
  `features/administration/pages/AdminCourse*`, `AdminLessonEditorPage`,
  `AdminExerciseEditorPage`, `AdminQuizEditorPage`

## What learners get

The course's closing project is called the **final project** everywhere people read
it; the code, API and content files still name it `capstone`.

| Page | Path | What it does |
| ---- | ---- | ------------ |
| My learning | `/app/learn` | Enrolled courses with progress, a "continue" shortcut, recent activity |
| Catalog | `/app/learn/courses` | Published courses, searchable and filterable by level |
| Course | `/app/learn/courses/:slug` | Introduction, outcomes, curriculum, progress, enrollment, final project, completion |
| Lesson | `…/lessons/:id` | Notes with highlighted, copyable code; lesson files; mark complete; previous/next |
| Exercise | `…/exercises/:id` | Instructions, examples, code editor, Run, Submit, results, hints, previous attempts |
| Quiz | `…/quizzes/:id` | Single- and multiple-answer questions, score, explanations, retries |

A course is **complete** when every lesson is completed, every module quiz is
passed, and the final project (a repository link, how to run it, and the learner's
design decisions) is submitted. Exercises count toward progress but do not gate
completion, so a platform without a code sandbox can still be finished. The rule
is one function: `learning.services.completion_gaps`.

## How administrators manage content

Everything learners see is written in the console by anyone with
**`canManageCourses`** - console access plus the `learning.change_course`
permission. Platform administrators (`manage.py grant_platform_admin`) have it;
migration `learning.0002` gives it to administrators granted before Learning existed.

1. **Courses → New course** creates a draft. Learners see nothing until it is published.
2. On the course page: edit details (description, outcomes, audience) and the final project,
   add and reorder **modules**, add and reorder **lessons**, add **exercises**
   and each module's **quiz**.
3. **Lesson notes** are written in a small Markdown subset with a live preview
   (rendered by the server, so it is exactly what learners will read):
   `## heading`, paragraphs, `- lists`, `> notes`, fenced code (```` ```python ````),
   and inline `` `code` `` and `**bold**`.
4. **Lesson files** - PDF, Word, PowerPoint, Excel, CSV, text, Python and images -
   are uploaded on the lesson page. They are stored in the private object
   storage (Cloudflare R2 when deployed, see `docs/environments.md`) and only
   enrolled learners and course managers can download them, through an
   authorized endpoint. Uploads get the same checks as idea attachments: an
   allow-listed extension, a size limit, and the file's own leading bytes.
5. **Exercises** have instructions, starter code, a reference solution (never
   sent to learners), hints, and tests. Each needs at least one visible test
   (shown as an example) and one hidden test.
6. **Publish** from the course page. **Archive** removes a course from the catalog
   but keeps it open to the learners already enrolled. A course with learners
   cannot be deleted.

Deleting a lesson, exercise or module also deletes learner progress on it; the
console asks first.

### The Python course

`learning/content/python/` holds the course as TOML files - 12 modules, 26
lessons, 18 exercises (55 tests, hidden ones included) and 60 quiz questions, one
quiz per module.
`learning/tests/test_content.py` compiles every example and runs every
reference solution against its own tests, so the shipped content is verified.

Load it once per database:

```text
python manage.py seed_python_course            # as a draft
python manage.py seed_python_course --publish  # and publish it
```

After that it belongs to the console: running the command again changes nothing.
`--overwrite` reloads it from the files (replacing console edits to the same
lessons; learner progress on lessons that remain is kept), and `--prune` also
deletes content no longer in the files.

## Running learner code safely

**Learner code never runs in the Django process** - not imported, not `exec`'d,
not compiled, not in a subprocess. Run and Submit send it to a separate execution
service, `learning/execution.py`, which speaks the API of a self-hosted
[Piston](https://github.com/engineer-man/piston) (`POST /api/v2/execute`).

Piston runs each submission in a fresh, throwaway sandbox (Linux namespaces and
cgroups via `isolate`) with a CPU/wall-clock timeout and a memory limit set per
run, no network access (its default - keep it), no host filesystem, and none of
this application's environment or secrets.

**Grading is server-side.** Each test runs the learner's code followed by the
test's own code, with the test's input, in the sandbox. Only output printed after
a fresh random marker counts, and it is compared on the server: expected outputs
never leave it, and a hidden test's result reports only its name and whether it
passed - never its input, output or traceback. A learner cannot pass by printing
the visible example, because hidden tests use other inputs.

Runs are limited to 30 per minute and submissions to 10 per minute per learner.
Code is capped at 20,000 characters; output at 16,000.

### Configuration

| Variable | Default | Meaning |
| -------- | ------- | ------- |
| `CODE_EXECUTION_URL` | *(empty: off)* | Base URL of the Piston-compatible service, e.g. `https://runner.internal.example.com` |
| `CODE_EXECUTION_TOKEN` | *(empty)* | **Secret.** Sent as `Authorization: Bearer …` - for a service behind an authenticating proxy |
| `CODE_EXECUTION_PYTHON_VERSION` | `3.12.0` | The Python version installed in Piston |
| `CODE_EXECUTION_TIMEOUT_MS` | `3000` | Per-run time limit |
| `CODE_EXECUTION_MEMORY_LIMIT_BYTES` | `134217728` | Per-run memory limit (128 MB) |

With `CODE_EXECUTION_URL` unset, the editor still works (drafts are kept in the
browser), Run and Submit are disabled, and the exercise page says so.

### Deploying the sandbox

Piston needs a **privileged Docker container**, which Render services cannot run,
so it lives on a separate small VM (any provider):

1. Run Piston with networking for runs disabled (the default), and install Python:
   `docker run -d --privileged --name piston -p 127.0.0.1:2000:2000 ghcr.io/engineer-man/piston`,
   then install the `python` package at the version you configure (see Piston's README).
2. Put an HTTPS reverse proxy in front of it that requires the bearer token you set
   as `CODE_EXECUTION_TOKEN`, and allow only the backend's outbound addresses.
   Never expose Piston itself to the internet.
3. Set `CODE_EXECUTION_URL` (and the token) on the Render backend service and redeploy.
4. Check from a Render shell: open any exercise, press Run on `print("ok")`.

Do not use Piston's public demo API: it is rate-limited, needs approval, and
would send learners' code to a third party.

Until this is set up and tested, code execution is off; nothing pretends otherwise.

## Deployment checklist

1. Deploy as usual: `migrate` runs on start (see `backend/gunicorn.conf.py`) and
   creates the `learning` tables.
2. `python manage.py seed_python_course --publish` once, from a Render shell.
3. Optional: set up the sandbox above and its variables.
4. Lesson files need the R2 variables (already required in production).

No new frontend variables are needed.

## Known limits

- Exercise grading compares printed output; it does not run learners' own pytest files.
- A final project is recorded when submitted; there is no reviewer workflow for it yet.
- Lesson files are downloaded through the backend, which is fine for notes and
  slides; very large files would be better served by short-lived signed links.
