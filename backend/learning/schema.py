"""
The Learning GraphQL adapter: courses, lessons, exercises, quizzes, progress.

Every type is built field by field in `from_model`, never generated from a model,
so what a learner must not see has no way into a response: an exercise's
`solution_code`, its hidden tests, every test's expected output before a
submission, and which quiz answers are correct. Authorization and visibility live
in `learning.selectors` and `learning.services`; a lookup the caller may not make
resolves to null, the same as one that does not exist.
"""

import strawberry
from django.core.exceptions import ObjectDoesNotExist

from learning import execution, selectors, services
from learning.models import (
    AssessmentAttempt,
    CapstoneSubmission,
    CodingExercise,
    Course,
    CourseModule,
    Enrollment,
    ExerciseSubmission,
    Lesson,
    LessonResource,
    Quiz,
)


def _id(pk: int) -> strawberry.ID:
    return strawberry.ID(str(pk))


def _module_quiz(module: CourseModule) -> Quiz | None:
    try:
        return module.quiz
    except ObjectDoesNotExist:
        return None


@strawberry.type(description='One block of a lesson or of exercise instructions.')
class ContentBlockType:
    kind: str
    text: str
    language: str

    @staticmethod
    def from_dict(block: dict) -> 'ContentBlockType':
        return ContentBlockType(
            kind=block['kind'], text=block['text'], language=block.get('language', '')
        )


@strawberry.type(description='How far you are through a course.')
class ProgressType:
    completed_lessons: int
    total_lessons: int
    passed_exercises: int
    total_exercises: int
    passed_quizzes: int
    total_quizzes: int
    capstone_submitted: bool
    percent: int
    next_lesson_id: strawberry.ID | None
    completion_gaps: list[str]
    completed_at: str | None
    certificate_code: str | None

    @staticmethod
    def build(enrollment: Enrollment) -> 'ProgressType':
        progress = selectors.progress_for(enrollment)
        upcoming = selectors.next_lesson(enrollment, progress)
        completion = progress.completion
        return ProgressType(
            completed_lessons=len(progress.completed_lesson_ids),
            total_lessons=progress.total_lessons,
            passed_exercises=len(progress.passed_exercise_ids),
            total_exercises=progress.total_exercises,
            passed_quizzes=len(progress.passed_quiz_ids),
            total_quizzes=progress.total_quizzes,
            capstone_submitted=progress.capstone is not None,
            percent=progress.percent,
            next_lesson_id=_id(upcoming.pk) if upcoming else None,
            completion_gaps=[] if completion else services.completion_gaps(enrollment),
            completed_at=completion.completed_at.isoformat() if completion else None,
            certificate_code=str(completion.certificate_code) if completion else None,
        )


@strawberry.type(description='Your enrollment in a course.')
class EnrollmentType:
    id: strawberry.ID
    enrolled_at: str
    last_activity_at: str
    progress: ProgressType

    @staticmethod
    def from_model(enrollment: Enrollment) -> 'EnrollmentType':
        return EnrollmentType(
            id=_id(enrollment.pk),
            enrolled_at=enrollment.enrolled_at.isoformat(),
            last_activity_at=enrollment.last_activity_at.isoformat(),
            progress=ProgressType.build(enrollment),
        )


@strawberry.type(description='A course as the catalog lists it.')
class CourseSummaryType:
    id: strawberry.ID
    slug: str
    title: str
    subtitle: str
    description: str
    level: str
    level_label: str
    estimated_hours: int
    module_count: int
    lesson_count: int
    status: str
    enrolled: bool

    @staticmethod
    def from_model(course: Course, enrolled: bool) -> 'CourseSummaryType':
        return CourseSummaryType(
            id=_id(course.pk),
            slug=course.slug,
            title=course.title,
            subtitle=course.subtitle,
            description=course.description,
            level=course.level,
            level_label=course.get_level_display(),
            estimated_hours=course.estimated_hours,
            module_count=getattr(course, 'module_count', None) or course.modules.count(),
            lesson_count=getattr(course, 'lesson_count', None)
            or Lesson.objects.filter(module__course=course).count(),
            status=course.status,
            enrolled=enrolled,
        )


