"""
Course authoring in the console, lesson files, and the one-time seed.

Administrators with `can_manage_courses` write everything learners see; nobody
else can write, or read the authoring view (solutions, hidden tests, answers).
"""

import io

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import Client

from identity.tokens import issue_access_token
from learning.models import (
    CodingExercise,
    Course,
    Enrollment,
    Lesson,
    LessonMaterial,
    LessonProgress,
)

CREATE_COURSE = """mutation($input: CourseInput!) {
  createCourse(input: $input) { success message field id }
}"""
PUBLISH = 'mutation($id: ID!) { publishCourse(id: $id) { success message } }'
CREATE_MODULE = """mutation($id: ID!, $input: ModuleInput!) {
  createModule(courseId: $id, input: $input) { success message id }
}"""
CREATE_LESSON = """mutation($id: ID!, $input: LessonInput!) {
  createLesson(moduleId: $id, input: $input) { success message field id }
}"""
UPDATE_LESSON = """mutation($id: ID!, $input: LessonInput!) {
  updateLesson(id: $id, input: $input) { success message field }
}"""
MOVE_LESSON = 'mutation($id: ID!, $d: Int!) { moveLesson(id: $id, direction: $d) { success } }'
REORDER_MODULES = """mutation($id: ID!, $ids: [ID!]!) {
  reorderModules(courseId: $id, ids: $ids) { success message }
}"""
REORDER_LESSONS = """mutation($id: ID!, $ids: [ID!]!) {
  reorderLessons(moduleId: $id, ids: $ids) { success message }
}"""
REORDER_EXERCISES = """mutation($id: ID!, $ids: [ID!]!) {
  reorderExercises(moduleId: $id, ids: $ids) { success message }
}"""
SAVE_EXERCISE = """mutation($module: ID!, $input: ExerciseInput!, $id: ID) {
  saveExercise(moduleId: $module, input: $input, id: $id) { success message field id }
}"""
SAVE_QUIZ = """mutation($module: ID!, $questions: [QuestionInput!]!) {
  saveQuiz(moduleId: $module, title: "Check", passPercentage: 60, questions: $questions) {
    success message field id
  }
}"""
DELETE_COURSE = 'mutation($id: ID!) { deleteCourse(id: $id) { success message } }'
ADMIN_COURSES = '{ adminCourses { title status lessonCount enrollmentCount } }'
ADMIN_COURSE = """query($id: ID!) {
  adminCourse(id: $id) {
    title status
    modules {
      title
      lessons { title materialCount }
      exercises { testCount hiddenTestCount }
      quiz { questionCount }
    }
  }
}"""
ADMIN_EXERCISE = (
    'query($id: ID!) { adminExercise(id: $id) { solutionCode tests { expectedOutput hidden } } }'
)
PREVIEW = 'query($s: String!) { previewContent(source: $s) { blocks { kind text } error } }'
CAPABILITIES = '{ adminCapabilities { canManageCourses } }'
LEARNER_LESSON = """query($id: ID!) {
  lesson(id: $id) { title blocks { kind text } materials { title filename downloadUrl } }
}"""
LEARNER_EXERCISE = """query($id: ID!) {
  exercise(id: $id) { title hiddenTestCount visibleTests { expectedOutput } }
}"""

EXERCISE_INPUT = {
    'title': 'Double it',
    'instructions': 'Write `double(n)`.',
    'solutionCode': 'def double(n):\n    return n * 2',
    'starterCode': 'def double(n):\n    pass',
    'hints': ['Multiply by 2.'],
    'tests': [
        {'name': 'double(2)', 'call': 'print(double(2))', 'expectedOutput': '4'},
        {'name': 'Hidden', 'call': 'print(double(-7))', 'expectedOutput': '-14', 'hidden': True},
    ],
}


