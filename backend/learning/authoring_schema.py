"""
The course-authoring GraphQL adapter, for the administration console.

Separate from `learning.schema` on purpose: these types carry what a learner must
never see - solutions, hidden tests, expected outputs, correct answers - so they
live where only `can_manage_courses` reaches them. Every field resolves to null or
an empty list for anybody else, and every mutation refuses them in
`learning.authoring`.
"""

import strawberry
from django.db.models import Count

from learning import authoring, selectors
from learning.content import ContentError, blocks_from
from learning.models import CodingExercise, Course, CourseModule, Lesson, LessonResource, Quiz
from learning.schema import ContentBlockType, _id, _module_quiz
from learning.services import LearningError


@strawberry.type
class MaterialType:
    id: strawberry.ID
    title: str
    filename: str
    content_type: str
    size: int
    created_at: str
    download_url: str

    @staticmethod
    def from_model(material) -> 'MaterialType':
        return MaterialType(
            id=_id(material.pk),
            title=material.title,
            filename=material.filename,
            content_type=material.content_type,
            size=material.size,
            created_at=material.created_at.isoformat(),
            download_url=f'/learning/materials/{material.pk}/download/',
        )


@strawberry.type
class AdminCourseListItemType:
    id: strawberry.ID
    slug: str
    title: str
    status: str
    level_label: str
    module_count: int
    lesson_count: int
    enrollment_count: int
    updated_at: str


@strawberry.type
class AdminLessonSummaryType:
    id: strawberry.ID
    position: int
    title: str
    estimated_minutes: int
    material_count: int
    # The lesson's files, so the curriculum can preview and download them in place.
    materials: list[MaterialType]


@strawberry.type
class AdminExerciseSummaryType:
    id: strawberry.ID
    title: str
    difficulty: str
    test_count: int
    hidden_test_count: int


@strawberry.type
class AdminQuizSummaryType:
    id: strawberry.ID
    title: str
    question_count: int
    pass_percentage: int


@strawberry.type
class AdminModuleType:
    id: strawberry.ID
    position: int
    title: str
    summary: str
    objectives: list[str]
    project: str
    lessons: list[AdminLessonSummaryType]
    exercises: list[AdminExerciseSummaryType]
    quiz: AdminQuizSummaryType | None


@strawberry.type
class CapstoneOptionInputType:
    key: str
    title: str
    summary: str