@strawberry.type(
    description=(
        'An external web page that belongs to a lesson: shown in a frame (`embed`) or '
        'linked (`link`). It loads in the browser from its own site; only published '
        'resources are ever listed.'
    )
)
class LessonResourceType:
    id: strawberry.ID
    title: str
    description: str
    url: str
    kind: str

    @staticmethod
    def from_model(resource: LessonResource) -> 'LessonResourceType':
        return LessonResourceType(
            id=_id(resource.pk),
            title=resource.title,
            description=resource.description,
            url=resource.url,
            kind=resource.kind,
        )


@strawberry.type
class LessonSummaryType:
    id: strawberry.ID
    slug: str
    title: str
    summary: str
    estimated_minutes: int
    completed: bool
    resources: list[LessonResourceType]


@strawberry.type
class ExerciseSummaryType:
    id: strawberry.ID
    slug: str
    title: str
    difficulty: str
    lesson_id: strawberry.ID | None
    attempted: bool
    passed: bool

    @staticmethod
    def from_model(
        exercise: CodingExercise, progress: selectors.Progress | None
    ) -> 'ExerciseSummaryType':
        return ExerciseSummaryType(
            id=_id(exercise.pk),
            slug=exercise.slug,
            title=exercise.title,
            difficulty=exercise.difficulty,
            lesson_id=_id(exercise.lesson_id) if exercise.lesson_id else None,
            attempted=bool(progress) and exercise.pk in progress.attempted_exercise_ids,
            passed=bool(progress) and exercise.pk in progress.passed_exercise_ids,
        )


@strawberry.type
class QuizSummaryType:
    id: strawberry.ID
    title: str
    question_count: int
    pass_percentage: int
    best_percentage: int | None
    passed: bool


@strawberry.type(description='One module of a course, with its lessons, exercises and quiz.')
class CourseModuleType:
    id: strawberry.ID
    slug: str
    position: int
    title: str
    summary: str
    objectives: list[str]
    project: str
    lessons: list[LessonSummaryType]
    exercises: list[ExerciseSummaryType]
    quiz: QuizSummaryType | None

    @staticmethod
    def from_model(module: CourseModule, progress: selectors.Progress | None) -> 'CourseModuleType':
        quiz = _module_quiz(module)
        return CourseModuleType(
            id=_id(module.pk),
            slug=module.slug,
            position=module.position,
            title=module.title,
            summary=module.summary,
            objectives=list(module.objectives),
            project=module.project,
            lessons=[
                LessonSummaryType(
                    id=_id(lesson.pk),
                    slug=lesson.slug,
                    title=lesson.title,
                    summary=lesson.summary,
                    estimated_minutes=lesson.estimated_minutes,
                    completed=bool(progress) and lesson.pk in progress.completed_lesson_ids,
                    resources=[
                        LessonResourceType.from_model(resource)
                        for resource in lesson.resources.all()
                        if resource.is_published
                    ],
                )
                for lesson in module.lessons.all()
            ],
            exercises=[
                ExerciseSummaryType.from_model(exercise, progress)
                for exercise in module.exercises.all()
            ],
            quiz=QuizSummaryType(
                id=_id(quiz.pk),
                title=quiz.title,
                question_count=getattr(quiz, 'question_count', 0),
                pass_percentage=quiz.pass_percentage,
                best_percentage=progress.best_quiz_percentages.get(quiz.pk) if progress else None,
                passed=bool(progress) and quiz.pk in progress.passed_quiz_ids,
            )
            if quiz
            else None,
        )


@strawberry.type
class CapstoneOptionType:
    key: str
    title: str
    summary: str


@strawberry.type(description='Your final project, as you submitted it.')
class CapstoneSubmissionType:
    option: str
    repository_url: str
    documentation_url: str
    how_to_run: str
    design_decisions: str
    submitted_at: str
    updated_at: str

    @staticmethod
    def from_model(submission: CapstoneSubmission) -> 'CapstoneSubmissionType':
        return CapstoneSubmissionType(
            option=submission.option,
            repository_url=submission.repository_url,
            documentation_url=submission.documentation_url,
            how_to_run=submission.how_to_run,
            design_decisions=submission.design_decisions,
            submitted_at=submission.submitted_at.isoformat(),
            updated_at=submission.updated_at.isoformat(),
        )