def build_course(gql, manager) -> dict:
    """A manager's new course: one module, one lesson with notes. Returns the ids."""
    course = gql(
        CREATE_COURSE, {'input': {'title': 'Data with Python', 'level': 'beginner'}}, manager
    )
    course_id = course['createCourse']['id']
    module_id = gql(CREATE_MODULE, {'id': course_id, 'input': {'title': 'Basics'}}, manager)[
        'createModule'
    ]['id']
    lesson_id = gql(
        CREATE_LESSON,
        {'id': module_id, 'input': {'title': 'Welcome', 'body': '## Hello\nThese are the notes.'}},
        manager,
    )['createLesson']['id']
    return {'course': course_id, 'module': module_id, 'lesson': lesson_id}


@pytest.mark.django_db
class TestOnlyManagersAuthor:
    def test_the_capability_is_reported(self, gql, manager, learner):
        assert gql(CAPABILITIES, {}, manager)['adminCapabilities']['canManageCourses'] is True
        assert gql(CAPABILITIES, {}, learner)['adminCapabilities']['canManageCourses'] is False

    def test_a_learner_can_neither_write_nor_read_the_authoring_view(self, gql, manager, learner):
        ids = build_course(gql, manager)
        exercise = gql(SAVE_EXERCISE, {'module': ids['module'], 'input': EXERCISE_INPUT}, manager)

        assert (
            gql(CREATE_COURSE, {'input': {'title': 'Mine'}}, learner)['createCourse']['success']
            is False
        )
        assert gql(PUBLISH, {'id': ids['course']}, learner)['publishCourse']['success'] is False
        assert gql(ADMIN_COURSES, {}, learner)['adminCourses'] == []
        assert (
            gql(ADMIN_EXERCISE, {'id': exercise['saveExercise']['id']}, learner)['adminExercise']
            is None
        )
        assert Course.objects.count() == 1

    def test_the_courses_permission_alone_does_not_open_the_console(self, gql, learner):
        from django.contrib.auth.models import Permission

        learner.user_permissions.add(Permission.objects.get(codename='change_course'))

        result = gql(CREATE_COURSE, {'input': {'title': 'Sneaky'}}, learner)

        assert result['createCourse']['success'] is False


