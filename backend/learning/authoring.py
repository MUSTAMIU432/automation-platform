"""
Course authoring: what an administrator does in the console.

Every operation needs `can_manage_courses` (console access plus the courses
permission - see `administration.authorization`). Content is validated by the
same rules the content files are (`learning.content`), so a lesson written in
the console and a lesson loaded from a file are held to one standard; notes are
stored as written (`Lesson.body`) and as the blocks learners read.

Uploaded lesson files go through `ideas.storage` - R2 when deployed - with the
same checks as an idea's evidence: an allow-listed extension, a size limit, and
the file's own leading bytes, never the browser's claim.

Deleting removes learner records that depend on what is deleted (a lesson takes
its completions with it). A course with learners cannot be deleted - it is
archived instead, which keeps it open to them.
"""

import logging
import uuid
from dataclasses import dataclass, field
from pathlib import PurePosixPath

from django.db import DatabaseError, transaction
from django.db.models import Max
from django.utils import timezone
from django.utils.text import slugify

from ideas import attachments as file_rules
from ideas import storage
from identity.models import User
from learning import pdf_import, pdf_import_v1, selectors
from learning.content import ContentError, blocks_from, check_exercise, check_question
from learning.models import (
    AnswerOption,
    CodingExercise,
    Course,
    CourseModule,
    ExerciseTestCase,
    Lesson,
    LessonContent,
    LessonMaterial,
    LessonResource,
    Question,
    Quiz,
)
from learning.resource_urls import check_resource_url
from learning.services import LearningError

logger = logging.getLogger(__name__)

TITLE_MAX_LENGTH = 200

# Lesson files: notes, slides, worksheets, data and example code.
MATERIAL_TYPES: dict[str, str] = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.csv': 'text/csv',
    '.txt': 'text/plain',
    '.py': 'text/x-python',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
}
# The extensions `ideas.attachments` does not check by signature, and what they start with.
_EXTRA_SIGNATURES = {
    '.ppt': b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1',
    '.pptx': b'PK\x03\x04',
}


def _require_manager(user: User | None) -> User:
    if user is None or not user.is_active:
        raise LearningError('Sign in to continue.', reason='unauthenticated')
    if not selectors.can_manage_courses(user):
        raise LearningError('Managing courses needs the course permission.', reason='forbidden')
    return user


def _text(value: str, field: str, label: str, *, max_length: int = TITLE_MAX_LENGTH) -> str:
    value = (value or '').strip()
    if not value:
        raise LearningError(f'{label} is required.', field=field)
    if len(value) > max_length:
        raise LearningError(f'{label} must be {max_length} characters or fewer.', field=field)
    return value


def _lines(values: list[str]) -> list[str]:
    return [value.strip() for value in values if value and value.strip()]


def _unique_slug(title: str, taken) -> str:
    base = slugify(title)[:90] or 'item'
    slug, number = base, 2
    while taken(slug):
        slug = f'{base}-{number}'
        number += 1
    return slug


def _get(model, pk: object, label: str):
    row = model.objects.filter(pk=selectors.parse_id(pk)).first()
    if row is None:
        raise LearningError(f'That {label} does not exist.', reason='not_found')
    return row


def _blocks(source: str, field: str) -> list:
    try:
        return blocks_from(source, 'This text')
    except ContentError as exc:
        raise LearningError(str(exc), field=field) from exc


# --- courses --------------------------------------------------------------------------


@dataclass(frozen=True)
class CourseInput:
    title: str
    subtitle: str = ''
    description: str = ''
    level: str = Course.Level.ALL_LEVELS
    estimated_hours: int = 0
    audience: list[str] = field(default_factory=list)
    outcomes: list[str] = field(default_factory=list)
    capstone_brief: str = ''
    capstone_requirements: list[str] = field(default_factory=list)
    capstone_options: list[dict] = field(default_factory=list)


