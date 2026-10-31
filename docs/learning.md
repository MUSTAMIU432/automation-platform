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

   **A PDF becomes the lesson's notes.** When a PDF is uploaded to a lesson with
   no notes (or only the stand-in that "Upload PDFs" writes), the server reads it
   (`learning/pdf_import.py`, with `pdfminer.six`) and writes the notes itself, so
   learners read the lesson in the app rather than only downloading a file:
   larger or short bold lines become headings, bulleted or numbered lines lists,
   monospaced runs code (Python or shell when it reads like either), columns of
   short cells a table (one row per list item), and the rest paragraphs.
   Running headers, footers and page numbers are dropped, the file's own title
   (the lesson shows it already) is left out, an "objectives" heading with a
   list becomes the lesson's objectives, the summary is the first sentence, and
   the reading time follows the length. The PDF stays attached.

   **A whole course guide becomes lessons.** When the headings come in two
   levels - "WEEK 1 - ..." over "Lesson 1.1: ..." - each top-level part becomes
   a lesson of its own, right after the one uploaded to, in the same module, so
   the outline lists them and each opens when clicked; the lower headings are
   the numbered sections inside. A cover page (no body text) opens the first
   lesson: its title is left out and its "Label: value" lines become a list. A
   PDF with one level of headings stays one lesson.
   Notes somebody wrote are never replaced. A scanned PDF has no text to read and
   keeps the stand-in and the file. The upload dialog says which happened
   ("notes written", "added as 16 lessons" or "file only"), and the notes can be
   edited like any others.
   PDF lessons uploaded before this were filled by `write_pdf_lesson_notes`, which
   the backend runs in the background on every start (`WRITE_PDF_LESSON_NOTES=false`
   turns it off). It also rebuilds notes the first converter wrote - which made a
   whole course guide one long lesson - when they are still exactly what that
   converter (`learning/pdf_import_v1.py`, frozen) makes from the lesson's PDF:
   untouched since, so safe to replace, and the guide becomes its lessons. Notes
   anybody edited no longer match and are left alone.
5. **External resources** - a web page learners read inside a lesson, such as
   CodeWithHarry's "Python Objects and Classes" in the Python course's classes
   lesson. Added on the lesson page (title, description, address, type, display
   order, published) by course managers only; learners see published ones, after
   the lesson's objectives and before its notes. The page loads in the learner's
   browser straight from its own site, in a sandboxed frame that cannot navigate
   MUSTANET or read its data; the server only stores the address and **never
   fetches it** - no proxy, no copying. Addresses must be http or https with a
   site and no sign-in details (`learning/resource_urls.py`, checked on the
   server and again before rendering). Sites that forbid framing
   (`X-Frame-Options`, CSP `frame-ancestors`) are not worked around: browsers do
   not report that to the page, so an "Open original resource" link (new tab,
   `noopener`) is always under the frame, a page that has not loaded after 20
   seconds is replaced by the fallback message, and the console's **Preview**
   shows the author straight away - choose **Link only** for such a site.
   **Hide the top of the page** (0-400 px, per resource) crops MUSTANET's frame
   so a site's own header and menus sit above the visible area - the frame
   moves up inside its box; the page itself is not, and cannot be, changed. It
   is a fixed height (a site's header is often taller on phones) and needs
   adjusting if the site redesigns; the card keeps "From <site>" and the link to
   the original either way. A
   course's files can list resources under a lesson (`[[lessons.resources]]`);
   they are added as published, and the start-up `seed_python_course` adds ones
   an existing course lacks. To hide one of those for good, unpublish it rather
   than deleting it, or it is added again on the next start.
6. **Exercises** have instructions, starter code, a reference solution (never
   sent to learners), hints, and tests. Each needs at least one visible test
   (shown as an example) and one hidden test.
7. **Publish** from the course page. **Archive** removes a course from the catalog
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
2. Nothing to do for the Python course: the start hook (`backend/gunicorn.conf.py`)
   runs `seed_python_course --publish` after `migrate`, so a new deployment has it
   loaded and published, as a local setup does. Once the course exists the
   command changes nothing, so administrators' edits (and an unpublished status)
   are kept. `SEED_PYTHON_COURSE=false` skips it.
3. Optional: set up the sandbox above and its variables.
4. Lesson files need the R2 variables (already required in production).

No new frontend variables are needed.

## Known limits

- Exercise grading compares printed output; it does not run learners' own pytest files.
- A final project is recorded when submitted; there is no reviewer workflow for it yet.
- Lesson files are downloaded through the backend, which is fine for notes and
  slides; very large files would be better served by short-lived signed links.