@pytest.mark.django_db
class TestAuthoringACourse:
    def test_a_new_course_is_a_draft_learners_cannot_see(self, gql, manager, learner):
        build_course(gql, manager)

        assert gql(ADMIN_COURSES, {}, manager)['adminCourses'] == [
            {'title': 'Data with Python', 'status': 'draft', 'lessonCount': 1, 'enrollmentCount': 0}
        ]
        assert gql('{ courses { slug } }', {}, learner)['courses'] == []

    def test_published_notes_reach_enrolled_learners(self, gql, manager, learner):
        ids = build_course(gql, manager)
        assert gql(PUBLISH, {'id': ids['course']}, manager)['publishCourse']['success']
        gql(
            'mutation($id: ID!) { enrollInCourse(courseId: $id) { success } }',
            {'id': ids['course']},
            learner,
        )

        lesson = gql(LEARNER_LESSON, {'id': ids['lesson']}, learner)['lesson']

        assert lesson['blocks'] == [
            {'kind': 'heading', 'text': 'Hello'},
            {'kind': 'paragraph', 'text': 'These are the notes.'},
        ]

    def test_editing_notes_keeps_learner_progress(self, gql, manager, learner):
        ids = build_course(gql, manager)
        course = Course.objects.get()
        enrollment = Enrollment.objects.create(user=learner, course=course)
        LessonProgress.objects.create(enrollment=enrollment, lesson_id=ids['lesson'])

        result = gql(
            UPDATE_LESSON,
            {'id': ids['lesson'], 'input': {'title': 'Welcome', 'body': 'Updated notes.'}},
            manager,
        )

        assert result['updateLesson']['success'] is True
        assert Lesson.objects.get().blocks.get().text == 'Updated notes.'
        assert LessonProgress.objects.count() == 1

    def test_notes_must_be_well_formed(self, gql, manager):
        ids = build_course(gql, manager)

        result = gql(
            UPDATE_LESSON,
            {'id': ids['lesson'], 'input': {'title': 'Welcome', 'body': '```python\nprint(1)'}},
            manager,
        )['updateLesson']

        assert result['success'] is False
        assert result['field'] == 'body'
        assert 'never closed' in result['message']

    def test_the_preview_shows_what_learners_will_read(self, gql, manager):
        preview = gql(PREVIEW, {'s': '- one\n- two'}, manager)['previewContent']
        broken = gql(PREVIEW, {'s': '```\nunclosed'}, manager)['previewContent']

        assert preview == {'blocks': [{'kind': 'list', 'text': 'one\ntwo'}], 'error': None}
        assert broken['error']

    def test_a_course_needs_a_lesson_before_it_is_published(self, gql, manager):
        course_id = gql(CREATE_COURSE, {'input': {'title': 'Empty'}}, manager)['createCourse']['id']

        result = gql(PUBLISH, {'id': course_id}, manager)['publishCourse']

        assert result['success'] is False

    def test_lessons_can_be_reordered(self, gql, manager):
        ids = build_course(gql, manager)
        second = gql(
            CREATE_LESSON, {'id': ids['module'], 'input': {'title': 'Second', 'body': 'x'}}, manager
        )['createLesson']['id']

        gql(MOVE_LESSON, {'id': second, 'd': -1}, manager)

        assert list(Lesson.objects.order_by('position').values_list('title', flat=True)) == [
            'Second',
            'Welcome',
        ]

    def test_dragging_puts_modules_in_the_order_given(self, gql, manager):
        ids = build_course(gql, manager)
        second = gql(CREATE_MODULE, {'id': ids['course'], 'input': {'title': 'Next'}}, manager)[
            'createModule'
        ]['id']
        third = gql(CREATE_MODULE, {'id': ids['course'], 'input': {'title': 'Last'}}, manager)[
            'createModule'
        ]['id']

        result = gql(
            REORDER_MODULES, {'id': ids['course'], 'ids': [third, ids['module'], second]}, manager
        )['reorderModules']

        assert result['success'] is True
        modules = gql(ADMIN_COURSE, {'id': ids['course']}, manager)['adminCourse']['modules']
        assert [module['title'] for module in modules] == ['Last', 'Basics', 'Next']

    def test_a_stale_or_partial_order_is_refused(self, gql, manager):
        ids = build_course(gql, manager)
        gql(CREATE_MODULE, {'id': ids['course'], 'input': {'title': 'Next'}}, manager)

        result = gql(REORDER_MODULES, {'id': ids['course'], 'ids': [ids['module']]}, manager)

        assert result['reorderModules']['success'] is False
        assert 'Reload' in result['reorderModules']['message']

    def test_dragging_reorders_lessons_within_a_module(self, gql, manager):
        ids = build_course(gql, manager)
        second = gql(
            CREATE_LESSON, {'id': ids['module'], 'input': {'title': 'Second', 'body': 'x'}}, manager
        )['createLesson']['id']

        gql(REORDER_LESSONS, {'id': ids['module'], 'ids': [second, ids['lesson']]}, manager)

        assert list(Lesson.objects.order_by('position').values_list('title', flat=True)) == [
            'Second',
            'Welcome',
        ]

    def test_a_lesson_dragged_to_another_module_moves_with_its_progress(
        self, gql, manager, learner
    ):
        ids = build_course(gql, manager)
        stays = gql(
            CREATE_LESSON, {'id': ids['module'], 'input': {'title': 'Stays', 'body': 'x'}}, manager
        )['createLesson']['id']
        other = gql(CREATE_MODULE, {'id': ids['course'], 'input': {'title': 'Next'}}, manager)[
            'createModule'
        ]['id']
        # Same slug as the moving lesson: the move must not collide with it.
        there = gql(
            CREATE_LESSON, {'id': other, 'input': {'title': 'Welcome', 'body': 'x'}}, manager
        )['createLesson']['id']
        exercise = gql(
            SAVE_EXERCISE,
            {'module': ids['module'], 'input': {**EXERCISE_INPUT, 'lessonId': ids['lesson']}},
            manager,
        )['saveExercise']['id']
        enrollment = Enrollment.objects.create(user=learner, course=Course.objects.get())
        LessonProgress.objects.create(enrollment=enrollment, lesson_id=ids['lesson'])

        result = gql(REORDER_LESSONS, {'id': other, 'ids': [ids['lesson'], there]}, manager)

        assert result['reorderLessons']['success'] is True
        moved = Lesson.objects.get(pk=ids['lesson'])
        assert (moved.module_id, moved.position) == (int(other), 1)
        assert moved.slug != Lesson.objects.get(pk=there).slug
        assert Lesson.objects.get(pk=stays).position == 1
        assert LessonProgress.objects.filter(lesson=moved).exists()
        assert CodingExercise.objects.get(pk=exercise).lesson_id is None

    def test_lessons_from_another_course_cannot_be_pulled_in(self, gql, manager):
        ids = build_course(gql, manager)
        elsewhere = build_course(gql, manager)

        result = gql(
            REORDER_LESSONS,
            {'id': ids['module'], 'ids': [ids['lesson'], elsewhere['lesson']]},
            manager,
        )

        assert result['reorderLessons']['success'] is False
        assert Lesson.objects.get(pk=elsewhere['lesson']).module_id == int(elsewhere['module'])

    def test_dragging_reorders_exercises(self, gql, manager):
        ids = build_course(gql, manager)
        first = gql(SAVE_EXERCISE, {'module': ids['module'], 'input': EXERCISE_INPUT}, manager)[
            'saveExercise'
        ]['id']
        second = gql(
            SAVE_EXERCISE,
            {'module': ids['module'], 'input': {**EXERCISE_INPUT, 'title': 'Triple it'}},
            manager,
        )['saveExercise']['id']

        gql(REORDER_EXERCISES, {'id': ids['module'], 'ids': [second, first]}, manager)

        assert list(
            CodingExercise.objects.order_by('position').values_list('title', flat=True)
        ) == ['Triple it', 'Double it']

    def test_learners_cannot_reorder(self, gql, manager, learner):
        ids = build_course(gql, manager)

        result = gql(REORDER_LESSONS, {'id': ids['module'], 'ids': [ids['lesson']]}, learner)

        assert result['reorderLessons']['success'] is False

    def test_a_course_with_learners_is_archived_not_deleted(self, gql, manager, learner):
        ids = build_course(gql, manager)
        Enrollment.objects.create(user=learner, course=Course.objects.get())

        result = gql(DELETE_COURSE, {'id': ids['course']}, manager)['deleteCourse']

        assert result['success'] is False
        assert 'Archive' in result['message']
        assert Course.objects.exists()

    def test_an_unused_course_can_be_deleted(self, gql, manager):
        ids = build_course(gql, manager)

        assert gql(DELETE_COURSE, {'id': ids['course']}, manager)['deleteCourse']['success']
        assert not Course.objects.exists()