def _apply_course(course: Course, data: CourseInput) -> None:
    course.title = _text(data.title, 'title', 'A title')
    course.subtitle = (data.subtitle or '').strip()[:300]
    course.description = (data.description or '').strip()
    if data.level not in Course.Level.values:
        raise LearningError('Choose a level.', field='level')
    course.level = data.level
    if not 0 <= data.estimated_hours <= 1000:
        raise LearningError('Estimated hours must be between 0 and 1000.', 'estimatedHours')
    course.estimated_hours = data.estimated_hours
    course.audience = _lines(data.audience)
    course.outcomes = _lines(data.outcomes)

    options, keys = [], set()
    for option in data.capstone_options:
        title = (option.get('title') or '').strip()
        if not title:
            continue
        key = slugify(option.get('key') or title)[:50] or 'project'
        if key in keys:
            raise LearningError('Two final project options have the same name.', 'capstoneOptions')
        keys.add(key)
        options.append(
            {'key': key, 'title': title, 'summary': (option.get('summary') or '').strip()}
        )
    course.capstone = {
        'brief': (data.capstone_brief or '').strip(),
        'requirements': _lines(data.capstone_requirements),
        'options': options,
    }


def create_course(user: User | None, data: CourseInput) -> Course:
    _require_manager(user)
    course = Course()
    _apply_course(course, data)
    course.slug = _unique_slug(course.title, lambda s: Course.objects.filter(slug=s).exists())
    course.status = Course.Status.DRAFT
    course.save()
    return course


def update_course(user: User | None, course_id: object, data: CourseInput) -> Course:
    _require_manager(user)
    course = _get(Course, course_id, 'course')
    _apply_course(course, data)
    course.save()
    return course


def set_course_status(user: User | None, course_id: object, status: str) -> Course:
    _require_manager(user)
    course = _get(Course, course_id, 'course')
    if status not in Course.Status.values:
        raise LearningError('Choose draft, published or archived.', field='status')
    if status == Course.Status.PUBLISHED:
        if not Lesson.objects.filter(module__course=course).exists():
            raise LearningError('Add at least one lesson before publishing.', field='status')
        course.published_at = course.published_at or timezone.now()
    course.status = status
    course.save(update_fields=['status', 'published_at', 'updated_at'])
    return course


def delete_course(
    user: User | None, course_id: object, *, force: bool = False, confirm_title: str = ''
) -> int:
    """Delete a course; returns how many learners' enrollments went with it.

    A course learners are enrolled in is refused unless `force` - and then only
    when `confirm_title` is the course's title, typed out: forcing deletes every
    learner's enrollment and, with it, their progress, submissions, quiz
    attempts, final project and certificate. Archiving is the gentle way.
    """
    _require_manager(user)
    course = _get(Course, course_id, 'course')
    enrolled = course.enrollments.count()
    if enrolled and not force:
        raise LearningError(
            'Learners are enrolled in this course, so it cannot be deleted. Archive it instead: '
            'it leaves the catalog and stays open to them. Or delete it for good, with their '
            'progress, by typing its title to confirm.',
            reason='conflict',
        )
    if enrolled and (confirm_title or '').strip() != course.title.strip():
        raise LearningError(
            'Type the course title exactly to delete it with its learners.',
            field='confirmTitle',
        )
    with transaction.atomic():
        for material in LessonMaterial.objects.filter(lesson__module__course=course):
            _delete_material_file(material)
        # Enrollments protect their course; with them go every learner record.
        course.enrollments.all().delete()
        course.delete()
    return enrolled


# --- modules and lessons --------------------------------------------------------------


@dataclass(frozen=True)
class ModuleInput:
    title: str
    summary: str = ''
    objectives: list[str] = field(default_factory=list)
    project: str = ''


def create_module(user: User | None, course_id: object, data: ModuleInput) -> CourseModule:
    _require_manager(user)
    course = _get(Course, course_id, 'course')
    title = _text(data.title, 'title', 'A title')
    position = (course.modules.aggregate(top=Max('position'))['top'] or 0) + 1
    return CourseModule.objects.create(
        course=course,
        position=position,
        slug=_unique_slug(title, lambda s: course.modules.filter(slug=s).exists()),
        title=title,
        summary=(data.summary or '').strip(),
        objectives=_lines(data.objectives),
        project=(data.project or '').strip(),
    )


