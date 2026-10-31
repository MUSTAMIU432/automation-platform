"""
Courses, and each learner's way through one.

Content (what a course teaches) and progress (how far one learner has got) are
two separate halves, and nothing in the second half is a copy of the first:

    Course              the course itself, and whether it is draft, published or archived.
    CourseModule        one numbered part of a course.
    Lesson              one lesson in a module.
    LessonContent       one block of a lesson: a heading, a paragraph, a list, code, a note.
    CodingExercise      a coding task in a module, with starter code and a reference solution.
    ExerciseTestCase    one server-side check of an exercise; hidden or shown to the learner.
    Quiz                the end-of-module quiz.
    Question            one quiz question.
    AnswerOption        one answer to a question, and whether it is correct.

    Enrollment          one learner in one course. All progress hangs off this.
    LessonProgress      a lesson the learner has completed.
    ExerciseSubmission  one graded attempt at an exercise.
    AssessmentAttempt   one attempt at a quiz.
    CapstoneSubmission  the learner's final project.
    CourseCompletion    the course, finished.

**Content is authored as data, not code.** `learning.content` loads it from the
TOML files under `learning/content/` (see `seed_python_course`), so a lesson is
added by editing a file, never by changing this module.

**What a learner may never see** lives only here and in the grading code:
`CodingExercise.solution_code`, every hidden `ExerciseTestCase` and every test's
`expected_output`, and `AnswerOption.is_correct`. The GraphQL types in
`learning.schema` are built field by field, so none of these can reach a response
by being added to a model.
"""

import uuid
from typing import ClassVar

from django.conf import settings
from django.db import models

CODE_MAX_LENGTH = 20_000


class Course(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        PUBLISHED = 'published', 'Published'
        ARCHIVED = 'archived', 'Archived'

    class Level(models.TextChoices):
        BEGINNER = 'beginner', 'Beginner'
        INTERMEDIATE = 'intermediate', 'Intermediate'
        ADVANCED = 'advanced', 'Advanced'
        ALL_LEVELS = 'all_levels', 'Beginner to advanced'

    slug = models.SlugField(max_length=100, unique=True)
    title = models.CharField(max_length=200)
    subtitle = models.CharField(max_length=300, blank=True)
    description = models.TextField(blank=True)
    level = models.CharField(max_length=20, choices=Level.choices, default=Level.ALL_LEVELS)
    estimated_hours = models.PositiveIntegerField(default=0)
    audience = models.JSONField(default=list, blank=True, help_text='Who the course is for.')
    outcomes = models.JSONField(default=list, blank=True, help_text='What a learner can do after.')
    capstone = models.JSONField(
        default=dict,
        blank=True,
        help_text='The final project: brief, requirements and options ({key, title, summary}).',
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering: ClassVar = ['title']
        indexes: ClassVar = [models.Index(fields=['status'], name='learning_course_status')]

    def __str__(self) -> str:
        return self.title


class CourseModule(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='modules')
    position = models.PositiveIntegerField()
    slug = models.SlugField(max_length=100)
    title = models.CharField(max_length=200)
    summary = models.TextField(blank=True)
    objectives = models.JSONField(default=list, blank=True)
    project = models.TextField(blank=True, help_text="The module's practical project.")

    class Meta:
        ordering: ClassVar = ['course', 'position']
        constraints: ClassVar = [
            models.UniqueConstraint(fields=['course', 'position'], name='learning_module_position'),
            models.UniqueConstraint(fields=['course', 'slug'], name='learning_module_slug'),
        ]

    def __str__(self) -> str:
        return f'{self.position}. {self.title}'


class Lesson(models.Model):
    module = models.ForeignKey(CourseModule, on_delete=models.CASCADE, related_name='lessons')
    position = models.PositiveIntegerField()
    slug = models.SlugField(max_length=100)
    title = models.CharField(max_length=200)
    summary = models.TextField(blank=True)
    objectives = models.JSONField(default=list, blank=True)
    estimated_minutes = models.PositiveIntegerField(default=15)
    body = models.TextField(
        blank=True,
        help_text='The notes as written, in the Markdown subset; `blocks` is what learners read.',
    )

    class Meta:
        ordering: ClassVar = ['module', 'position']
        constraints: ClassVar = [
            models.UniqueConstraint(fields=['module', 'position'], name='learning_lesson_position'),
            models.UniqueConstraint(fields=['module', 'slug'], name='learning_lesson_slug'),
        ]

    def __str__(self) -> str:
        return self.title


class LessonContent(models.Model):
    """
    One block of a lesson, in reading order. Plain text with a tiny inline syntax
    (`code` and **bold**) that the frontend renders as elements - never as HTML.
    """

    class Kind(models.TextChoices):
        HEADING = 'heading', 'Heading'
        PARAGRAPH = 'paragraph', 'Paragraph'
        LIST = 'list', 'List'
        CODE = 'code', 'Code'
        NOTE = 'note', 'Note'

    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='blocks')
    position = models.PositiveIntegerField()
    kind = models.CharField(max_length=20, choices=Kind.choices)
    text = models.TextField(help_text='A list holds one item per line.')
    language = models.CharField(max_length=20, blank=True, help_text='Code blocks only.')

    class Meta:
        ordering: ClassVar = ['lesson', 'position']
        constraints: ClassVar = [
            models.UniqueConstraint(fields=['lesson', 'position'], name='learning_block_position'),
        ]

    def __str__(self) -> str:
        return f'{self.lesson} #{self.position} ({self.kind})'


class LessonMaterial(models.Model):
    """
    A file an administrator attached to a lesson - notes, slides, a worksheet. The
    bytes live in object storage (`ideas.storage`, R2 when deployed) under a
    server-generated key; this row is the only record that they exist.
    """

    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='materials')
    title = models.CharField(max_length=200)
    filename = models.CharField(max_length=255)
    content_type = models.CharField(max_length=120)
    size = models.PositiveBigIntegerField()
    storage_key = models.CharField(max_length=500, unique=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering: ClassVar = ['lesson', 'created_at']

    def __str__(self) -> str:
        return self.title


class LessonResource(models.Model):
    """
    An external web page that belongs to a lesson - shown inside it in a frame, or
    linked from it when the site does not allow framing.

    The page loads in the learner's browser straight from its own site: the server
    stores the address and never fetches it (no proxy, no copying of content). Only
    http and https addresses are accepted (`learning.authoring`), and learners see a
    resource only once it is published.
    """

    class Kind(models.TextChoices):
        EMBED = 'embed', 'Embedded webpage'
        LINK = 'link', 'Link to the page'

    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='resources')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    url = models.URLField(max_length=2000)
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.EMBED)
    position = models.PositiveIntegerField(default=1, help_text='Display order in the lesson.')
    crop_top = models.PositiveSmallIntegerField(
        default=0,
        help_text=(
            "Pixels of the page's top hidden by MUSTANET's frame (a site's own header, say). "
            'Only the frame is cropped; the page itself is never changed.'
        ),
    )
    is_published = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering: ClassVar = ['lesson', 'position', 'pk']

    def __str__(self) -> str:
        return self.title