@strawberry.type(description="The course's final project.")
class CapstoneType:
    brief: str
    requirements: list[str]
    options: list[CapstoneOptionType]
    submission: CapstoneSubmissionType | None


@strawberry.type(description='A course, its curriculum, and your place in it.')
class CourseType:
    summary: CourseSummaryType
    audience: list[str]
    outcomes: list[str]
    modules: list[CourseModuleType]
    capstone: CapstoneType
    enrollment: EnrollmentType | None
    can_manage: bool

    @staticmethod
    def build(course: Course, user) -> 'CourseType':
        enrollment = selectors.get_enrollment(user, course)
        progress = selectors.progress_for(enrollment) if enrollment else None
        modules = list(course.modules.all())
        capstone = course.capstone or {}
        return CourseType(
            summary=CourseSummaryType(
                id=_id(course.pk),
                slug=course.slug,
                title=course.title,
                subtitle=course.subtitle,
                description=course.description,
                level=course.level,
                level_label=course.get_level_display(),
                estimated_hours=course.estimated_hours,
                module_count=len(modules),
                lesson_count=sum(len(module.lessons.all()) for module in modules),
                status=course.status,
                enrolled=enrollment is not None,
            ),
            audience=list(course.audience),
            outcomes=list(course.outcomes),
            modules=[CourseModuleType.from_model(module, progress) for module in modules],
            capstone=CapstoneType(
                brief=capstone.get('brief', ''),
                requirements=list(capstone.get('requirements', [])),
                options=[
                    CapstoneOptionType(
                        key=option.get('key', ''),
                        title=option.get('title', ''),
                        summary=option.get('summary', ''),
                    )
                    for option in capstone.get('options', [])
                ],
                submission=CapstoneSubmissionType.from_model(progress.capstone)
                if progress and progress.capstone
                else None,
            ),
            enrollment=EnrollmentType.from_model(enrollment) if enrollment else None,
            can_manage=selectors.can_manage_courses(user),
        )


@strawberry.type(description="A file the course's authors attached to a lesson.")
class LessonFileType:
    id: strawberry.ID
    title: str
    filename: str
    content_type: str
    size: int
    download_url: str


@strawberry.type(description='One lesson to read.')
class LessonType:
    id: strawberry.ID
    slug: str
    title: str
    summary: str
    objectives: list[str]
    estimated_minutes: int
    blocks: list[ContentBlockType]
    course_slug: str
    course_title: str
    module_id: strawberry.ID
    module_position: int
    module_title: str
    previous_lesson_id: strawberry.ID | None
    next_lesson_id: strawberry.ID | None
    completed: bool
    exercises: list[ExerciseSummaryType]
    quiz_id: strawberry.ID | None
    materials: list[LessonFileType]
    resources: list[LessonResourceType]

    @staticmethod
    def build(lesson: Lesson, user) -> 'LessonType':
        course = lesson.module.course
        ordered = selectors.course_lessons(course)
        index = next(i for i, other in enumerate(ordered) if other.pk == lesson.pk)
        enrollment = selectors.get_enrollment(user, course)
        progress = selectors.progress_for(enrollment) if enrollment else None
        quiz = _module_quiz(lesson.module)
        return LessonType(
            id=_id(lesson.pk),
            slug=lesson.slug,
            title=lesson.title,
            summary=lesson.summary,
            objectives=list(lesson.objectives),
            estimated_minutes=lesson.estimated_minutes,
            blocks=[
                ContentBlockType(kind=block.kind, text=block.text, language=block.language)
                for block in lesson.blocks.all()
            ],
            course_slug=course.slug,
            course_title=course.title,
            module_id=_id(lesson.module_id),
            module_position=lesson.module.position,
            module_title=lesson.module.title,
            previous_lesson_id=_id(ordered[index - 1].pk) if index > 0 else None,
            next_lesson_id=_id(ordered[index + 1].pk) if index + 1 < len(ordered) else None,
            completed=bool(progress) and lesson.pk in progress.completed_lesson_ids,
            exercises=[
                ExerciseSummaryType.from_model(exercise, progress)
                for exercise in lesson.exercises.all()
            ],
            quiz_id=_id(quiz.pk) if quiz else None,
            materials=[
                LessonFileType(
                    id=_id(material.pk),
                    title=material.title,
                    filename=material.filename,
                    content_type=material.content_type,
                    size=material.size,
                    download_url=f'/learning/materials/{material.pk}/download/',
                )
                for material in lesson.materials.all()
            ],
            # Published only - for a course manager reading as a learner, too.
            resources=[
                LessonResourceType.from_model(resource)
                for resource in lesson.resources.all()
                if resource.is_published
            ],
        )