def update_module(user: User | None, module_id: object, data: ModuleInput) -> CourseModule:
    _require_manager(user)
    module = _get(CourseModule, module_id, 'module')
    module.title = _text(data.title, 'title', 'A title')
    module.summary = (data.summary or '').strip()
    module.objectives = _lines(data.objectives)
    module.project = (data.project or '').strip()
    module.save()
    return module


@transaction.atomic
def _swap(queryset, row, direction: int) -> None:
    """Move `row` one place up (-1) or down (+1) among `queryset`, if it can move."""
    ordered = list(queryset.order_by('position'))
    index = next(i for i, other in enumerate(ordered) if other.pk == row.pk)
    target = index + direction
    if not 0 <= target < len(ordered):
        return
    other = ordered[target]
    first, second = row.position, other.position
    # Out of the way first: (parent, position) is unique, and positions are never negative.
    row.position = 1_000_000 + first
    row.save(update_fields=['position'])
    other.position = first
    other.save(update_fields=['position'])
    row.position = second
    row.save(update_fields=['position'])


def _ids(values: list, label: str) -> list[int]:
    ids = [selectors.parse_id(value) for value in values]
    if -1 in ids or len(set(ids)) != len(ids):
        raise LearningError(f'The new order of the {label} is not valid.', field='ids')
    return ids


@transaction.atomic
def _renumber(rows: list) -> None:
    """Save `rows`, all under one parent, at positions 1..n in that order."""
    # Out of the way first: (parent, position) is unique, and positions are never negative.
    for offset, row in enumerate(rows, start=1):
        row.position = 1_000_000 + offset
        row.save(update_fields=['position'])
    for position, row in enumerate(rows, start=1):
        row.position = position
        row.save(update_fields=['position'])


def reorder_modules(user: User | None, course_id: object, module_ids: list) -> Course:
    """Put a course's modules in the order given: every one of them, each once."""
    _require_manager(user)
    course = _get(Course, course_id, 'course')
    by_id = {module.pk: module for module in course.modules.all()}
    ids = _ids(module_ids, 'modules')
    if set(ids) != set(by_id):
        raise LearningError(
            'The modules changed while you were editing. Reload the page.', reason='conflict'
        )
    _renumber([by_id[pk] for pk in ids])
    return course


@transaction.atomic
def reorder_lessons(user: User | None, module_id: object, lesson_ids: list) -> CourseModule:
    """
    Put a module's lessons in the order given. The list must hold every lesson the
    module has, and may also hold lessons from other modules of the same course,
    which move here (with a new slug if theirs is taken here); the modules they
    leave are renumbered. A moved lesson's exercises stay in their module, so
    they stop pointing at it. Learner progress follows the lesson.
    """
    _require_manager(user)
    module = _get(CourseModule, module_id, 'module')
    ids = _ids(lesson_ids, 'lessons')
    lessons = {
        lesson.pk: lesson
        for lesson in Lesson.objects.select_for_update().filter(
            pk__in=ids, module__course_id=module.course_id
        )
    }
    current = set(module.lessons.values_list('pk', flat=True))
    if len(lessons) != len(ids) or not current <= set(ids):
        raise LearningError(
            'The lessons changed while you were editing. Reload the page.', reason='conflict'
        )
    left = {lesson.module_id for lesson in lessons.values() if lesson.module_id != module.pk}
    moved = [lessons[pk] for pk in ids if lessons[pk].module_id != module.pk]
    if moved:
        CodingExercise.objects.filter(lesson__in=moved).exclude(module=module).update(lesson=None)
        taken = set(module.lessons.values_list('slug', flat=True))
        for offset, lesson in enumerate(moved, start=1):
            lesson.slug = _unique_slug(lesson.slug, taken.__contains__)
            taken.add(lesson.slug)
            lesson.module = module
            lesson.position = 2_000_000 + offset
            lesson.save(update_fields=['module', 'slug', 'position'])
    _renumber([lessons[pk] for pk in ids])
    for source in CourseModule.objects.filter(pk__in=left):
        _renumber(list(source.lessons.order_by('position')))
    return module


