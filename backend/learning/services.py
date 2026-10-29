"""
Learning operations, in the project's `(message, field, reason)` shape.

Every write starts from the learner's own enrollment, found through
`learning.selectors` - so a learner only ever records progress in a course they
are enrolled in and can see, and only ever their own.

Code is run and graded through `learning.execution` (an isolated sandbox) and
`learning.grading` (server-side comparison). Both are rate limited per learner:
a run costs the sandbox real CPU, and a script resubmitting in a loop is the
cheapest way to make it cost a lot.

A course is complete when every lesson is completed, every module quiz has been
passed and the capstone has been submitted - see `completion_gaps`. Exercises
are practice: they count toward progress but do not gate completion, so a
platform without a configured sandbox can still be finished.
"""

from dataclasses import dataclass
from urllib.parse import urlsplit

from django.db import IntegrityError, transaction
from django.utils import timezone

from identity.models import User
from identity.throttling import ThrottledError, ThrottlePolicy, register_attempt
from learning import execution, grading, selectors
from learning.models import (
    CODE_MAX_LENGTH,
    AssessmentAttempt,
    CapstoneSubmission,
    CodingExercise,
    Course,
    CourseCompletion,
    Enrollment,
    ExerciseSubmission,
    LessonProgress,
    Question,
)

STDIN_MAX_LENGTH = 5_000
CAPSTONE_TEXT_MIN_LENGTH = 80
CAPSTONE_TEXT_MAX_LENGTH = 5_000

RUN_PER_LEARNER = ThrottlePolicy('learning.run', limit=30, window_seconds=60)
SUBMIT_PER_LEARNER = ThrottlePolicy('learning.submit', limit=10, window_seconds=60)


class LearningError(Exception):
    def __init__(self, message: str, field: str | None = None, reason: str = 'forbidden'):
        super().__init__(message)
        self.message = message
        self.field = field
        self.reason = reason


def _require_active_user(user: User | None) -> User:
    if user is None or not user.is_active:
        raise LearningError('Sign in to continue learning.', reason='unauthenticated')
    return user


def _enrollment_for(user: User, course: Course) -> Enrollment:
    enrollment = selectors.get_enrollment(user, course)
    if enrollment is None:
        raise LearningError('Enroll in this course first.', reason='not_enrolled')
    return enrollment


def _touch(enrollment: Enrollment) -> None:
    Enrollment.objects.filter(pk=enrollment.pk).update(last_activity_at=timezone.now())


def _throttle(policy: ThrottlePolicy, user: User) -> None:
    try:
        register_attempt(policy, str(user.pk))
    except ThrottledError:
        raise LearningError(
            'You are going a little fast. Wait a minute, then try again.', reason='throttled'
        ) from None


def _check_code(code: str) -> str:
    if not code.strip():
        raise LearningError('Write some code first.', field='code')
    if len(code) > CODE_MAX_LENGTH:
        raise LearningError(f'Code must be {CODE_MAX_LENGTH:,} characters or fewer.', field='code')
    return code


# --- enrolling and lessons ------------------------------------------------------------


def enroll(user: User | None, course_id: object) -> Enrollment:
    user = _require_active_user(user)
    course = selectors.visible_courses(user).filter(pk=selectors.parse_id(course_id)).first()
    if course is None:
        raise LearningError('That course is not available.', reason='not_found')

    existing = selectors.get_enrollment(user, course)
    if existing is not None:
        return existing
    if course.status != Course.Status.PUBLISHED:
        raise LearningError('This course is not open for enrollment.', reason='closed')
    try:
        with transaction.atomic():
            return Enrollment.objects.create(user=user, course=course)
    except IntegrityError:
        # Two clicks at once: the other request enrolled first.
        return Enrollment.objects.get(user=user, course=course)


def complete_lesson(user: User | None, lesson_id: object) -> LessonProgress:
    user = _require_active_user(user)
    lesson = selectors.get_lesson(user, lesson_id)
    if lesson is None:
        raise LearningError('That lesson is not available.', reason='not_found')
    enrollment = _enrollment_for(user, lesson.module.course)
    progress, _ = LessonProgress.objects.get_or_create(enrollment=enrollment, lesson=lesson)
    _touch(enrollment)
    return progress