class CodingExercise(models.Model):
    class Difficulty(models.TextChoices):
        EASY = 'easy', 'Easy'
        MEDIUM = 'medium', 'Medium'
        HARD = 'hard', 'Hard'

    module = models.ForeignKey(CourseModule, on_delete=models.CASCADE, related_name='exercises')
    lesson = models.ForeignKey(
        Lesson,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='exercises',
        help_text='The lesson this practises, shown as a related exercise there.',
    )
    position = models.PositiveIntegerField()
    slug = models.SlugField(max_length=100)
    title = models.CharField(max_length=200)
    difficulty = models.CharField(
        max_length=10, choices=Difficulty.choices, default=Difficulty.EASY
    )
    instructions_source = models.TextField(
        blank=True, help_text='The instructions as written, in the Markdown subset.'
    )
    instructions = models.JSONField(
        default=list, help_text='Content blocks, in the same shape as LessonContent.'
    )
    starter_code = models.TextField(blank=True)
    solution_code = models.TextField(help_text='Never sent to a learner.')
    hints = models.JSONField(default=list, blank=True)

    class Meta:
        ordering: ClassVar = ['module', 'position']
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=['module', 'position'], name='learning_exercise_position'
            ),
            models.UniqueConstraint(fields=['module', 'slug'], name='learning_exercise_slug'),
        ]

    def __str__(self) -> str:
        return self.title


class ExerciseTestCase(models.Model):
    """
    One check, run in the sandbox: the learner's code, then `call` (if any), fed
    `stdin`. Only the output after the grader's own marker counts, and it is
    compared here, on the server - so `expected_output` never leaves it.
    """

    exercise = models.ForeignKey(
        CodingExercise, on_delete=models.CASCADE, related_name='test_cases'
    )
    position = models.PositiveIntegerField()
    name = models.CharField(max_length=200)
    stdin = models.TextField(blank=True)
    call = models.TextField(
        blank=True, help_text='Python run after the learner code, e.g. print(add(2, 3)).'
    )
    expected_output = models.TextField(blank=True)
    is_hidden = models.BooleanField(default=False)

    class Meta:
        ordering: ClassVar = ['exercise', 'position']
        constraints: ClassVar = [
            models.UniqueConstraint(fields=['exercise', 'position'], name='learning_test_position'),
        ]

    def __str__(self) -> str:
        return f'{self.exercise}: {self.name}'


class Quiz(models.Model):
    module = models.OneToOneField(CourseModule, on_delete=models.CASCADE, related_name='quiz')
    title = models.CharField(max_length=200)
    pass_percentage = models.PositiveIntegerField(default=70)

    class Meta:
        verbose_name_plural = 'quizzes'

    def __str__(self) -> str:
        return self.title