def reorder_exercises(user: User | None, module_id: object, exercise_ids: list) -> CourseModule:
    """Put a module's exercises in the order given: every one of them, each once."""
    _require_manager(user)
    module = _get(CourseModule, module_id, 'module')
    by_id = {exercise.pk: exercise for exercise in module.exercises.all()}
    ids = _ids(exercise_ids, 'exercises')
    if set(ids) != set(by_id):
        raise LearningError(
            'The exercises changed while you were editing. Reload the page.', reason='conflict'
        )
    _renumber([by_id[pk] for pk in ids])
    return module


def move_module(user: User | None, module_id: object, direction: int) -> CourseModule:
    _require_manager(user)
    module = _get(CourseModule, module_id, 'module')
    _swap(module.course.modules.all(), module, -1 if direction < 0 else 1)
    return module


def delete_module(user: User | None, module_id: object) -> Course:
    _require_manager(user)
    module = _get(CourseModule, module_id, 'module')
    course = module.course
    for material in LessonMaterial.objects.filter(lesson__module=module):
        _delete_material_file(material)
    module.delete()
    return course


@dataclass(frozen=True)
class LessonInput:
    title: str
    body: str
    summary: str = ''
    objectives: list[str] = field(default_factory=list)
    estimated_minutes: int = 15


def _write_lesson(lesson: Lesson, data: LessonInput) -> Lesson:
    lesson.title = _text(data.title, 'title', 'A title')
    blocks = _blocks(data.body, 'body')
    if not 1 <= data.estimated_minutes <= 600:
        raise LearningError('Minutes must be between 1 and 600.', field='estimatedMinutes')
    lesson.summary = (data.summary or '').strip()
    lesson.objectives = _lines(data.objectives)
    lesson.estimated_minutes = data.estimated_minutes
    lesson.body = data.body.strip('\n')
    with transaction.atomic():
        lesson.save()
        lesson.blocks.all().delete()
        LessonContent.objects.bulk_create(
            LessonContent(
                lesson=lesson,
                position=index,
                kind=block.kind,
                text=block.text,
                language=block.language,
            )
            for index, block in enumerate(blocks, start=1)
        )
    return lesson


def create_lesson(user: User | None, module_id: object, data: LessonInput) -> Lesson:
    _require_manager(user)
    module = _get(CourseModule, module_id, 'module')
    title = _text(data.title, 'title', 'A title')
    lesson = Lesson(
        module=module,
        position=(module.lessons.aggregate(top=Max('position'))['top'] or 0) + 1,
        slug=_unique_slug(title, lambda s: module.lessons.filter(slug=s).exists()),
    )
    return _write_lesson(lesson, data)


def update_lesson(user: User | None, lesson_id: object, data: LessonInput) -> Lesson:
    _require_manager(user)
    return _write_lesson(_get(Lesson, lesson_id, 'lesson'), data)


def move_lesson(user: User | None, lesson_id: object, direction: int) -> Lesson:
    _require_manager(user)
    lesson = _get(Lesson, lesson_id, 'lesson')
    _swap(lesson.module.lessons.all(), lesson, -1 if direction < 0 else 1)
    return lesson


def delete_lesson(user: User | None, lesson_id: object) -> CourseModule:
    _require_manager(user)
    lesson = _get(Lesson, lesson_id, 'lesson')
    module = lesson.module
    for material in lesson.materials.all():
        _delete_material_file(material)
    lesson.delete()
    return module


# --- exercises and quizzes ------------------------------------------------------------


