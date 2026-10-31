"""
Course content as data: TOML files in, database rows out.

A course is a directory under `learning/content/`: `course.toml` describes the
course, and every `modules/*.toml` file is one module with its lessons,
exercises and quiz. `sync_course` loads them into the database and can be run
again at any time - it updates in place by slug, so learner progress on a
lesson survives an edit to that lesson. Adding a lesson is adding a
`[[lessons]]` table to a file; no code changes.

Lesson bodies and exercise instructions are written in a small, fixed subset of
Markdown and stored as blocks (`LessonContent`), so the frontend renders
elements and never an author's HTML:

    ## A heading                  heading (`##` or `###`)
    A paragraph, over one or      paragraph (lines join until a blank line)
    more lines.
    - one item                    list (consecutive `- ` lines)
    > Remember this.              note (consecutive `> ` lines)
    ```python                     code (any language name; `python` if none)
    print("hi")
    ```

Inside text, `code`, **bold** and *italic* are the only inline markup.

A lesson may list external web pages to read inside it, each a
`[[lessons.resources]]` table with `title`, `url` (http or https only),
`description` and `kind` (`embed`, the default, or `link`). They are added as
published, and only ever added: one already on the lesson (matched by address)
is left as it is, and `add_missing_resources` gives an already loaded course
the ones it lacks without touching anything else.

Everything is validated before anything is written, and the write is one
transaction - a file with a mistake changes nothing.
"""

import re
import tomllib
from dataclasses import dataclass, field
from pathlib import Path

from django.db import transaction
from django.utils import timezone

from learning.models import (
    AnswerOption,
    CodingExercise,
    Course,
    CourseModule,
    ExerciseTestCase,
    Lesson,
    LessonContent,
    LessonResource,
    Question,
    Quiz,
)
from learning.resource_urls import check_resource_url

CONTENT_ROOT = Path(__file__).resolve().parent / 'content'

# Positions are moved out of the way before being rewritten, so reordering two
# lessons never collides with the (module, position) uniqueness constraint.
_POSITION_OFFSET = 100_000


class ContentError(Exception):
    """A content file that cannot be loaded, with where and why."""


@dataclass(frozen=True)
class Block:
    kind: str
    text: str
    language: str = ''

    def as_dict(self) -> dict:
        return {'kind': self.kind, 'text': self.text, 'language': self.language}


def _take_while(lines: list[str], index: int, prefix: str) -> tuple[list[str], int]:
    """Consecutive lines starting with `prefix`, without it, and the index after them."""
    taken = []
    while index < len(lines) and lines[index].strip().startswith(prefix):
        taken.append(lines[index].strip()[len(prefix) :].strip())
        index += 1
    return taken, index


def _take_code(lines: list[str], index: int) -> tuple[Block, int]:
    """The fenced block opening at `index`, and the index after its closing fence."""
    language = lines[index].strip()[3:].strip() or 'python'
    end = index + 1
    while end < len(lines) and lines[end].strip() != '```':
        end += 1
    if end == len(lines):
        raise ContentError('A code block is never closed with ```.')
    return Block('code', '\n'.join(lines[index + 1 : end]), language), end + 1


def parse_blocks(source: str) -> list[Block]:
    """The block subset described in the module docstring."""
    blocks: list[Block] = []
    lines = source.strip('\n').splitlines()
    paragraph: list[str] = []
    index = 0

    def flush_paragraph() -> None:
        if paragraph:
            blocks.append(Block('paragraph', ' '.join(part.strip() for part in paragraph)))
            paragraph.clear()

    while index < len(lines):
        stripped = lines[index].strip()
        if not stripped or stripped.startswith(('```', '#', '- ', '>')):
            flush_paragraph()

        if stripped.startswith('```'):
            block, index = _take_code(lines, index)
            blocks.append(block)
        elif heading := re.match(r'^#{2,3}\s+(.+)$', stripped):
            blocks.append(Block('heading', heading.group(1).strip()))
            index += 1
        elif stripped.startswith('- '):
            items, index = _take_while(lines, index, '- ')
            blocks.append(Block('list', '\n'.join(items)))
        elif stripped.startswith('>'):
            note, index = _take_while(lines, index, '>')
            blocks.append(Block('note', ' '.join(note)))
        else:
            if stripped:
                paragraph.append(stripped)
            index += 1

    flush_paragraph()
    return blocks


def blocks_from(source: str, where: str = 'The text') -> list[Block]:
    """`source` as blocks, or a `ContentError` saying what is wrong with it."""
    return _blocks(source, where)