@strawberry.type(description='A course as its authors edit it.')
class AdminCourseType:
    id: strawberry.ID
    slug: str
    title: str
    subtitle: str
    description: str
    level: str
    estimated_hours: int
    audience: list[str]
    outcomes: list[str]
    capstone_brief: str
    capstone_requirements: list[str]
    capstone_options: list[CapstoneOptionInputType]
    status: str
    published_at: str | None
    enrollment_count: int
    modules: list[AdminModuleType]

    @staticmethod
    def build(course: Course) -> 'AdminCourseType':
        modules = (
            CourseModule.objects.filter(course=course)
            .order_by('position')
            .prefetch_related('exercises__test_cases', 'quiz')
        )
        lessons = (
            Lesson.objects.filter(module__course=course)
            .annotate(material_count=Count('materials'))
            .prefetch_related('materials')
            .order_by('position')
        )
        by_module: dict[int, list] = {}
        for lesson in lessons:
            by_module.setdefault(lesson.module_id, []).append(lesson)
        question_counts = dict(
            Quiz.objects.filter(module__course=course)
            .annotate(n=Count('questions'))
            .values_list('pk', 'n')
        )
        capstone = course.capstone or {}

        def module_type(module: CourseModule) -> AdminModuleType:
            quiz = _module_quiz(module)
            return AdminModuleType(
                id=_id(module.pk),
                position=module.position,
                title=module.title,
                summary=module.summary,
                objectives=list(module.objectives),
                project=module.project,
                lessons=[
                    AdminLessonSummaryType(
                        id=_id(lesson.pk),
                        position=lesson.position,
                        title=lesson.title,
                        estimated_minutes=lesson.estimated_minutes,
                        material_count=lesson.material_count,
                        materials=[
                            MaterialType.from_model(material) for material in lesson.materials.all()
                        ],
                    )
                    for lesson in by_module.get(module.pk, [])
                ],
                exercises=[
                    AdminExerciseSummaryType(
                        id=_id(exercise.pk),
                        title=exercise.title,
                        difficulty=exercise.difficulty,
                        test_count=len(exercise.test_cases.all()),
                        hidden_test_count=sum(1 for t in exercise.test_cases.all() if t.is_hidden),
                    )
                    for exercise in module.exercises.all()
                ],
                quiz=AdminQuizSummaryType(
                    id=_id(quiz.pk),
                    title=quiz.title,
                    question_count=question_counts.get(quiz.pk, 0),
                    pass_percentage=quiz.pass_percentage,
                )
                if quiz
                else None,
            )

        return AdminCourseType(
            id=_id(course.pk),
            slug=course.slug,
            title=course.title,
            subtitle=course.subtitle,
            description=course.description,
            level=course.level,
            estimated_hours=course.estimated_hours,
            audience=list(course.audience),
            outcomes=list(course.outcomes),
            capstone_brief=capstone.get('brief', ''),
            capstone_requirements=list(capstone.get('requirements', [])),
            capstone_options=[
                CapstoneOptionInputType(
                    key=option.get('key', ''),
                    title=option.get('title', ''),
                    summary=option.get('summary', ''),
                )
                for option in capstone.get('options', [])
            ],
            status=course.status,
            published_at=course.published_at.isoformat() if course.published_at else None,
            enrollment_count=course.enrollments.count(),
            modules=[module_type(module) for module in modules],
        )


@strawberry.type(description='An external resource of a lesson, as its authors manage it.')
class AdminResourceType:
    id: strawberry.ID
    title: str
    description: str
    url: str
    kind: str
    display_order: int
    is_published: bool
    crop_top: int
    created_at: str
    updated_at: str

    @staticmethod
    def from_model(resource: LessonResource) -> 'AdminResourceType':
        return AdminResourceType(
            id=_id(resource.pk),
            title=resource.title,
            description=resource.description,
            url=resource.url,
            kind=resource.kind,
            display_order=resource.position,
            is_published=resource.is_published,
            crop_top=resource.crop_top,
            created_at=resource.created_at.isoformat(),
            updated_at=resource.updated_at.isoformat(),
        )


@strawberry.type(description='A lesson as its authors edit it: the notes as written, and files.')
class AdminLessonType:
    id: strawberry.ID
    course_id: strawberry.ID
    course_title: str
    module_id: strawberry.ID
    module_title: str
    title: str
    summary: str
    objectives: list[str]
    estimated_minutes: int
    body: str
    blocks: list[ContentBlockType]
    materials: list[MaterialType]
    resources: list[AdminResourceType]

    @staticmethod
    def build(lesson: Lesson) -> 'AdminLessonType':
        return AdminLessonType(
            id=_id(lesson.pk),
            course_id=_id(lesson.module.course_id),
            course_title=lesson.module.course.title,
            module_id=_id(lesson.module_id),
            module_title=lesson.module.title,
            title=lesson.title,
            summary=lesson.summary,
            objectives=list(lesson.objectives),
            estimated_minutes=lesson.estimated_minutes,
            body=lesson.body,
            blocks=[
                ContentBlockType(kind=block.kind, text=block.text, language=block.language)
                for block in lesson.blocks.all()
            ],
            materials=[MaterialType.from_model(m) for m in lesson.materials.all()],
            resources=[AdminResourceType.from_model(r) for r in lesson.resources.all()],
        )


@strawberry.type
class AdminTestType:
    name: str
    stdin: str
    call: str
    expected_output: str
    hidden: bool