@strawberry.type(description='A test you can see: its input and what it expects.')
class VisibleTestType:
    id: strawberry.ID
    name: str
    stdin: str
    call: str
    expected_output: str


@strawberry.type(description='How one test went. A hidden test reports only its name and result.')
class TestResultType:
    name: str
    hidden: bool
    passed: bool
    stdin: str
    call: str
    expected: str
    actual: str
    error: str


@strawberry.type(description='One graded submission of yours.')
class SubmissionType:
    id: strawberry.ID
    code: str
    status: str
    passed_count: int
    total_count: int
    results: list[TestResultType]
    created_at: str

    @staticmethod
    def from_model(submission: ExerciseSubmission) -> 'SubmissionType':
        return SubmissionType(
            id=_id(submission.pk),
            code=submission.code,
            status=submission.status,
            passed_count=submission.passed_count,
            total_count=submission.total_count,
            results=[
                TestResultType(
                    name=result.get('name', ''),
                    hidden=result.get('hidden', False),
                    passed=result.get('passed', False),
                    stdin=result.get('stdin', ''),
                    call=result.get('call', ''),
                    expected=result.get('expected', ''),
                    actual=result.get('actual', ''),
                    error=result.get('error', ''),
                )
                for result in submission.results
            ],
            created_at=submission.created_at.isoformat(),
        )


@strawberry.type(description='A coding exercise, with your attempts at it.')
class ExerciseType:
    id: strawberry.ID
    slug: str
    title: str
    difficulty: str
    instructions: list[ContentBlockType]
    starter_code: str
    visible_tests: list[VisibleTestType]
    hidden_test_count: int
    hints: list[str]
    hint_count: int
    course_slug: str
    course_title: str
    module_title: str
    lesson_id: strawberry.ID | None
    lesson_title: str
    passed: bool
    submissions: list[SubmissionType]
    execution_available: bool

    @staticmethod
    def build(exercise: CodingExercise, user) -> 'ExerciseType':
        course = exercise.module.course
        enrollment = selectors.get_enrollment(user, course)
        submissions = (
            list(selectors.exercise_submissions(enrollment, exercise)) if enrollment else []
        )
        tests = list(exercise.test_cases.all())
        return ExerciseType(
            id=_id(exercise.pk),
            slug=exercise.slug,
            title=exercise.title,
            difficulty=exercise.difficulty,
            instructions=[ContentBlockType.from_dict(block) for block in exercise.instructions],
            starter_code=exercise.starter_code,
            visible_tests=[
                VisibleTestType(
                    id=_id(test.pk),
                    name=test.name,
                    stdin=test.stdin,
                    call=test.call,
                    expected_output=test.expected_output,
                )
                for test in tests
                if not test.is_hidden
            ],
            hidden_test_count=sum(1 for test in tests if test.is_hidden),
            hints=services.unlocked_hints(enrollment, exercise),
            hint_count=len(exercise.hints),
            course_slug=course.slug,
            course_title=course.title,
            module_title=exercise.module.title,
            lesson_id=_id(exercise.lesson_id) if exercise.lesson_id else None,
            lesson_title=exercise.lesson.title if exercise.lesson_id else '',
            passed=any(s.status == ExerciseSubmission.Status.PASSED for s in submissions),
            submissions=[SubmissionType.from_model(submission) for submission in submissions],
            execution_available=execution.is_configured(),
        )