@pytest.mark.django_db
class TestExercisesAndQuizzes:
    def test_an_exercise_keeps_its_secrets_from_learners(self, gql, manager, learner):
        ids = build_course(gql, manager)
        saved = gql(SAVE_EXERCISE, {'module': ids['module'], 'input': EXERCISE_INPUT}, manager)
        exercise_id = saved['saveExercise']['id']
        gql(PUBLISH, {'id': ids['course']}, manager)
        gql(
            'mutation($id: ID!) { enrollInCourse(courseId: $id) { success } }',
            {'id': ids['course']},
            learner,
        )

        authored = gql(ADMIN_EXERCISE, {'id': exercise_id}, manager)['adminExercise']
        seen = gql(LEARNER_EXERCISE, {'id': exercise_id}, learner)['exercise']

        assert 'return n * 2' in authored['solutionCode']
        assert {'expectedOutput': '-14', 'hidden': True} in authored['tests']
        assert seen['hiddenTestCount'] == 1
        assert seen['visibleTests'] == [{'expectedOutput': '4'}]

    @pytest.mark.parametrize(
        'tests',
        [
            [{'name': 'Only visible', 'expectedOutput': '1'}],
            [{'name': 'Only hidden', 'expectedOutput': '1', 'hidden': True}],
            [],
        ],
    )
    def test_an_exercise_needs_a_visible_and_a_hidden_test(self, gql, manager, tests):
        ids = build_course(gql, manager)

        result = gql(
            SAVE_EXERCISE,
            {'module': ids['module'], 'input': {**EXERCISE_INPUT, 'tests': tests}},
            manager,
        )['saveExercise']

        assert result['success'] is False
        assert not CodingExercise.objects.exists()

    def test_editing_an_exercise_replaces_its_tests(self, gql, manager):
        ids = build_course(gql, manager)
        exercise_id = gql(
            SAVE_EXERCISE, {'module': ids['module'], 'input': EXERCISE_INPUT}, manager
        )['saveExercise']['id']
        tests = [
            *EXERCISE_INPUT['tests'],
            {'name': 'Zero', 'call': 'print(double(0))', 'expectedOutput': '0', 'hidden': True},
        ]

        gql(
            SAVE_EXERCISE,
            {
                'module': ids['module'],
                'id': exercise_id,
                'input': {**EXERCISE_INPUT, 'tests': tests},
            },
            manager,
        )

        assert CodingExercise.objects.get().test_cases.count() == 3

    def test_a_quiz_is_checked_and_saved(self, gql, manager):
        ids = build_course(gql, manager)
        good = [
            {
                'prompt': 'What is 2 + 2?',
                'options': [{'text': '4', 'correct': True}, {'text': '5'}],
                'explanation': 'Arithmetic.',
            }
        ]
        no_answer = [{'prompt': 'Which?', 'options': [{'text': 'a'}, {'text': 'b'}]}]

        assert (
            gql(SAVE_QUIZ, {'module': ids['module'], 'questions': no_answer}, manager)['saveQuiz'][
                'success'
            ]
            is False
        )
        assert (
            gql(SAVE_QUIZ, {'module': ids['module'], 'questions': good}, manager)['saveQuiz'][
                'success'
            ]
            is True
        )
        overview = gql(ADMIN_COURSE, {'id': ids['course']}, manager)['adminCourse']
        assert overview['modules'][0]['quiz'] == {'questionCount': 1}