@strawberry.type(
    description='An exercise as its authors edit it, solution and hidden tests included.'
)
class AdminExerciseType:
    id: strawberry.ID
    course_id: strawberry.ID
    module_id: strawberry.ID
    module_title: str
    title: str
    difficulty: str
    lesson_id: strawberry.ID | None
    instructions: str
    starter_code: str
    solution_code: str
    hints: list[str]
    tests: list[AdminTestType]

    @staticmethod
    def build(exercise: CodingExercise) -> 'AdminExerciseType':
        return AdminExerciseType(
            id=_id(exercise.pk),
            course_id=_id(exercise.module.course_id),
            module_id=_id(exercise.module_id),
            module_title=exercise.module.title,
            title=exercise.title,
            difficulty=exercise.difficulty,
            lesson_id=_id(exercise.lesson_id) if exercise.lesson_id else None,
            instructions=exercise.instructions_source,
            starter_code=exercise.starter_code,
            solution_code=exercise.solution_code,
            hints=list(exercise.hints),
            tests=[
                AdminTestType(
                    name=test.name,
                    stdin=test.stdin,
                    call=test.call,
                    expected_output=test.expected_output,
                    hidden=test.is_hidden,
                )
                for test in exercise.test_cases.all()
            ],
        )


@strawberry.type
class AdminOptionType:
    text: str
    correct: bool


@strawberry.type
class AdminQuestionType:
    prompt: str
    code: str
    kind: str
    explanation: str
    options: list[AdminOptionType]


@strawberry.type(description="A module's quiz as its authors edit it, answers included.")
class AdminQuizType:
    id: strawberry.ID
    title: str
    pass_percentage: int
    questions: list[AdminQuestionType]

    @staticmethod
    def build(quiz: Quiz) -> 'AdminQuizType':
        return AdminQuizType(
            id=_id(quiz.pk),
            title=quiz.title,
            pass_percentage=quiz.pass_percentage,
            questions=[
                AdminQuestionType(
                    prompt=question.prompt,
                    code=question.code,
                    kind=question.kind,
                    explanation=question.explanation,
                    options=[
                        AdminOptionType(text=option.text, correct=option.is_correct)
                        for option in question.options.all()
                    ],
                )
                for question in quiz.questions.prefetch_related('options')
            ],
        )


@strawberry.type
class PreviewType:
    blocks: list[ContentBlockType]
    error: str | None


@strawberry.type
class AuthoringPayload:
    success: bool
    message: str
    field: str | None = None
    id: strawberry.ID | None = None


# --- inputs ---------------------------------------------------------------------------


@strawberry.input
class CapstoneOptionInput:
    title: str
    summary: str = ''
    key: str = ''


@strawberry.input
class CourseInput:
    title: str
    subtitle: str = ''
    description: str = ''
    level: str = 'all_levels'
    estimated_hours: int = 0
    audience: list[str] = strawberry.field(default_factory=list)
    outcomes: list[str] = strawberry.field(default_factory=list)
    capstone_brief: str = ''
    capstone_requirements: list[str] = strawberry.field(default_factory=list)
    capstone_options: list[CapstoneOptionInput] = strawberry.field(default_factory=list)

    def to_service(self) -> authoring.CourseInput:
        return authoring.CourseInput(
            title=self.title,
            subtitle=self.subtitle,
            description=self.description,
            level=self.level,
            estimated_hours=self.estimated_hours,
            audience=self.audience,
            outcomes=self.outcomes,
            capstone_brief=self.capstone_brief,
            capstone_requirements=self.capstone_requirements,
            capstone_options=[
                {'key': o.key, 'title': o.title, 'summary': o.summary}
                for o in self.capstone_options
            ],
        )


@strawberry.input
class ModuleInput:
    title: str
    summary: str = ''
    objectives: list[str] = strawberry.field(default_factory=list)
    project: str = ''

    def to_service(self) -> authoring.ModuleInput:
        return authoring.ModuleInput(
            title=self.title, summary=self.summary, objectives=self.objectives, project=self.project
        )


