"""
What a learner may read, and their progress - computed, never stored twice.

Visibility, in one place:

- A **published** course is in the catalog for every signed-in user.
- An **archived** course leaves the catalog but stays open to the learners
  already enrolled in it, so nobody loses a course they were taking.
- A **draft** is visible only to course managers (`can_manage_courses` in the
  administration console) - as is everything else.

A course's overview is readable by anybody who can see the course; its lessons,
exercises and quizzes need an enrollment. Every lookup by id answers None for
"does not exist" and "not yours" alike, so ids cannot be used to probe drafts.

Progress is derived from the rows that record it (`LessonProgress`,
`ExerciseSubmission`, `AssessmentAttempt`, ...) in a fixed number of queries per
enrollment - never one per lesson.
"""

from dataclasses import dataclass, field

from django.db.models import Count, Max, Prefetch, Q

from administration.authorization import capabilities_for
from identity.models import User
from learning.models import (
    AssessmentAttempt,
    CapstoneSubmission,
    CodingExercise,
    Course,
    CourseCompletion,
    CourseModule,
    Enrollment,
    ExerciseSubmission,
    Lesson,
    LessonProgress,
    Question,
    Quiz,
)


def _active(user: User | None) -> User | None:
    return user if user is not None and user.is_active else None


def can_manage_courses(user: User | None) -> bool:
    """A course manager: console access and the courses permission (see administration)."""
    return capabilities_for(user).can_manage_courses


def visible_courses(user: User | None):
    user = _active(user)
    if user is None:
        return Course.objects.none()
    if can_manage_courses(user):
        return Course.objects.all()
    return Course.objects.filter(
        Q(status=Course.Status.PUBLISHED) | Q(status=Course.Status.ARCHIVED, enrollments__user=user)
    ).distinct()


def list_courses(user: User | None, *, search: str = '', level: str = ''):
    """The catalog: published courses (and, for a manager, drafts), with their sizes."""
    courses = visible_courses(user).exclude(status=Course.Status.ARCHIVED)
    if search.strip():
        term = search.strip()
        courses = courses.filter(
            Q(title__icontains=term) | Q(subtitle__icontains=term) | Q(description__icontains=term)
        )
    if level:
        courses = courses.filter(level=level)
    return courses.annotate(
        module_count=Count('modules', distinct=True),
        lesson_count=Count('modules__lessons', distinct=True),
    ).order_by('title')


def _curriculum():
    return Prefetch(
        'modules',
        queryset=CourseModule.objects.order_by('position').prefetch_related(
            Prefetch('lessons', queryset=Lesson.objects.order_by('position')),
            Prefetch('exercises', queryset=CodingExercise.objects.order_by('position')),
            Prefetch(
                'quiz',
                queryset=Quiz.objects.annotate(question_count=Count('questions')),
            ),
        ),
    )


def get_course(user: User | None, slug: str) -> Course | None:
    return visible_courses(user).filter(slug=slug).prefetch_related(_curriculum()).first()


def get_enrollment(user: User | None, course: Course) -> Enrollment | None:
    user = _active(user)
    if user is None:
        return None
    return Enrollment.objects.filter(user=user, course=course).first()


def _readable_course_ids(user: User | None):
    """Courses whose lessons `user` may open: enrolled and visible, or any for a manager."""
    user = _active(user)
    if user is None:
        return Course.objects.none().values('pk')
    if can_manage_courses(user):
        return Course.objects.values('pk')
    return visible_courses(user).filter(enrollments__user=user).values('pk')


def get_lesson(user: User | None, lesson_id: object) -> Lesson | None:
    return (
        Lesson.objects.filter(pk=parse_id(lesson_id), module__course__in=_readable_course_ids(user))
        .select_related('module__course')
        .prefetch_related('blocks', 'exercises', 'materials')
        .first()
    )


def get_exercise(user: User | None, exercise_id: object) -> CodingExercise | None:
    return (
        CodingExercise.objects.filter(
            pk=parse_id(exercise_id), module__course__in=_readable_course_ids(user)
        )
        .select_related('module__course', 'lesson')
        .prefetch_related('test_cases')
        .first()
    )


def get_quiz(user: User | None, quiz_id: object) -> Quiz | None:
    return (
        Quiz.objects.filter(pk=parse_id(quiz_id), module__course__in=_readable_course_ids(user))
        .select_related('module__course')
        .prefetch_related(
            Prefetch('questions', queryset=Question.objects.prefetch_related('options'))
        )
        .first()
    )


def parse_id(value: object) -> int:
    """An id from the API as an int, or -1 (which matches nothing) when it is not one."""
    try:
        return int(str(value))
    except (TypeError, ValueError):
        return -1


def course_lessons(course: Course) -> list[Lesson]:
    """Every lesson of `course`, in reading order."""
    return list(
        Lesson.objects.filter(module__course=course)
        .select_related('module')
        .order_by('module__position', 'position')
    )


# --- progress -------------------------------------------------------------------------