@strawberry.type
class QuizOptionType:
    id: strawberry.ID
    text: str


@strawberry.type
class QuizQuestionType:
    id: strawberry.ID
    prompt: str
    code: str
    kind: str
    options: list[QuizOptionType]


@strawberry.type
class QuizAttemptType:
    id: strawberry.ID
    score: int
    max_score: int
    percentage: int
    passed: bool
    created_at: str

    @staticmethod
    def from_model(attempt: AssessmentAttempt) -> 'QuizAttemptType':
        return QuizAttemptType(
            id=_id(attempt.pk),
            score=attempt.score,
            max_score=attempt.max_score,
            percentage=attempt.percentage,
            passed=attempt.passed,
            created_at=attempt.created_at.isoformat(),
        )


@strawberry.type(description="A module's quiz. Which answers are correct is never included.")
class QuizType:
    id: strawberry.ID
    title: str
    pass_percentage: int
    course_slug: str
    course_title: str
    module_position: int
    module_title: str
    questions: list[QuizQuestionType]
    attempts: list[QuizAttemptType]

    @staticmethod
    def build(quiz: Quiz, user) -> 'QuizType':
        course = quiz.module.course
        enrollment = selectors.get_enrollment(user, course)
        return QuizType(
            id=_id(quiz.pk),
            title=quiz.title,
            pass_percentage=quiz.pass_percentage,
            course_slug=course.slug,
            course_title=course.title,
            module_position=quiz.module.position,
            module_title=quiz.module.title,
            questions=[
                QuizQuestionType(
                    id=_id(question.pk),
                    prompt=question.prompt,
                    code=question.code,
                    kind=question.kind,
                    options=[
                        QuizOptionType(id=_id(option.pk), text=option.text)
                        for option in question.options.all()
                    ],
                )
                for question in quiz.questions.all()
            ],
            attempts=[
                QuizAttemptType.from_model(attempt)
                for attempt in (selectors.quiz_attempts(enrollment, quiz) if enrollment else [])
            ],
        )


@strawberry.type
class ActivityType:
    kind: str
    title: str
    detail: str
    course_slug: str
    course_title: str
    at: str


@strawberry.type(description='A course you are enrolled in, and how far you are.')
class EnrolledCourseType:
    course: CourseSummaryType
    enrollment: EnrollmentType


@strawberry.type(description='Your learning: your courses, latest activity and quiz results.')
class MyLearningType:
    courses: list[EnrolledCourseType]
    recent_activity: list[ActivityType]


@strawberry.type
class RunResultType:
    stdout: str
    stderr: str
    exit_code: int | None
    killed: bool


@strawberry.type
class QuestionResultType:
    question_id: strawberry.ID
    correct: bool
    explanation: str


# --- payloads -------------------------------------------------------------------------


@strawberry.type
class EnrollPayload:
    success: bool
    message: str
    field: str | None = None
    course: CourseType | None = None


@strawberry.type
class LessonPayload:
    success: bool
    message: str
    field: str | None = None
    lesson: LessonType | None = None


@strawberry.type
class RunCodePayload:
    success: bool
    message: str
    field: str | None = None
    result: RunResultType | None = None


@strawberry.type
class SubmitExercisePayload:
    success: bool
    message: str
    field: str | None = None
    exercise: ExerciseType | None = None
    submission: SubmissionType | None = None


@strawberry.type
class QuizPayload:
    success: bool
    message: str
    field: str | None = None
    attempt: QuizAttemptType | None = None
    results: list[QuestionResultType] = strawberry.field(default_factory=list)


@strawberry.type
class CoursePayload:
    success: bool
    message: str
    field: str | None = None
    course: CourseType | None = None


@strawberry.input
class QuizAnswerInput:
    question_id: strawberry.ID
    option_ids: list[strawberry.ID]