@dataclass(frozen=True)
class TestInput:
    name: str
    expected_output: str
    stdin: str = ''
    call: str = ''
    hidden: bool = False


@dataclass(frozen=True)
class ExerciseInput:
    title: str
    instructions: str
    solution: str
    tests: list[TestInput]
    difficulty: str = CodingExercise.Difficulty.EASY
    lesson_id: object | None = None
    starter_code: str = ''
    hints: list[str] = field(default_factory=list)


def save_exercise(
    user: User | None,
    module_id: object,
    data: ExerciseInput,
    exercise_id: object | None = None,
) -> CodingExercise:
    _require_manager(user)
    module = _get(CourseModule, module_id, 'module')
    if exercise_id is not None:
        exercise = _get(CodingExercise, exercise_id, 'exercise')
        if exercise.module_id != module.pk:
            raise LearningError('That exercise is not in this module.', reason='not_found')
    else:
        exercise = None

    lesson = None
    if data.lesson_id:
        lesson = module.lessons.filter(pk=selectors.parse_id(data.lesson_id)).first()
        if lesson is None:
            raise LearningError('Choose a lesson from this module.', field='lessonId')

    title = _text(data.title, 'title', 'A title')
    as_file = {
        'slug': 'x',
        'title': title,
        'instructions': data.instructions,
        'solution': data.solution,
        'difficulty': data.difficulty,
        'tests': [
            {'name': test.name.strip(), 'expected': test.expected_output} for test in data.tests
        ],
    }
    try:
        check_exercise(as_file, 'The exercise', set())
    except ContentError as exc:
        raise LearningError(str(exc).removeprefix('The exercise: '), field='exercise') from exc
    if not any(test.hidden for test in data.tests) or all(test.hidden for test in data.tests):
        raise LearningError(
            'Give at least one visible test (an example) and one hidden test, so a learner '
            'cannot pass by matching the example.',
            field='tests',
        )

    with transaction.atomic():
        if exercise is None:
            exercise = CodingExercise(
                module=module,
                position=(module.exercises.aggregate(top=Max('position'))['top'] or 0) + 1,
                slug=_unique_slug(title, lambda s: module.exercises.filter(slug=s).exists()),
            )
        exercise.title = title
        exercise.lesson = lesson
        exercise.difficulty = data.difficulty
        exercise.instructions_source = data.instructions.strip('\n')
        exercise.instructions = [block.as_dict() for block in _blocks(data.instructions, 'x')]
        exercise.starter_code = data.starter_code.strip('\n') + '\n' if data.starter_code else ''
        exercise.solution_code = data.solution.strip('\n') + '\n'
        exercise.hints = _lines(data.hints)
        exercise.save()
        exercise.test_cases.all().delete()
        ExerciseTestCase.objects.bulk_create(
            ExerciseTestCase(
                exercise=exercise,
                position=index,
                name=test.name.strip(),
                stdin=test.stdin,
                call=test.call.strip(),
                expected_output=test.expected_output,
                is_hidden=test.hidden,
            )
            for index, test in enumerate(data.tests, start=1)
        )
    return exercise


def delete_exercise(user: User | None, exercise_id: object) -> CourseModule:
    _require_manager(user)
    exercise = _get(CodingExercise, exercise_id, 'exercise')
    module = exercise.module
    exercise.delete()
    return module


@dataclass(frozen=True)
class OptionInput:
    text: str
    correct: bool = False


@dataclass(frozen=True)
class QuestionInput:
    prompt: str
    options: list[OptionInput]
    kind: str = Question.Kind.SINGLE
    code: str = ''
    explanation: str = ''