# --- code -----------------------------------------------------------------------------


def _exercise_for(user: User, exercise_id: object) -> tuple[CodingExercise, Enrollment]:
    exercise = selectors.get_exercise(user, exercise_id)
    if exercise is None:
        raise LearningError('That exercise is not available.', reason='not_found')
    return exercise, _enrollment_for(user, exercise.module.course)


def run_code(
    user: User | None, exercise_id: object, code: str, stdin: str = ''
) -> execution.ExecutionResult:
    """Run the learner's code as-is in the sandbox, with their own input. Nothing is graded."""
    user = _require_active_user(user)
    _, enrollment = _exercise_for(user, exercise_id)
    _check_code(code)
    if len(stdin) > STDIN_MAX_LENGTH:
        raise LearningError(f'Input must be {STDIN_MAX_LENGTH:,} characters or fewer.', 'stdin')
    _throttle(RUN_PER_LEARNER, user)
    try:
        result = execution.executor().run(code, stdin)
    except execution.ExecutionUnavailable as exc:
        raise LearningError(str(exc), reason='execution_unavailable') from exc
    _touch(enrollment)
    return result


def submit_exercise(user: User | None, exercise_id: object, code: str) -> ExerciseSubmission:
    """Grade the learner's code against every test, hidden ones included, and record it."""
    user = _require_active_user(user)
    exercise, enrollment = _exercise_for(user, exercise_id)
    _check_code(code)
    _throttle(SUBMIT_PER_LEARNER, user)
    try:
        runner = execution.executor()
        result = grading.grade(code, exercise.test_cases.all(), runner.run)
    except execution.ExecutionUnavailable as exc:
        raise LearningError(str(exc), reason='execution_unavailable') from exc

    submission = ExerciseSubmission.objects.create(
        enrollment=enrollment,
        exercise=exercise,
        code=code,
        status=ExerciseSubmission.Status.PASSED
        if result.passed
        else ExerciseSubmission.Status.FAILED,
        passed_count=result.passed_count,
        total_count=len(result.results),
        results=[test.as_dict() for test in result.results],
    )
    _touch(enrollment)
    return submission


def unlocked_hints(enrollment: Enrollment | None, exercise: CodingExercise) -> list[str]:
    """The first hint is always open; each failed submission opens the next."""
    if enrollment is None:
        return exercise.hints[:1]
    failures = ExerciseSubmission.objects.filter(
        enrollment=enrollment, exercise=exercise, status=ExerciseSubmission.Status.FAILED
    ).count()
    return exercise.hints[: 1 + failures]


# --- quizzes --------------------------------------------------------------------------


@dataclass(frozen=True)
class QuestionResult:
    question_id: int
    correct: bool
    explanation: str


@dataclass(frozen=True)
class QuizOutcome:
    attempt: AssessmentAttempt
    questions: list[QuestionResult]


def submit_quiz(user: User | None, quiz_id: object, answers: dict[str, list[str]]) -> QuizOutcome:
    """
    Score one attempt. A question is right only when exactly its correct options
    are chosen; an unanswered question is wrong. The learner gets back which
    questions were right and their explanations - not the correct options, so a
    retry is still a test.
    """
    user = _require_active_user(user)
    quiz = selectors.get_quiz(user, quiz_id)
    if quiz is None:
        raise LearningError('That quiz is not available.', reason='not_found')
    enrollment = _enrollment_for(user, quiz.module.course)

    questions = list(quiz.questions.all())
    known = {str(question.pk) for question in questions}
    if set(answers) - known:
        raise LearningError('An answer refers to a question not in this quiz.', field='answers')

    recorded: dict[str, list[int]] = {}
    results = []
    for question in questions:
        options = {str(option.pk): option for option in question.options.all()}
        chosen = answers.get(str(question.pk), [])
        if set(chosen) - set(options):
            raise LearningError('An answer refers to an option not in its question.', 'answers')
        if question.kind == Question.Kind.SINGLE and len(chosen) > 1:
            raise LearningError('Choose one answer for each single-answer question.', 'answers')
        selected = {int(pk) for pk in chosen}
        correct = {option.pk for option in options.values() if option.is_correct}
        recorded[str(question.pk)] = sorted(selected)
        results.append(QuestionResult(question.pk, selected == correct, question.explanation))

    score = sum(1 for result in results if result.correct)
    percentage = round(100 * score / len(results)) if results else 0
    attempt = AssessmentAttempt.objects.create(
        enrollment=enrollment,
        quiz=quiz,
        answers=recorded,
        score=score,
        max_score=len(results),
        percentage=percentage,
        passed=percentage >= quiz.pass_percentage,
    )
    _touch(enrollment)
    return QuizOutcome(attempt=attempt, questions=results)