# --- reading and checking the files ---------------------------------------------------


def _read(path: Path) -> dict:
    try:
        with path.open('rb') as handle:
            return tomllib.load(handle)
    except (OSError, tomllib.TOMLDecodeError) as exc:
        raise ContentError(f'{path.name}: {exc}') from exc


def _require(data: dict, key: str, where: str, kind: type = str):
    value = data.get(key)
    if not isinstance(value, kind) or (kind is str and not value.strip()):
        raise ContentError(f'{where}: `{key}` is required ({kind.__name__}).')
    return value


def _blocks(source: str, where: str) -> list[Block]:
    try:
        blocks = parse_blocks(source)
    except ContentError as exc:
        raise ContentError(f'{where}: {exc}') from exc
    if not blocks:
        raise ContentError(f'{where}: has no content.')
    return blocks


def check_lessons(lessons: list, where: str) -> set[str]:
    slugs = set()
    for lesson in lessons:
        lesson_where = f'{where} lesson {lesson.get("slug", "?")!r}'
        for key in ('slug', 'title', 'body'):
            _require(lesson, key, lesson_where)
        if lesson['slug'] in slugs:
            raise ContentError(f'{lesson_where}: the slug is used twice.')
        slugs.add(lesson['slug'])
        _blocks(lesson['body'], lesson_where)
        for number, resource in enumerate(lesson.get('resources', []), start=1):
            check_resource(resource, f'{lesson_where} resource {number}')
    return slugs


def check_resource(resource: dict, where: str) -> None:
    """An external web page listed under a lesson: a title, a safe address, a known kind."""
    _require(resource, 'title', where)
    try:
        check_resource_url(_require(resource, 'url', where))
    except ValueError as exc:
        raise ContentError(f'{where}: {exc}') from None
    if resource.get('kind', LessonResource.Kind.EMBED) not in LessonResource.Kind.values:
        raise ContentError(f'{where}: unknown kind.')
    crop_top = resource.get('crop_top', 0)
    if not isinstance(crop_top, int) or not 0 <= crop_top <= 400:
        raise ContentError(f'{where}: crop_top must be a whole number from 0 to 400.')


def check_exercise(exercise: dict, where: str, lesson_slugs: set[str]) -> None:
    for key in ('slug', 'title', 'instructions', 'solution'):
        _require(exercise, key, where)
    if exercise.get('lesson') and exercise['lesson'] not in lesson_slugs:
        raise ContentError(f'{where}: no lesson {exercise["lesson"]!r} here.')
    if exercise.get('difficulty', 'easy') not in CodingExercise.Difficulty.values:
        raise ContentError(f'{where}: unknown difficulty.')
    tests = _require(exercise, 'tests', where, list)
    if not tests:
        raise ContentError(f'{where}: needs at least one test.')
    for test in tests:
        _require(test, 'name', where)
        if not isinstance(test.get('expected'), str):
            raise ContentError(f'{where}: test {test["name"]!r} needs `expected`.')
    _blocks(exercise['instructions'], where)


def check_question(question: dict, where: str) -> None:
    _require(question, 'prompt', where)
    options = _require(question, 'options', where, list)
    correct = _require(question, 'correct', where, list)
    kind = question.get('kind', 'single')
    if kind not in Question.Kind.values:
        raise ContentError(f'{where}: unknown kind {kind!r}.')
    if len(options) < 2:
        raise ContentError(f'{where}: needs at least two options.')
    if not correct or any(not isinstance(i, int) or not 0 <= i < len(options) for i in correct):
        raise ContentError(f'{where}: `correct` must index the options.')
    if kind == 'single' and len(correct) != 1:
        raise ContentError(f'{where}: a single-answer question has one answer.')


def _check_module(data: dict, path: Path) -> None:
    where = path.name
    _require(data, 'position', where, int)
    for key in ('slug', 'title', 'summary'):
        _require(data, key, where)

    lesson_slugs = check_lessons(_require(data, 'lessons', where, list), where)

    exercise_slugs = set()
    for exercise in data.get('exercises', []):
        exercise_where = f'{where} exercise {exercise.get("slug", "?")!r}'
        if exercise.get('slug') in exercise_slugs:
            raise ContentError(f'{exercise_where}: the slug is used twice.')
        check_exercise(exercise, exercise_where, lesson_slugs)
        exercise_slugs.add(exercise['slug'])

    quiz = data.get('quiz')
    if quiz is not None:
        _require(quiz, 'title', f'{where} quiz')
        questions = _require(quiz, 'questions', f'{where} quiz', list)
        if not questions:
            raise ContentError(f'{where} quiz: needs at least one question.')
        for number, question in enumerate(questions, start=1):
            check_question(question, f'{where} quiz question {number}')