@strawberry.input
class CapstoneInput:
    course_id: strawberry.ID
    option: str
    repository_url: str
    how_to_run: str
    design_decisions: str
    documentation_url: str = ''


def _course_after_write(info: strawberry.Info, course_id: int) -> CourseType | None:
    course = selectors.visible_courses(info.context.user).filter(pk=course_id).first()
    if course is None:
        return None
    course = selectors.get_course(info.context.user, course.slug)
    return CourseType.build(course, info.context.user) if course else None


@strawberry.type
class Query:
    @strawberry.field(description='Published courses, optionally searched and filtered by level.')
    def courses(
        self, info: strawberry.Info, search: str = '', level: str = ''
    ) -> list[CourseSummaryType]:
        user = info.context.user
        courses = list(selectors.list_courses(user, search=search, level=level))
        enrolled = set(selectors.my_enrollments(user).values_list('course_id', flat=True))
        return [CourseSummaryType.from_model(course, course.pk in enrolled) for course in courses]

    @strawberry.field(description='One course and its curriculum, or null.')
    def course(self, info: strawberry.Info, slug: str) -> CourseType | None:
        course = selectors.get_course(info.context.user, slug)
        return CourseType.build(course, info.context.user) if course else None

    @strawberry.field(description='One lesson of a course you are enrolled in, or null.')
    def lesson(self, info: strawberry.Info, id: strawberry.ID) -> LessonType | None:
        lesson = selectors.get_lesson(info.context.user, id)
        return LessonType.build(lesson, info.context.user) if lesson else None

    @strawberry.field(description='One published external resource of a lesson you can open.')
    def lesson_resource(
        self, info: strawberry.Info, id: strawberry.ID
    ) -> LessonResourceType | None:
        resource = selectors.get_published_resource(info.context.user, id)
        return LessonResourceType.from_model(resource) if resource else None

    @strawberry.field(description='One exercise of a course you are enrolled in, or null.')
    def exercise(self, info: strawberry.Info, id: strawberry.ID) -> ExerciseType | None:
        exercise = selectors.get_exercise(info.context.user, id)
        return ExerciseType.build(exercise, info.context.user) if exercise else None

    @strawberry.field(description='One quiz of a course you are enrolled in, or null.')
    def quiz(self, info: strawberry.Info, id: strawberry.ID) -> QuizType | None:
        quiz = selectors.get_quiz(info.context.user, id)
        return QuizType.build(quiz, info.context.user) if quiz else None

    @strawberry.field(description='Your courses and recent learning activity.')
    def my_learning(self, info: strawberry.Info) -> MyLearningType:
        user = info.context.user
        return MyLearningType(
            courses=[
                EnrolledCourseType(
                    course=CourseSummaryType.from_model(enrollment.course, True),
                    enrollment=EnrollmentType.from_model(enrollment),
                )
                for enrollment in selectors.my_enrollments(user)
            ],
            recent_activity=[
                ActivityType(
                    kind=item.kind,
                    title=item.title,
                    detail=item.detail,
                    course_slug=item.course_slug,
                    course_title=item.course_title,
                    at=item.at.isoformat(),
                )
                for item in selectors.recent_activity(user)
            ],
        )


