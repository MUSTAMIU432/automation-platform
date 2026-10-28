"""
Course authoring in the Django admin.

Content is normally loaded from `learning/content/` (`seed_python_course`), and
re-running that overwrites edits made here to the same lesson - so this admin is
for publishing, archiving and quick fixes, and the files stay the source of truth.
Learner records are read-only here: progress is earned, never typed in.
"""

from typing import ClassVar

from django.contrib import admin
from django.utils import timezone

from learning.models import (
    AnswerOption,
    AssessmentAttempt,
    CapstoneSubmission,
    CodingExercise,
    Course,
    CourseCompletion,
    CourseModule,
    Enrollment,
    ExerciseSubmission,
    ExerciseTestCase,
    Lesson,
    LessonContent,
    Question,
    Quiz,
)


class CourseModuleInline(admin.TabularInline):
    model = CourseModule
    fields: ClassVar[list[str]] = ['position', 'slug', 'title']
    extra = 0
    show_change_link = True


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display: ClassVar[list[str]] = ['title', 'slug', 'level', 'status', 'published_at']
    list_filter: ClassVar[list[str]] = ['status', 'level']
    search_fields: ClassVar[list[str]] = ['title', 'slug']
    readonly_fields: ClassVar[list[str]] = ['published_at', 'created_at', 'updated_at']
    inlines: ClassVar = [CourseModuleInline]
    actions: ClassVar[list[str]] = ['publish', 'archive', 'unpublish']

    @admin.action(description='Publish the selected courses')
    def publish(self, request, queryset):
        for course in queryset.exclude(status=Course.Status.PUBLISHED):
            course.status = Course.Status.PUBLISHED
            course.published_at = course.published_at or timezone.now()
            course.save(update_fields=['status', 'published_at', 'updated_at'])

    @admin.action(description='Archive the selected courses (enrolled learners keep access)')
    def archive(self, request, queryset):
        queryset.update(status=Course.Status.ARCHIVED, updated_at=timezone.now())

    @admin.action(description='Return the selected courses to draft')
    def unpublish(self, request, queryset):
        queryset.update(status=Course.Status.DRAFT, updated_at=timezone.now())


class LessonInline(admin.TabularInline):
    model = Lesson
    fields: ClassVar[list[str]] = ['position', 'slug', 'title', 'estimated_minutes']
    extra = 0
    show_change_link = True


@admin.register(CourseModule)
class CourseModuleAdmin(admin.ModelAdmin):
    list_display: ClassVar[list[str]] = ['title', 'course', 'position']
    list_filter: ClassVar[list[str]] = ['course']
    inlines: ClassVar = [LessonInline]


class LessonContentInline(admin.StackedInline):
    model = LessonContent
    extra = 0


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display: ClassVar[list[str]] = ['title', 'module', 'position']
    list_filter: ClassVar[list[str]] = ['module__course']
    search_fields: ClassVar[list[str]] = ['title', 'slug']
    inlines: ClassVar = [LessonContentInline]


class ExerciseTestCaseInline(admin.StackedInline):
    model = ExerciseTestCase
    extra = 0


@admin.register(CodingExercise)
class CodingExerciseAdmin(admin.ModelAdmin):
    list_display: ClassVar[list[str]] = ['title', 'module', 'difficulty', 'position']
    list_filter: ClassVar[list[str]] = ['module__course', 'difficulty']
    inlines: ClassVar = [ExerciseTestCaseInline]


class AnswerOptionInline(admin.TabularInline):
    model = AnswerOption
    extra = 0


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display: ClassVar[list[str]] = ['prompt', 'quiz', 'kind', 'position']
    list_filter: ClassVar[list[str]] = ['quiz__module__course']
    inlines: ClassVar = [AnswerOptionInline]


@admin.register(Quiz)
class QuizAdmin(admin.ModelAdmin):
    list_display: ClassVar[list[str]] = ['title', 'module', 'pass_percentage']


class ReadOnlyAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(Enrollment)
class EnrollmentAdmin(ReadOnlyAdmin):
    list_display: ClassVar[list[str]] = ['user', 'course', 'enrolled_at', 'last_activity_at']
    list_filter: ClassVar[list[str]] = ['course']
    search_fields: ClassVar[list[str]] = ['user__email']


@admin.register(ExerciseSubmission)
class ExerciseSubmissionAdmin(ReadOnlyAdmin):
    list_display: ClassVar[list[str]] = [
        'exercise',
        'enrollment',
        'status',
        'passed_count',
        'total_count',
        'created_at',
    ]
    list_filter: ClassVar[list[str]] = ['status']


@admin.register(AssessmentAttempt)
class AssessmentAttemptAdmin(ReadOnlyAdmin):
    list_display: ClassVar[list[str]] = ['quiz', 'enrollment', 'percentage', 'passed', 'created_at']
    list_filter: ClassVar[list[str]] = ['passed']


@admin.register(CapstoneSubmission)
class CapstoneSubmissionAdmin(ReadOnlyAdmin):
    list_display: ClassVar[list[str]] = ['enrollment', 'option', 'repository_url', 'updated_at']


@admin.register(CourseCompletion)
class CourseCompletionAdmin(ReadOnlyAdmin):
    list_display: ClassVar[list[str]] = ['enrollment', 'completed_at', 'certificate_code']