@dataclass
class CourseFiles:
    course: dict
    modules: list[tuple[Path, dict]] = field(default_factory=list)


def read_course(directory: Path) -> CourseFiles:
    """Every file of one course, parsed and checked. Nothing is written."""
    course = _read(directory / 'course.toml')
    for key in ('slug', 'title'):
        _require(course, key, 'course.toml')
    if course.get('level', 'all_levels') not in Course.Level.values:
        raise ContentError('course.toml: unknown level.')

    modules = []
    for path in sorted((directory / 'modules').glob('*.toml')):
        data = _read(path)
        _check_module(data, path)
        modules.append((path, data))
    if not modules:
        raise ContentError(f'{directory.name}: has no modules.')

    positions = [data['position'] for _, data in modules]
    slugs = [data['slug'] for _, data in modules]
    if len(set(positions)) != len(positions) or len(set(slugs)) != len(slugs):
        raise ContentError(f'{directory.name}: two modules share a position or a slug.')
    return CourseFiles(course=course, modules=modules)


# --- writing them ---------------------------------------------------------------------


@dataclass
class SyncReport:
    course: Course
    modules: int = 0
    lessons: int = 0
    exercises: int = 0
    questions: int = 0
    resources: int = 0
    kept: list[str] = field(default_factory=list)
    pruned: list[str] = field(default_factory=list)


def _move_aside(queryset) -> None:
    for row in queryset:
        row.position += _POSITION_OFFSET
        row.save(update_fields=['position'])


def _stale(queryset, wanted: set[str], label: str, report: SyncReport, prune: bool) -> None:
    for row in queryset.exclude(slug__in=wanted):
        if prune:
            report.pruned.append(f'{label}{row.slug}')
            row.delete()
        else:
            report.kept.append(f'{label}{row.slug}')


@transaction.atomic
def sync_course(directory: Path, *, publish: bool = False, prune: bool = False) -> SyncReport:
    """
    Load one course directory. Updates by slug; a new course starts as a draft
    unless `publish`. Content no longer in the files is kept (and reported)
    unless `prune`, which deletes it along with any learner progress on it.
    """
    files = read_course(directory)
    data = files.course

    course, _ = Course.objects.get_or_create(slug=data['slug'], defaults={'title': data['title']})
    course.title = data['title']
    course.subtitle = data.get('subtitle', '')
    course.description = data.get('description', '').strip()
    course.level = data.get('level', Course.Level.ALL_LEVELS)
    course.estimated_hours = data.get('estimated_hours', 0)
    course.audience = data.get('audience', [])
    course.outcomes = data.get('outcomes', [])
    course.capstone = data.get('capstone', {})
    if publish and course.status != Course.Status.PUBLISHED:
        course.status = Course.Status.PUBLISHED
        course.published_at = timezone.now()
    course.save()
    report = SyncReport(course=course)

    _stale(course.modules.all(), {m['slug'] for _, m in files.modules}, 'module ', report, prune)
    _move_aside(course.modules.all())

    for _, module_data in files.modules:
        module, _ = CourseModule.objects.update_or_create(
            course=course,
            slug=module_data['slug'],
            defaults={
                'position': module_data['position'],
                'title': module_data['title'],
                'summary': module_data['summary'].strip(),
                'objectives': module_data.get('objectives', []),
                'project': module_data.get('project', '').strip(),
            },
        )
        report.modules += 1
        lessons = _sync_lessons(module, module_data['lessons'], report, prune)
        _sync_exercises(module, module_data.get('exercises', []), lessons, report, prune)
        _sync_quiz(module, module_data.get('quiz'), report)

    return report


def _sync_lessons(module, lessons_data, report, prune) -> dict[str, Lesson]:
    label = f'lesson {module.slug}/'
    _stale(module.lessons.all(), {data['slug'] for data in lessons_data}, label, report, prune)
    _move_aside(module.lessons.all())

    lessons = {}
    for position, data in enumerate(lessons_data, start=1):
        lesson, _ = Lesson.objects.update_or_create(
            module=module,
            slug=data['slug'],
            defaults={
                'position': position,
                'title': data['title'],
                'summary': data.get('summary', '').strip(),
                'objectives': data.get('objectives', []),
                'estimated_minutes': data.get('minutes', 15),
                'body': data['body'].strip('\n'),
            },
        )
        lesson.blocks.all().delete()
        LessonContent.objects.bulk_create(
            LessonContent(
                lesson=lesson,
                position=index,
                kind=block.kind,
                text=block.text,
                language=block.language,
            )
            for index, block in enumerate(parse_blocks(data['body']), start=1)
        )
        report.resources += _add_resources(lesson, data.get('resources', []))
        lessons[lesson.slug] = lesson
        report.lessons += 1
    return lessons