def save_quiz(
    user: User | None,
    module_id: object,
    title: str,
    pass_percentage: int,
    questions: list[QuestionInput],
) -> Quiz:
    _require_manager(user)
    module = _get(CourseModule, module_id, 'module')
    title = _text(title, 'title', 'A title')
    if not 1 <= pass_percentage <= 100:
        raise LearningError('The pass mark must be between 1 and 100%.', 'passPercentage')
    if not questions:
        raise LearningError('Add at least one question.', field='questions')
    for number, question in enumerate(questions, start=1):
        try:
            check_question(
                {
                    'prompt': question.prompt,
                    'kind': question.kind,
                    'options': [option.text for option in question.options],
                    'correct': [i for i, option in enumerate(question.options) if option.correct],
                },
                f'Question {number}',
            )
        except ContentError as exc:
            raise LearningError(str(exc), field='questions') from exc

    with transaction.atomic():
        quiz, _ = Quiz.objects.update_or_create(
            module=module, defaults={'title': title, 'pass_percentage': pass_percentage}
        )
        quiz.questions.all().delete()
        for position, question in enumerate(questions, start=1):
            row = Question.objects.create(
                quiz=quiz,
                position=position,
                prompt=question.prompt.strip(),
                code=question.code.strip('\n'),
                kind=question.kind,
                explanation=question.explanation.strip(),
            )
            AnswerOption.objects.bulk_create(
                AnswerOption(
                    question=row,
                    position=index,
                    text=option.text.strip(),
                    is_correct=option.correct,
                )
                for index, option in enumerate(question.options, start=1)
            )
    return quiz


def delete_quiz(user: User | None, module_id: object) -> CourseModule:
    _require_manager(user)
    module = _get(CourseModule, module_id, 'module')
    Quiz.objects.filter(module=module).delete()
    return module


# --- lesson files ---------------------------------------------------------------------


def authorize_material_upload(user: User | None, lesson_id: object) -> Lesson:
    """Refuse before the request body is read, the same as attachment uploads."""
    _require_manager(user)
    return _get(Lesson, lesson_id, 'lesson')


# What the console's "Upload PDFs" writes into each lesson it creates
# (frontend PdfUploadDialog.tsx): a stand-in until the PDF's own notes replace it.
PDF_PLACEHOLDER_BODY = (
    'The notes for this lesson are in the attached PDF. Open or download it below.'
)


def lesson_has_notes(lesson: Lesson) -> bool:
    """Whether the lesson has notes someone wrote (the PDF stand-in does not count)."""
    body = lesson.body.strip()
    if body == PDF_PLACEHOLDER_BODY:
        return False
    return bool(body) or lesson.blocks.exists()


def write_notes_from_pdf(lesson: Lesson, data: bytes) -> int:
    """Give a lesson with no notes the notes in a PDF (`learning.pdf_import`).

    Returns how many lessons were written: 0, 1, or more when the PDF is a whole
    course guide - its first part goes into this lesson, and each further part
    ("Week 1 - ...") becomes a lesson of its own right after it, in the same
    module, so the outline lists them and each opens on its own.

    A lesson that has notes is never touched - an administrator's writing always
    wins - and a PDF with no readable text (a scan) leaves the lesson as it was.
    Details the lesson already has (title, summary, objectives) are kept.
    """
    if lesson_has_notes(lesson):
        return 0
    parts = pdf_import.lessons_from_pdf(data, title=lesson.title)
    if not parts:
        return 0
    first, *more = parts
    try:
        with transaction.atomic():
            _write_lesson(
                lesson,
                LessonInput(
                    title=lesson.title,
                    body=first.body,
                    summary=lesson.summary or first.summary,
                    objectives=lesson.objectives or first.objectives,
                    estimated_minutes=first.estimated_minutes,
                ),
            )
            _make_room_after(lesson, len(more))
            for offset, part in enumerate(more, start=1):
                _write_lesson(
                    Lesson(
                        module=lesson.module,
                        position=lesson.position + offset,
                        slug=_unique_slug(
                            part.title, lambda s: lesson.module.lessons.filter(slug=s).exists()
                        ),
                    ),
                    LessonInput(
                        title=part.title,
                        body=part.body,
                        summary=part.summary,
                        objectives=part.objectives,
                        estimated_minutes=part.estimated_minutes,
                    ),
                )
    except LearningError:
        logger.warning('PDF notes for lesson %s could not be saved', lesson.pk, exc_info=True)
        return 0
    return len(parts)