# --- capstone and completion ----------------------------------------------------------


@dataclass(frozen=True)
class CapstoneInput:
    option: str
    repository_url: str
    documentation_url: str
    how_to_run: str
    design_decisions: str


def _https_url(value: str, field: str, *, required: bool) -> str:
    value = value.strip()
    if not value and not required:
        return ''
    parts = urlsplit(value)
    if parts.scheme != 'https' or not parts.hostname:
        raise LearningError('Give a full https:// link.', field=field)
    return value


def _long_text(value: str, field: str, label: str) -> str:
    value = value.strip()
    if len(value) < CAPSTONE_TEXT_MIN_LENGTH:
        raise LearningError(
            f'{label} needs at least {CAPSTONE_TEXT_MIN_LENGTH} characters.', field=field
        )
    if len(value) > CAPSTONE_TEXT_MAX_LENGTH:
        raise LearningError(
            f'{label} must be {CAPSTONE_TEXT_MAX_LENGTH:,} characters or fewer.', field=field
        )
    return value


def submit_capstone(
    user: User | None, course_id: object, data: CapstoneInput
) -> CapstoneSubmission:
    user = _require_active_user(user)
    course = selectors.visible_courses(user).filter(pk=selectors.parse_id(course_id)).first()
    if course is None:
        raise LearningError('That course is not available.', reason='not_found')
    enrollment = _enrollment_for(user, course)

    options = {option.get('key') for option in course.capstone.get('options', [])}
    if data.option not in options:
        raise LearningError('Choose one of the final project options.', field='option')

    submission, _ = CapstoneSubmission.objects.update_or_create(
        enrollment=enrollment,
        defaults={
            'option': data.option,
            'repository_url': _https_url(data.repository_url, 'repositoryUrl', required=True),
            'documentation_url': _https_url(
                data.documentation_url, 'documentationUrl', required=False
            ),
            'how_to_run': _long_text(data.how_to_run, 'howToRun', 'How to run it'),
            'design_decisions': _long_text(
                data.design_decisions, 'designDecisions', 'Your design decisions'
            ),
        },
    )
    _touch(enrollment)
    return submission


def completion_gaps(enrollment: Enrollment) -> list[str]:
    """What is still needed to complete the course; empty when it can be completed."""
    progress = selectors.progress_for(enrollment)
    gaps = []
    remaining_lessons = progress.total_lessons - len(progress.completed_lesson_ids)
    if remaining_lessons:
        gaps.append(
            f'{remaining_lessons} lesson{"s" if remaining_lessons != 1 else ""} to complete'
        )
    remaining_quizzes = progress.total_quizzes - len(progress.passed_quiz_ids)
    if remaining_quizzes:
        gaps.append(f'{remaining_quizzes} quiz{"zes" if remaining_quizzes != 1 else ""} to pass')
    if progress.capstone is None:
        gaps.append('the final project to submit')
    return gaps


def complete_course(user: User | None, course_id: object) -> CourseCompletion:
    user = _require_active_user(user)
    course = selectors.visible_courses(user).filter(pk=selectors.parse_id(course_id)).first()
    if course is None:
        raise LearningError('That course is not available.', reason='not_found')
    enrollment = _enrollment_for(user, course)

    existing = CourseCompletion.objects.filter(enrollment=enrollment).first()
    if existing is not None:
        return existing
    gaps = completion_gaps(enrollment)
    if gaps:
        raise LearningError('Not finished yet: ' + ', '.join(gaps) + '.', reason='incomplete')
    try:
        with transaction.atomic():
            completion = CourseCompletion.objects.create(enrollment=enrollment)
    except IntegrityError:
        completion = CourseCompletion.objects.get(enrollment=enrollment)
    _touch(enrollment)
    return completion