def _add_resources(lesson: Lesson, resources_data: list[dict]) -> int:
    """Add the files' resources this lesson does not have yet (matched by address).

    Only ever adds: a resource already there - whoever made it, however it was
    edited, published or not - is left exactly as it is.
    """
    have = set(lesson.resources.values_list('url', flat=True))
    top = max(lesson.resources.values_list('position', flat=True), default=0)
    added = 0
    for data in resources_data:
        url = data['url'].strip()
        if url in have:
            continue
        top += 1
        LessonResource.objects.create(
            lesson=lesson,
            title=data['title'].strip(),
            description=data.get('description', '').strip(),
            url=url,
            kind=data.get('kind', LessonResource.Kind.EMBED),
            crop_top=data.get('crop_top', 0),
            position=top,
            is_published=True,
        )
        have.add(url)
        added += 1
    return added


@transaction.atomic
def add_missing_resources(directory: Path) -> int:
    """Give an already loaded course the external resources its files list and it lacks.

    For a course administrators now own: nothing else in it is touched. Returns
    how many were added (0 when the course is not loaded at all).
    """
    files = read_course(directory)
    course = Course.objects.filter(slug=files.course['slug']).first()
    if course is None:
        return 0
    added = 0
    for _, module_data in files.modules:
        for data in module_data['lessons']:
            if not data.get('resources'):
                continue
            lesson = Lesson.objects.filter(
                module__course=course, module__slug=module_data['slug'], slug=data['slug']
            ).first()
            if lesson is not None:
                added += _add_resources(lesson, data['resources'])
    return added


def _sync_exercises(module, exercises_data, lessons, report, prune) -> None:
    label = f'exercise {module.slug}/'
    _stale(module.exercises.all(), {data['slug'] for data in exercises_data}, label, report, prune)
    _move_aside(module.exercises.all())

    for position, data in enumerate(exercises_data, start=1):
        exercise, _ = CodingExercise.objects.update_or_create(
            module=module,
            slug=data['slug'],
            defaults={
                'position': position,
                'title': data['title'],
                'lesson': lessons.get(data.get('lesson', '')),
                'difficulty': data.get('difficulty', CodingExercise.Difficulty.EASY),
                'instructions_source': data['instructions'].strip('\n'),
                'instructions': [block.as_dict() for block in parse_blocks(data['instructions'])],
                'starter_code': data.get('starter', '').strip('\n') + '\n',
                'solution_code': data['solution'].strip('\n') + '\n',
                'hints': data.get('hints', []),
            },
        )
        exercise.test_cases.all().delete()
        ExerciseTestCase.objects.bulk_create(
            ExerciseTestCase(
                exercise=exercise,
                position=index,
                name=test['name'],
                stdin=test.get('stdin', ''),
                call=test.get('call', '').strip(),
                expected_output=test['expected'],
                is_hidden=test.get('hidden', False),
            )
            for index, test in enumerate(data['tests'], start=1)
        )
        report.exercises += 1


def _sync_quiz(module, quiz_data, report) -> None:
    if quiz_data is None:
        Quiz.objects.filter(module=module).delete()
        return
    quiz, _ = Quiz.objects.update_or_create(
        module=module,
        defaults={
            'title': quiz_data['title'],
            'pass_percentage': quiz_data.get('pass_percentage', 70),
        },
    )
    # Questions are replaced: an attempt keeps its own score, never a live link to them.
    quiz.questions.all().delete()
    for position, data in enumerate(quiz_data['questions'], start=1):
        question = Question.objects.create(
            quiz=quiz,
            position=position,
            prompt=data['prompt'].strip(),
            code=data.get('code', '').strip('\n'),
            kind=data.get('kind', Question.Kind.SINGLE),
            explanation=data.get('explanation', '').strip(),
        )
        AnswerOption.objects.bulk_create(
            AnswerOption(
                question=question,
                position=index,
                text=text,
                is_correct=index - 1 in data['correct'],
            )
            for index, text in enumerate(data['options'], start=1)
        )
        report.questions += 1