@strawberry.input
class LessonInput:
    title: str
    body: str
    summary: str = ''
    objectives: list[str] = strawberry.field(default_factory=list)
    estimated_minutes: int = 15

    def to_service(self) -> authoring.LessonInput:
        return authoring.LessonInput(
            title=self.title,
            body=self.body,
            summary=self.summary,
            objectives=self.objectives,
            estimated_minutes=self.estimated_minutes,
        )


@strawberry.input(description='An external web page for a lesson. `kind`: embed or link.')
class ResourceInput:
    title: str
    url: str
    description: str = ''
    kind: str = 'embed'
    display_order: int | None = None
    is_published: bool = False
    crop_top: int = 0

    def to_service(self) -> authoring.ResourceInput:
        return authoring.ResourceInput(
            title=self.title,
            url=self.url,
            description=self.description,
            kind=self.kind,
            display_order=self.display_order,
            is_published=self.is_published,
            crop_top=self.crop_top,
        )


@strawberry.input
class ExerciseTestInput:
    name: str
    expected_output: str
    stdin: str = ''
    call: str = ''
    hidden: bool = False


@strawberry.input
class ExerciseInput:
    title: str
    instructions: str
    solution_code: str
    tests: list[ExerciseTestInput]
    difficulty: str = 'easy'
    lesson_id: strawberry.ID | None = None
    starter_code: str = ''
    hints: list[str] = strawberry.field(default_factory=list)

    def to_service(self) -> authoring.ExerciseInput:
        return authoring.ExerciseInput(
            title=self.title,
            instructions=self.instructions,
            solution=self.solution_code,
            tests=[
                authoring.TestInput(
                    name=t.name,
                    expected_output=t.expected_output,
                    stdin=t.stdin,
                    call=t.call,
                    hidden=t.hidden,
                )
                for t in self.tests
            ],
            difficulty=self.difficulty,
            lesson_id=self.lesson_id,
            starter_code=self.starter_code,
            hints=self.hints,
        )


@strawberry.input
class OptionInput:
    text: str
    correct: bool = False


@strawberry.input
class QuestionInput:
    prompt: str
    options: list[OptionInput]
    kind: str = 'single'
    code: str = ''
    explanation: str = ''


def _failed(exc: LearningError) -> AuthoringPayload:
    return AuthoringPayload(success=False, message=exc.message, field=exc.field)


def _done(message: str, pk: int | None = None) -> AuthoringPayload:
    return AuthoringPayload(success=True, message=message, id=_id(pk) if pk else None)


def _set_status(info: strawberry.Info, course_id, status: str, message: str) -> AuthoringPayload:
    """A course's status moves only through the named actions below, never a free value."""
    try:
        course = authoring.set_course_status(info.context.user, course_id, status)
    except LearningError as exc:
        return _failed(exc)
    return _done(message, course.pk)