@strawberry.type
class Mutation:
    @strawberry.mutation(description='Enroll in a published course. Enrolling twice is harmless.')
    def enroll_in_course(self, info: strawberry.Info, course_id: strawberry.ID) -> EnrollPayload:
        try:
            enrollment = services.enroll(info.context.user, course_id)
        except services.LearningError as exc:
            return EnrollPayload(success=False, message=exc.message, field=exc.field)
        return EnrollPayload(
            success=True,
            message='You are enrolled.',
            course=_course_after_write(info, enrollment.course_id),
        )

    @strawberry.mutation(description='Mark a lesson as completed.')
    def complete_lesson(self, info: strawberry.Info, lesson_id: strawberry.ID) -> LessonPayload:
        try:
            services.complete_lesson(info.context.user, lesson_id)
        except services.LearningError as exc:
            return LessonPayload(success=False, message=exc.message, field=exc.field)
        lesson = selectors.get_lesson(info.context.user, lesson_id)
        return LessonPayload(
            success=True,
            message='Lesson completed.',
            lesson=LessonType.build(lesson, info.context.user) if lesson else None,
        )

    @strawberry.mutation(
        description=(
            'Run your code in the isolated sandbox with your own input. Nothing is '
            'graded or recorded.'
        )
    )
    def run_exercise_code(
        self, info: strawberry.Info, exercise_id: strawberry.ID, code: str, stdin: str = ''
    ) -> RunCodePayload:
        try:
            result = services.run_code(info.context.user, exercise_id, code, stdin)
        except services.LearningError as exc:
            return RunCodePayload(success=False, message=exc.message, field=exc.field)
        return RunCodePayload(
            success=True,
            message='Finished.' if result.succeeded else 'The program stopped with an error.',
            result=RunResultType(
                stdout=result.stdout,
                stderr=result.stderr,
                exit_code=result.exit_code,
                killed=result.killed,
            ),
        )

    @strawberry.mutation(
        description=(
            'Submit your code to be graded against every test, hidden ones included. '
            'Hidden tests report only whether they passed.'
        )
    )
    def submit_exercise(
        self, info: strawberry.Info, exercise_id: strawberry.ID, code: str
    ) -> SubmitExercisePayload:
        try:
            submission = services.submit_exercise(info.context.user, exercise_id, code)
        except services.LearningError as exc:
            return SubmitExercisePayload(success=False, message=exc.message, field=exc.field)
        exercise = selectors.get_exercise(info.context.user, exercise_id)
        return SubmitExercisePayload(
            success=True,
            message='Every test passed.'
            if submission.status == ExerciseSubmission.Status.PASSED
            else f'{submission.passed_count} of {submission.total_count} tests passed.',
            submission=SubmissionType.from_model(submission),
            exercise=ExerciseType.build(exercise, info.context.user) if exercise else None,
        )

    @strawberry.mutation(description='Submit answers to a quiz and get your score.')
    def submit_quiz(
        self, info: strawberry.Info, quiz_id: strawberry.ID, answers: list[QuizAnswerInput]
    ) -> QuizPayload:
        try:
            outcome = services.submit_quiz(
                info.context.user,
                quiz_id,
                {str(a.question_id): [str(o) for o in a.option_ids] for a in answers},
            )
        except services.LearningError as exc:
            return QuizPayload(success=False, message=exc.message, field=exc.field)
        attempt = outcome.attempt
        return QuizPayload(
            success=True,
            message=f'You scored {attempt.percentage}%.'
            + (' Passed.' if attempt.passed else ' Not passed yet - try again.'),
            attempt=QuizAttemptType.from_model(attempt),
            results=[
                QuestionResultType(
                    question_id=_id(result.question_id),
                    correct=result.correct,
                    explanation=result.explanation,
                )
                for result in outcome.questions
            ],
        )

    @strawberry.mutation(description='Submit, or update, your final project.')
    def submit_capstone(self, info: strawberry.Info, input: CapstoneInput) -> CoursePayload:
        try:
            submission = services.submit_capstone(
                info.context.user,
                input.course_id,
                services.CapstoneInput(
                    option=input.option,
                    repository_url=input.repository_url,
                    documentation_url=input.documentation_url,
                    how_to_run=input.how_to_run,
                    design_decisions=input.design_decisions,
                ),
            )
        except services.LearningError as exc:
            return CoursePayload(success=False, message=exc.message, field=exc.field)
        return CoursePayload(
            success=True,
            message='Final project submitted.',
            course=_course_after_write(info, submission.enrollment.course_id),
        )

    @strawberry.mutation(description='Complete a course whose requirements you have met.')
    def complete_course(self, info: strawberry.Info, course_id: strawberry.ID) -> CoursePayload:
        try:
            completion = services.complete_course(info.context.user, course_id)
        except services.LearningError as exc:
            return CoursePayload(success=False, message=exc.message, field=exc.field)
        return CoursePayload(
            success=True,
            message='Course completed. Well done!',
            course=_course_after_write(info, completion.enrollment.course_id),
        )