@dataclass
class Progress:
    completed_lesson_ids: set[int] = field(default_factory=set)
    passed_exercise_ids: set[int] = field(default_factory=set)
    attempted_exercise_ids: set[int] = field(default_factory=set)
    best_quiz_percentages: dict[int, int] = field(default_factory=dict)
    passed_quiz_ids: set[int] = field(default_factory=set)
    capstone: CapstoneSubmission | None = None
    completion: CourseCompletion | None = None
    total_lessons: int = 0
    total_exercises: int = 0
    total_quizzes: int = 0

    @property
    def percent(self) -> int:
        """Lessons, quizzes and the capstone - the parts that complete a course."""
        steps = self.total_lessons + self.total_quizzes + 1
        done = (
            len(self.completed_lesson_ids)
            + len(self.passed_quiz_ids)
            + (1 if self.capstone is not None else 0)
        )
        return round(100 * done / steps) if steps else 0


def progress_for(enrollment: Enrollment) -> Progress:
    course_id = enrollment.course_id
    progress = Progress(
        completed_lesson_ids=set(
            LessonProgress.objects.filter(enrollment=enrollment).values_list('lesson_id', flat=True)
        ),
        total_lessons=Lesson.objects.filter(module__course_id=course_id).count(),
        total_exercises=CodingExercise.objects.filter(module__course_id=course_id).count(),
        total_quizzes=Quiz.objects.filter(module__course_id=course_id).count(),
    )

    for exercise_id, status in (
        ExerciseSubmission.objects.filter(enrollment=enrollment)
        .values_list('exercise_id', 'status')
        .distinct()
    ):
        progress.attempted_exercise_ids.add(exercise_id)
        if status == ExerciseSubmission.Status.PASSED:
            progress.passed_exercise_ids.add(exercise_id)

    for row in (
        AssessmentAttempt.objects.filter(enrollment=enrollment)
        .values('quiz_id')
        .annotate(best=Max('percentage'), passed=Count('pk', filter=Q(passed=True)))
    ):
        progress.best_quiz_percentages[row['quiz_id']] = row['best']
        if row['passed']:
            progress.passed_quiz_ids.add(row['quiz_id'])

    progress.capstone = CapstoneSubmission.objects.filter(enrollment=enrollment).first()
    progress.completion = CourseCompletion.objects.filter(enrollment=enrollment).first()
    return progress


def next_lesson(enrollment: Enrollment, progress: Progress) -> Lesson | None:
    """The first lesson, in reading order, the learner has not completed."""
    for lesson in course_lessons(enrollment.course):
        if lesson.pk not in progress.completed_lesson_ids:
            return lesson
    return None


def my_enrollments(user: User | None):
    user = _active(user)
    if user is None:
        return Enrollment.objects.none()
    return (
        Enrollment.objects.filter(user=user)
        .select_related('course')
        .exclude(course__status=Course.Status.DRAFT)
        .order_by('-last_activity_at')
    )


def exercise_submissions(enrollment: Enrollment, exercise: CodingExercise, limit: int = 20):
    return ExerciseSubmission.objects.filter(enrollment=enrollment, exercise=exercise)[:limit]


def quiz_attempts(enrollment: Enrollment, quiz: Quiz, limit: int = 20):
    return AssessmentAttempt.objects.filter(enrollment=enrollment, quiz=quiz)[:limit]


@dataclass(frozen=True)
class Activity:
    kind: str
    title: str
    course_slug: str
    course_title: str
    at: object
    detail: str = ''


def recent_activity(user: User | None, limit: int = 12) -> list[Activity]:
    """The learner's latest lessons, exercise submissions and quiz attempts, newest first."""
    user = _active(user)
    if user is None:
        return []
    activity = [
        Activity(
            'lesson',
            row.lesson.title,
            row.enrollment.course.slug,
            row.enrollment.course.title,
            row.completed_at,
            'Lesson completed',
        )
        for row in LessonProgress.objects.filter(enrollment__user=user)
        .select_related('lesson', 'enrollment__course')
        .order_by('-completed_at')[:limit]
    ]
    activity += [
        Activity(
            'exercise',
            row.exercise.title,
            row.enrollment.course.slug,
            row.enrollment.course.title,
            row.created_at,
            f'{row.passed_count}/{row.total_count} tests passed',
        )
        for row in ExerciseSubmission.objects.filter(enrollment__user=user)
        .select_related('exercise', 'enrollment__course')
        .order_by('-created_at')[:limit]
    ]
    activity += [
        Activity(
            'quiz',
            row.quiz.title,
            row.enrollment.course.slug,
            row.enrollment.course.title,
            row.created_at,
            f'{row.percentage}% - {"passed" if row.passed else "not passed"}',
        )
        for row in AssessmentAttempt.objects.filter(enrollment__user=user)
        .select_related('quiz', 'enrollment__course')
        .order_by('-created_at')[:limit]
    ]
    return sorted(activity, key=lambda item: item.at, reverse=True)[:limit]