@strawberry.type
class Query:
    @strawberry.field(description='Every course, for course managers; empty for anybody else.')
    def admin_courses(self, info: strawberry.Info) -> list[AdminCourseListItemType]:
        if not selectors.can_manage_courses(info.context.user):
            return []
        courses = Course.objects.annotate(
            module_count=Count('modules', distinct=True),
            lesson_count=Count('modules__lessons', distinct=True),
            enrollment_count=Count('enrollments', distinct=True),
        ).order_by('-updated_at')
        return [
            AdminCourseListItemType(
                id=_id(course.pk),
                slug=course.slug,
                title=course.title,
                status=course.status,
                level_label=course.get_level_display(),
                module_count=course.module_count,
                lesson_count=course.lesson_count,
                enrollment_count=course.enrollment_count,
                updated_at=course.updated_at.isoformat(),
            )
            for course in courses
        ]

    @strawberry.field(description='One course to edit, or null.')
    def admin_course(self, info: strawberry.Info, id: strawberry.ID) -> AdminCourseType | None:
        if not selectors.can_manage_courses(info.context.user):
            return None
        course = Course.objects.filter(pk=selectors.parse_id(id)).first()
        return AdminCourseType.build(course) if course else None

    @strawberry.field(description='One lesson to edit, or null.')
    def admin_lesson(self, info: strawberry.Info, id: strawberry.ID) -> AdminLessonType | None:
        if not selectors.can_manage_courses(info.context.user):
            return None
        lesson = (
            Lesson.objects.filter(pk=selectors.parse_id(id))
            .select_related('module__course')
            .prefetch_related('blocks', 'materials', 'resources')
            .first()
        )
        return AdminLessonType.build(lesson) if lesson else None

    @strawberry.field(description='One exercise to edit, or null.')
    def admin_exercise(self, info: strawberry.Info, id: strawberry.ID) -> AdminExerciseType | None:
        if not selectors.can_manage_courses(info.context.user):
            return None
        exercise = (
            CodingExercise.objects.filter(pk=selectors.parse_id(id))
            .select_related('module')
            .prefetch_related('test_cases')
            .first()
        )
        return AdminExerciseType.build(exercise) if exercise else None

    @strawberry.field(description="A module's quiz to edit, or null if it has none.")
    def admin_quiz(self, info: strawberry.Info, module_id: strawberry.ID) -> AdminQuizType | None:
        if not selectors.can_manage_courses(info.context.user):
            return None
        quiz = Quiz.objects.filter(module_id=selectors.parse_id(module_id)).first()
        return AdminQuizType.build(quiz) if quiz else None

    @strawberry.field(description='Notes as learners will read them, for a live preview.')
    def preview_content(self, info: strawberry.Info, source: str) -> PreviewType:
        if not selectors.can_manage_courses(info.context.user):
            return PreviewType(blocks=[], error='Managing courses needs the course permission.')
        try:
            blocks = blocks_from(source, 'The text')
        except ContentError as exc:
            return PreviewType(blocks=[], error=str(exc))
        return PreviewType(
            blocks=[ContentBlockType.from_dict(block.as_dict()) for block in blocks], error=None
        )