def rebuild_first_converter_notes(lesson: Lesson, data: bytes) -> int:
    """Replace notes the first PDF converter wrote, untouched since, with today's.

    The first converter (`learning.pdf_import_v1`, frozen) made a whole course
    guide one long lesson. A lesson whose notes are still exactly what it makes
    from this PDF was never edited - any change by an administrator breaks the
    match, and such a lesson is left alone. Those notes are cleared (with the
    summary and objectives when they are the converter's too) and written again
    by `write_notes_from_pdf`, so a guide becomes its lessons. Returns how many
    lessons were written; 0 when the notes are not the first converter's.
    """
    if not lesson_has_notes(lesson):
        return 0
    first = pdf_import_v1.lesson_from_pdf(data, title=lesson.title)
    if first is None or lesson.body.strip() != first.body.strip():
        return 0
    current = pdf_import.lessons_from_pdf(data, title=lesson.title)
    if not current or (len(current) == 1 and current[0].body.strip() == first.body.strip()):
        return 0  # today's converter makes the same notes: nothing to rebuild
    with transaction.atomic():
        lesson.body = PDF_PLACEHOLDER_BODY
        if lesson.summary.strip() == first.summary.strip():
            lesson.summary = ''
        if list(lesson.objectives) == list(first.objectives):
            lesson.objectives = []
        lesson.save(update_fields=['body', 'summary', 'objectives'])
        lesson.blocks.all().delete()
        return write_notes_from_pdf(lesson, data)


def _make_room_after(lesson: Lesson, count: int) -> None:
    """Move the lessons after `lesson` down by `count` places, last first (positions are unique)."""
    if not count:
        return
    for later in lesson.module.lessons.filter(position__gt=lesson.position).order_by('-position'):
        later.position += count
        later.save(update_fields=['position'])


def upload_material(
    user: User | None, lesson_id: object, uploaded, title: str = ''
) -> LessonMaterial:
    """Attach a file to a lesson. A PDF on a lesson with no notes also writes its notes:
    `material.lessons_written` says into how many lessons (0 when it did not)."""
    user = _require_manager(user)
    lesson = _get(Lesson, lesson_id, 'lesson')

    try:
        filename = file_rules.safe_display_filename(uploaded.name)
        extension = PurePosixPath(filename).suffix.lower()
        if extension not in MATERIAL_TYPES:
            raise file_rules.AttachmentValidationError(
                'Upload a PDF, Word, PowerPoint, Excel, CSV, text, Python or image file.'
            )
        file_rules.validate_size(uploaded.size)
        head = uploaded.read(file_rules.SNIFF_BYTES)
        uploaded.seek(0)
        file_rules.validate_content(extension, head)
        signature = _EXTRA_SIGNATURES.get(extension)
        if signature and not head.startswith(signature):
            raise file_rules.AttachmentValidationError('The file contents do not match its type.')
    except file_rules.AttachmentValidationError as exc:
        raise LearningError(exc.message, field='file') from exc

    # Read before the file goes to storage, which may consume it.
    pdf_bytes = None
    if extension == '.pdf' and not lesson_has_notes(lesson):
        pdf_bytes = uploaded.read()
        uploaded.seek(0)

    key = f'learning/{lesson.module.course_id}/{uuid.uuid4().hex}{extension}'
    try:
        saved_key = storage.save_object(key, uploaded)
    except storage.AttachmentStorageError as exc:
        raise LearningError(
            'The file could not be stored. Please try again.', reason='storage_unavailable'
        ) from exc
    try:
        material = LessonMaterial.objects.create(
            lesson=lesson,
            title=(title or '').strip()[:TITLE_MAX_LENGTH] or PurePosixPath(filename).stem,
            filename=filename,
            content_type=MATERIAL_TYPES[extension],
            size=uploaded.size,
            storage_key=saved_key,
            uploaded_by=user,
        )
    except DatabaseError:
        storage.delete_object(saved_key)
        raise
    material.lessons_written = write_notes_from_pdf(lesson, pdf_bytes) if pdf_bytes else 0
    return material