class Question(models.Model):
    class Kind(models.TextChoices):
        SINGLE = 'single', 'One answer'
        MULTIPLE = 'multiple', 'Every correct answer'

    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name='questions')
    position = models.PositiveIntegerField()
    prompt = models.TextField()
    code = models.TextField(blank=True, help_text='An optional snippet the question is about.')
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.SINGLE)
    explanation = models.TextField(blank=True, help_text='Shown once the quiz is submitted.')

    class Meta:
        ordering: ClassVar = ['quiz', 'position']
        constraints: ClassVar = [
            models.UniqueConstraint(fields=['quiz', 'position'], name='learning_question_position'),
        ]

    def __str__(self) -> str:
        return self.prompt[:80]


class AnswerOption(models.Model):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='options')
    position = models.PositiveIntegerField()
    text = models.TextField()
    is_correct = models.BooleanField(default=False)

    class Meta:
        ordering: ClassVar = ['question', 'position']
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=['question', 'position'], name='learning_option_position'
            ),
        ]

    def __str__(self) -> str:
        return self.text[:80]


# --- one learner's progress -----------------------------------------------------------


class Enrollment(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='enrollments'
    )
    course = models.ForeignKey(Course, on_delete=models.PROTECT, related_name='enrollments')
    enrolled_at = models.DateTimeField(auto_now_add=True)
    last_activity_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering: ClassVar = ['-last_activity_at']
        constraints: ClassVar = [
            models.UniqueConstraint(fields=['user', 'course'], name='learning_one_enrollment'),
        ]
        indexes: ClassVar = [
            models.Index(fields=['user', '-last_activity_at'], name='learning_enrollment_recent'),
        ]

    def __str__(self) -> str:
        return f'{self.user} in {self.course}'


class LessonProgress(models.Model):
    enrollment = models.ForeignKey(
        Enrollment, on_delete=models.CASCADE, related_name='lesson_progress'
    )
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='progress')
    completed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(fields=['enrollment', 'lesson'], name='learning_lesson_once'),
        ]

    def __str__(self) -> str:
        return f'{self.enrollment}: {self.lesson}'


class ExerciseSubmission(models.Model):
    class Status(models.TextChoices):
        PASSED = 'passed', 'Passed'
        FAILED = 'failed', 'Failed'

    enrollment = models.ForeignKey(
        Enrollment, on_delete=models.CASCADE, related_name='exercise_submissions'
    )
    exercise = models.ForeignKey(
        CodingExercise, on_delete=models.CASCADE, related_name='submissions'
    )
    code = models.TextField(max_length=CODE_MAX_LENGTH)
    status = models.CharField(max_length=10, choices=Status.choices)
    passed_count = models.PositiveIntegerField()
    total_count = models.PositiveIntegerField()
    results = models.JSONField(
        default=list, help_text='What the learner may see of each test - never a hidden one.'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering: ClassVar = ['-created_at']
        indexes: ClassVar = [
            models.Index(
                fields=['enrollment', 'exercise', '-created_at'], name='learning_submission_recent'
            ),
        ]
        constraints: ClassVar = [
            models.CheckConstraint(
                condition=models.Q(passed_count__lte=models.F('total_count')),
                name='learning_submission_counts',
            ),
        ]

    def __str__(self) -> str:
        return f'{self.exercise} ({self.status})'


class AssessmentAttempt(models.Model):
    enrollment = models.ForeignKey(
        Enrollment, on_delete=models.CASCADE, related_name='assessment_attempts'
    )
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name='attempts')
    answers = models.JSONField(default=dict, help_text='{question id: [option id, ...]}')
    score = models.PositiveIntegerField()
    max_score = models.PositiveIntegerField()
    percentage = models.PositiveIntegerField()
    passed = models.BooleanField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering: ClassVar = ['-created_at']
        indexes: ClassVar = [
            models.Index(
                fields=['enrollment', 'quiz', '-created_at'], name='learning_attempt_recent'
            ),
        ]
        constraints: ClassVar = [
            models.CheckConstraint(
                condition=models.Q(score__lte=models.F('max_score'))
                & models.Q(percentage__lte=100),
                name='learning_attempt_score',
            ),
        ]

    def __str__(self) -> str:
        return f'{self.quiz}: {self.percentage}%'


class CapstoneSubmission(models.Model):
    """
    The final project. Its code lives where the learner keeps it (a repository);
    what is recorded here is where to find it and the learner's own account of it.
    """

    enrollment = models.OneToOneField(Enrollment, on_delete=models.CASCADE, related_name='capstone')
    option = models.CharField(max_length=50)
    repository_url = models.URLField(max_length=500)
    documentation_url = models.URLField(max_length=500, blank=True)
    how_to_run = models.TextField(help_text='How to install, run and test the project.')
    design_decisions = models.TextField(help_text='A short explanation of the design.')
    submitted_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f'{self.enrollment}: {self.option}'


class CourseCompletion(models.Model):
    enrollment = models.OneToOneField(
        Enrollment, on_delete=models.CASCADE, related_name='completion'
    )
    completed_at = models.DateTimeField(auto_now_add=True)
    certificate_code = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)

    def __str__(self) -> str:
        return f'{self.enrollment} completed'