@strawberry.type
class Mutation:
    @strawberry.mutation(description='Create a course, as a draft.')
    def create_course(self, info: strawberry.Info, input: CourseInput) -> AuthoringPayload:
        try:
            course = authoring.create_course(info.context.user, input.to_service())
        except LearningError as exc:
            return _failed(exc)
        return _done('Course created.', course.pk)

    @strawberry.mutation(description="Update a course's details.")
    def update_course(
        self, info: strawberry.Info, id: strawberry.ID, input: CourseInput
    ) -> AuthoringPayload:
        try:
            course = authoring.update_course(info.context.user, id, input.to_service())
        except LearningError as exc:
            return _failed(exc)
        return _done('Course saved.', course.pk)

    @strawberry.mutation(description='Publish a course: it joins the catalog for every learner.')
    def publish_course(self, info: strawberry.Info, id: strawberry.ID) -> AuthoringPayload:
        return _set_status(info, id, Course.Status.PUBLISHED, 'Course published.')

    @strawberry.mutation(
        description='Archive a course: it leaves the catalog; its enrolled learners keep access.'
    )
    def archive_course(self, info: strawberry.Info, id: strawberry.ID) -> AuthoringPayload:
        return _set_status(info, id, Course.Status.ARCHIVED, 'Course archived.')

    @strawberry.mutation(description='Return a course to draft: only course managers see it.')
    def unpublish_course(self, info: strawberry.Info, id: strawberry.ID) -> AuthoringPayload:
        return _set_status(info, id, Course.Status.DRAFT, 'Course returned to draft.')

    @strawberry.mutation(
        description=(
            'Delete a course. One with learners needs `force` and its title typed out as '
            '`confirmTitle`, and takes their enrollments and progress with it.'
        )
    )
    def delete_course(
        self,
        info: strawberry.Info,
        id: strawberry.ID,
        force: bool = False,
        confirm_title: str = '',
    ) -> AuthoringPayload:
        try:
            enrolled = authoring.delete_course(
                info.context.user, id, force=force, confirm_title=confirm_title
            )
        except LearningError as exc:
            return _failed(exc)
        if enrolled:
            noun = 'learner' if enrolled == 1 else 'learners'
            return _done(f"Course deleted, with {enrolled} {noun}' enrollments and progress.")
        return _done('Course deleted.')

    @strawberry.mutation(description='Add a module at the end of a course.')
    def create_module(
        self, info: strawberry.Info, course_id: strawberry.ID, input: ModuleInput
    ) -> AuthoringPayload:
        try:
            module = authoring.create_module(info.context.user, course_id, input.to_service())
        except LearningError as exc:
            return _failed(exc)
        return _done('Module added.', module.pk)

    @strawberry.mutation
    def update_module(
        self, info: strawberry.Info, id: strawberry.ID, input: ModuleInput
    ) -> AuthoringPayload:
        try:
            module = authoring.update_module(info.context.user, id, input.to_service())
        except LearningError as exc:
            return _failed(exc)
        return _done('Module saved.', module.pk)

    @strawberry.mutation(description='Move a module one place up (-1) or down (1).')
    def move_module(
        self, info: strawberry.Info, id: strawberry.ID, direction: int
    ) -> AuthoringPayload:
        try:
            module = authoring.move_module(info.context.user, id, direction)
        except LearningError as exc:
            return _failed(exc)
        return _done('Module moved.', module.pk)

    @strawberry.mutation(description="Put a course's modules in the order given (all of them).")
    def reorder_modules(
        self, info: strawberry.Info, course_id: strawberry.ID, ids: list[strawberry.ID]
    ) -> AuthoringPayload:
        try:
            course = authoring.reorder_modules(info.context.user, course_id, ids)
        except LearningError as exc:
            return _failed(exc)
        return _done('Modules reordered.', course.pk)

    @strawberry.mutation(
        description="Put a module's lessons in the order given: all of its own, plus any "
        'from other modules of the course, which move into it.'
    )
    def reorder_lessons(
        self, info: strawberry.Info, module_id: strawberry.ID, ids: list[strawberry.ID]
    ) -> AuthoringPayload:
        try:
            module = authoring.reorder_lessons(info.context.user, module_id, ids)
        except LearningError as exc:
            return _failed(exc)
        return _done('Lessons reordered.', module.pk)

    @strawberry.mutation(description="Put a module's exercises in the order given (all of them).")
    def reorder_exercises(
        self, info: strawberry.Info, module_id: strawberry.ID, ids: list[strawberry.ID]
    ) -> AuthoringPayload:
        try:
            module = authoring.reorder_exercises(info.context.user, module_id, ids)
        except LearningError as exc:
            return _failed(exc)
        return _done('Exercises reordered.', module.pk)

    @strawberry.mutation(description='Delete a module, its lessons and their learner progress.')
    def delete_module(self, info: strawberry.Info, id: strawberry.ID) -> AuthoringPayload:
        try:
            authoring.delete_module(info.context.user, id)
        except LearningError as exc:
            return _failed(exc)
        return _done('Module deleted.')

    @strawberry.mutation(description='Add a lesson at the end of a module.')
    def create_lesson(
        self, info: strawberry.Info, module_id: strawberry.ID, input: LessonInput
    ) -> AuthoringPayload:
        try:
            lesson = authoring.create_lesson(info.context.user, module_id, input.to_service())
        except LearningError as exc:
            return _failed(exc)
        return _done('Lesson added.', lesson.pk)

    @strawberry.mutation
    def update_lesson(
        self, info: strawberry.Info, id: strawberry.ID, input: LessonInput
    ) -> AuthoringPayload:
        try:
            lesson = authoring.update_lesson(info.context.user, id, input.to_service())
        except LearningError as exc:
            return _failed(exc)
        return _done('Lesson saved.', lesson.pk)

    @strawberry.mutation
    def move_lesson(
        self, info: strawberry.Info, id: strawberry.ID, direction: int
    ) -> AuthoringPayload:
        try:
            lesson = authoring.move_lesson(info.context.user, id, direction)
        except LearningError as exc:
            return _failed(exc)
        return _done('Lesson moved.', lesson.pk)

    @strawberry.mutation(description='Delete a lesson, its files and its learner progress.')
    def delete_lesson(self, info: strawberry.Info, id: strawberry.ID) -> AuthoringPayload:
        try:
            authoring.delete_lesson(info.context.user, id)
        except LearningError as exc:
            return _failed(exc)
        return _done('Lesson deleted.')

    @strawberry.mutation(description='Create an exercise, or update it when `id` is given.')
    def save_exercise(
        self,
        info: strawberry.Info,
        module_id: strawberry.ID,
        input: ExerciseInput,
        id: strawberry.ID | None = None,
    ) -> AuthoringPayload:
        try:
            exercise = authoring.save_exercise(
                info.context.user, module_id, input.to_service(), exercise_id=id
            )
        except LearningError as exc:
            return _failed(exc)
        return _done('Exercise saved.', exercise.pk)

    @strawberry.mutation
    def delete_exercise(self, info: strawberry.Info, id: strawberry.ID) -> AuthoringPayload:
        try:
            authoring.delete_exercise(info.context.user, id)
        except LearningError as exc:
            return _failed(exc)
        return _done('Exercise deleted.')

    @strawberry.mutation(description="Create or replace a module's quiz.")
    def save_quiz(
        self,
        info: strawberry.Info,
        module_id: strawberry.ID,
        title: str,
        pass_percentage: int,
        questions: list[QuestionInput],
    ) -> AuthoringPayload:
        try:
            quiz = authoring.save_quiz(
                info.context.user,
                module_id,
                title,
                pass_percentage,
                [
                    authoring.QuestionInput(
                        prompt=q.prompt,
                        options=[authoring.OptionInput(o.text, o.correct) for o in q.options],
                        kind=q.kind,
                        code=q.code,
                        explanation=q.explanation,
                    )
                    for q in questions
                ],
            )
        except LearningError as exc:
            return _failed(exc)
        return _done('Quiz saved.', quiz.pk)

    @strawberry.mutation
    def delete_quiz(self, info: strawberry.Info, module_id: strawberry.ID) -> AuthoringPayload:
        try:
            authoring.delete_quiz(info.context.user, module_id)
        except LearningError as exc:
            return _failed(exc)
        return _done('Quiz deleted.')

    @strawberry.mutation(description='Add an external web page to a lesson.')
    def create_lesson_resource(
        self, info: strawberry.Info, lesson_id: strawberry.ID, input: ResourceInput
    ) -> AuthoringPayload:
        try:
            resource = authoring.create_resource(info.context.user, lesson_id, input.to_service())
        except LearningError as exc:
            return _failed(exc)
        return _done('Resource added.', resource.pk)

    @strawberry.mutation
    def update_lesson_resource(
        self, info: strawberry.Info, id: strawberry.ID, input: ResourceInput
    ) -> AuthoringPayload:
        try:
            resource = authoring.update_resource(info.context.user, id, input.to_service())
        except LearningError as exc:
            return _failed(exc)
        return _done('Resource saved.', resource.pk)

    @strawberry.mutation(description='Publish a resource to learners, or take it back.')
    def set_lesson_resource_published(
        self, info: strawberry.Info, id: strawberry.ID, published: bool
    ) -> AuthoringPayload:
        try:
            resource = authoring.set_resource_published(info.context.user, id, published)
        except LearningError as exc:
            return _failed(exc)
        return _done('Resource published.' if published else 'Resource unpublished.', resource.pk)

    @strawberry.mutation
    def delete_lesson_resource(self, info: strawberry.Info, id: strawberry.ID) -> AuthoringPayload:
        try:
            authoring.delete_resource(info.context.user, id)
        except LearningError as exc:
            return _failed(exc)
        return _done('Resource deleted.')

    @strawberry.mutation(description='Delete a file from a lesson.')
    def delete_lesson_material(self, info: strawberry.Info, id: strawberry.ID) -> AuthoringPayload:
        try:
            authoring.delete_material(info.context.user, id)
        except LearningError as exc:
            return _failed(exc)
        return _done('File deleted.')