def _delete_material_file(material: LessonMaterial) -> None:
    key = material.storage_key
    transaction.on_commit(lambda: storage.delete_object(key))


def delete_material(user: User | None, material_id: object) -> Lesson:
    _require_manager(user)
    material = _get(LessonMaterial, material_id, 'file')
    lesson = material.lesson
    with transaction.atomic():
        _delete_material_file(material)
        material.delete()
    return lesson


def readable_material(user: User | None, material_id: object) -> LessonMaterial | None:
    """A file `user` may download: its lesson is one they can open. None otherwise."""
    material = (
        LessonMaterial.objects.filter(pk=selectors.parse_id(material_id))
        .select_related('lesson')
        .first()
    )
    if material is None or selectors.get_lesson(user, material.lesson_id) is None:
        return None
    return material


# --- external resources ---------------------------------------------------------------

DESCRIPTION_MAX_LENGTH = 1000
# Enough for a site's header and menu bars, not enough to hide most of a page.
CROP_TOP_MAX = 400


@dataclass(frozen=True)
class ResourceInput:
    title: str
    url: str
    description: str = ''
    kind: str = LessonResource.Kind.EMBED
    # None: after the lesson's other resources.
    display_order: int | None = None
    is_published: bool = False
    # Pixels of the page's top the frame hides; 0 shows the whole page.
    crop_top: int = 0


def resource_url(value: str) -> str:
    """`value` as a safe web address (`learning.resource_urls`), or a `LearningError`."""
    try:
        return check_resource_url(value)
    except ValueError as exc:
        raise LearningError(str(exc), field='url') from None


def _write_resource(resource: LessonResource, data: ResourceInput) -> LessonResource:
    resource.title = _text(data.title, 'title', 'A title')
    resource.description = (data.description or '').strip()
    if len(resource.description) > DESCRIPTION_MAX_LENGTH:
        raise LearningError(
            f'The description must be {DESCRIPTION_MAX_LENGTH} characters or fewer.',
            field='description',
        )
    resource.url = resource_url(data.url)
    if data.kind not in LessonResource.Kind.values:
        raise LearningError('Choose how the page is shown.', field='kind')
    resource.kind = data.kind
    if data.display_order is not None:
        if not 1 <= data.display_order <= 999:
            raise LearningError('Display order must be between 1 and 999.', field='displayOrder')
        resource.position = data.display_order
    elif resource.pk is None:
        top = resource.lesson.resources.aggregate(top=Max('position'))['top'] or 0
        resource.position = top + 1
    if not 0 <= data.crop_top <= CROP_TOP_MAX:
        raise LearningError(
            f'Hide between 0 and {CROP_TOP_MAX} pixels of the top.', field='cropTop'
        )
    resource.crop_top = data.crop_top
    resource.is_published = data.is_published
    resource.save()
    return resource


def create_resource(user: User | None, lesson_id: object, data: ResourceInput) -> LessonResource:
    user = _require_manager(user)
    lesson = _get(Lesson, lesson_id, 'lesson')
    return _write_resource(LessonResource(lesson=lesson, created_by=user), data)


def update_resource(user: User | None, resource_id: object, data: ResourceInput) -> LessonResource:
    _require_manager(user)
    return _write_resource(_get(LessonResource, resource_id, 'resource'), data)


def set_resource_published(
    user: User | None, resource_id: object, published: bool
) -> LessonResource:
    _require_manager(user)
    resource = _get(LessonResource, resource_id, 'resource')
    resource.is_published = published
    resource.save(update_fields=['is_published', 'updated_at'])
    return resource


def delete_resource(user: User | None, resource_id: object) -> Lesson:
    _require_manager(user)
    resource = _get(LessonResource, resource_id, 'resource')
    lesson = resource.lesson
    resource.delete()
    return lesson