# --- lesson files ---------------------------------------------------------------------

PDF = b'%PDF-1.4\n%\xe2\xe3\xcf\xd3\ntrailer\n<< >>\n%%EOF'


def upload(client: Client, lesson_id, user, name='notes.pdf', content=PDF, title='Week 1 notes'):
    return client.post(
        f'/learning/lessons/{lesson_id}/materials/',
        data={'file': SimpleUploadedFile(name, content), 'title': title},
        HTTP_AUTHORIZATION=f'Bearer {issue_access_token(user.pk)[0]}',
    )


def download(client: Client, material_id, user=None):
    headers = {'HTTP_AUTHORIZATION': f'Bearer {issue_access_token(user.pk)[0]}'} if user else {}
    return client.get(f'/learning/materials/{material_id}/download/', **headers)


@pytest.mark.django_db
class TestLessonFiles:
    def test_a_manager_uploads_and_an_enrolled_learner_downloads(
        self, client, gql, manager, learner
    ):
        ids = build_course(gql, manager)
        response = upload(client, ids['lesson'], manager)
        assert response.status_code == 201, response.content
        material_id = response.json()['material']['id']
        gql(PUBLISH, {'id': ids['course']}, manager)

        assert download(client, material_id, learner).status_code == 404  # not enrolled yet
        gql(
            'mutation($id: ID!) { enrollInCourse(courseId: $id) { success } }',
            {'id': ids['course']},
            learner,
        )
        lesson = gql(LEARNER_LESSON, {'id': ids['lesson']}, learner)['lesson']
        served = download(client, material_id, learner)

        assert lesson['materials'] == [
            {
                'title': 'Week 1 notes',
                'filename': 'notes.pdf',
                'downloadUrl': f'/learning/materials/{material_id}/download/',
            }
        ]
        assert served.status_code == 200
        assert b''.join(served.streaming_content) == PDF
        assert served['Content-Disposition'].startswith('attachment;')
        assert LessonMaterial.objects.get().storage_key.startswith('learning/')

    def test_signed_out_callers_get_nothing(self, client, gql, manager):
        ids = build_course(gql, manager)
        material_id = upload(client, ids['lesson'], manager).json()['material']['id']

        assert download(client, material_id).status_code == 404

    def test_a_learner_cannot_upload(self, client, gql, manager, learner):
        ids = build_course(gql, manager)

        response = upload(client, ids['lesson'], learner)

        assert response.status_code == 403
        assert not LessonMaterial.objects.exists()

    @pytest.mark.parametrize(
        ('name', 'content'),
        [
            ('notes.exe', b'MZ\x90\x00'),
            ('notes.pdf', b'MZ\x90\x00 disguised'),
            ('slides.pptx', PDF),
            ('page.html', b'<script>alert(1)</script>'),
        ],
    )
    def test_unsafe_or_mislabelled_files_are_refused(self, client, gql, manager, name, content):
        ids = build_course(gql, manager)

        response = upload(client, ids['lesson'], manager, name=name, content=content)

        assert response.status_code == 400
        assert not LessonMaterial.objects.exists()

    def test_slides_and_python_files_are_accepted(self, client, gql, manager):
        ids = build_course(gql, manager)

        slides = upload(
            client, ids['lesson'], manager, name='slides.pptx', content=b'PK\x03\x04rest'
        )
        code = upload(client, ids['lesson'], manager, name='example.py', content=b'print("hi")\n')

        assert slides.status_code == 201
        assert code.json()['material']['contentType'] == 'text/x-python'

    def test_deleting_a_file_removes_it(
        self, client, gql, manager, django_capture_on_commit_callbacks
    ):
        ids = build_course(gql, manager)
        material_id = upload(client, ids['lesson'], manager).json()['material']['id']

        with django_capture_on_commit_callbacks(execute=True):
            result = gql(
                'mutation($id: ID!) { deleteLessonMaterial(id: $id) { success } }',
                {'id': material_id},
                manager,
            )

        assert result['deleteLessonMaterial']['success'] is True
        assert download(client, material_id, manager).status_code == 404


@pytest.mark.django_db
def test_existing_platform_administrators_are_given_the_courses():
    from importlib import import_module

    from django.apps import apps
    from django.contrib.auth.models import Group, Permission

    group = Group.objects.create(name='Platform administrators')
    admin = get_user_model().objects.create_user(email='old-admin@example.com', password='x')
    admin.groups.add(group)

    import_module(
        'learning.migrations.0002_platform_admins_manage_courses'
    ).grant_to_platform_administrators(apps, None)

    assert group.permissions.filter(
        pk=Permission.objects.get(content_type__app_label='learning', codename='change_course').pk
    ).exists()
    assert get_user_model().objects.get(pk=admin.pk).has_perm('learning.change_course')


@pytest.mark.django_db
class TestTheSeedRunsOnce:
    def test_it_loads_the_course_then_leaves_admin_edits_alone(self):
        call_command('seed_python_course', stdout=io.StringIO())
        lesson = Lesson.objects.order_by('pk').first()
        lesson.title = 'Edited by an administrator'
        lesson.save()

        out = io.StringIO()
        call_command('seed_python_course', '--publish', stdout=out)

        assert 'already loaded' in out.getvalue()
        lesson.refresh_from_db()
        assert lesson.title == 'Edited by an administrator'
        assert Course.objects.get().status == Course.Status.DRAFT
