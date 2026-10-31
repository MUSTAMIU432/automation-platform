"""
External learning resources: web pages a course manager adds to a lesson, shown
to learners in a frame (or as a link) once published. The server stores the
address and never fetches it.
"""

from unittest import mock

import pytest

from learning.models import LessonResource
from learning.tests.test_authoring import PUBLISH, build_course

HARRY = 'https://archive.codewithharry.com/tutorial/python-objects-classes/'

CREATE = """mutation($lesson: ID!, $input: ResourceInput!) {
  createLessonResource(lessonId: $lesson, input: $input) { success message field id }
}"""
UPDATE = """mutation($id: ID!, $input: ResourceInput!) {
  updateLessonResource(id: $id, input: $input) { success message field id }
}"""
SET_PUBLISHED = """mutation($id: ID!, $published: Boolean!) {
  setLessonResourcePublished(id: $id, published: $published) { success message }
}"""
DELETE = 'mutation($id: ID!) { deleteLessonResource(id: $id) { success message } }'
ADMIN_LESSON = """query($id: ID!) { adminLesson(id: $id) { resources {
  id title description url kind displayOrder isPublished
} } }"""
LEARNER_LESSON = """query($id: ID!) { lesson(id: $id) {
  title completed nextLessonId resources { id title description url kind }
} }"""
ONE = 'query($id: ID!) { lessonResource(id: $id) { title url kind } }'
COMPLETE = 'mutation($id: ID!) { completeLesson(lessonId: $id) { success } }'
ENROLL = 'mutation($id: ID!) { enrollInCourse(courseId: $id) { success } }'


def harry(**changes) -> dict:
    return {
        'title': 'Python Objects and Classes - CodeWithHarry',
        'description': 'Classes, objects and constructors, with examples.',
        'url': HARRY,
        'kind': 'embed',
        **changes,
    }


@pytest.fixture
def course(gql, manager, learner):
    ids = build_course(gql, manager)
    gql(PUBLISH, {'id': ids['course']}, manager)
    gql(ENROLL, {'id': ids['course']}, learner)
    return ids


def add(gql, manager, course, **changes) -> dict:
    return gql(CREATE, {'lesson': course['lesson'], 'input': harry(**changes)}, manager)[
        'createLessonResource'
    ]


@pytest.mark.django_db
class TestAddingAResource:
    def test_a_manager_adds_a_page_to_the_lesson_it_belongs_to(self, gql, manager, course):
        result = add(gql, manager, course, isPublished=True)

        assert result['success'] is True, result
        resources = gql(ADMIN_LESSON, {'id': course['lesson']}, manager)['adminLesson']
        assert resources['resources'] == [
            {
                'id': result['id'],
                'title': 'Python Objects and Classes - CodeWithHarry',
                'description': 'Classes, objects and constructors, with examples.',
                'url': HARRY,
                'kind': 'embed',
                'displayOrder': 1,
                'isPublished': True,
            }
        ]
        assert LessonResource.objects.get().created_by == manager

    def test_each_new_resource_goes_after_the_others_unless_placed(self, gql, manager, course):
        add(gql, manager, course, title='First')
        add(gql, manager, course, title='Second')
        add(gql, manager, course, title='Top', displayOrder=1)

        listed = gql(ADMIN_LESSON, {'id': course['lesson']}, manager)['adminLesson']['resources']

        assert [(r['title'], r['displayOrder']) for r in listed] == [
            ('First', 1),
            ('Top', 1),
            ('Second', 2),
        ]

    def test_the_server_never_fetches_the_page(self, gql, manager, course):
        with (
            mock.patch('requests.get') as get,
            mock.patch('requests.head') as head,
            mock.patch('urllib.request.urlopen') as urlopen,
        ):
            add(gql, manager, course, isPublished=True)

        get.assert_not_called()
        head.assert_not_called()
        urlopen.assert_not_called()

    @pytest.mark.parametrize(
        'url',
        [
            'javascript:alert(1)',
            'JAVASCRIPT:alert(document.cookie)',
            'data:text/html,<script>alert(1)</script>',
            'file:///etc/passwd',
            'ftp://example.com/notes',
            'vbscript:msgbox',
            '//example.com/no-scheme',
            'https://',
            'https://localhost/admin',
            'https://user:secret@example.com/',
            'https://exa mple.com/',
            'not a url',
            '',
            'https://example.com/' + 'a' * 2000,
        ],
    )
    def test_an_unsafe_or_invalid_address_is_refused(self, gql, manager, course, url):
        result = add(gql, manager, course, url=url)

        assert result['success'] is False
        assert result['field'] == 'url'
        assert not LessonResource.objects.exists()

    def test_a_title_and_a_known_kind_are_required(self, gql, manager, course):
        assert add(gql, manager, course, title='  ')['field'] == 'title'
        assert add(gql, manager, course, kind='script')['field'] == 'kind'

    def test_an_http_page_and_a_link_only_page_are_allowed(self, gql, manager, course):
        assert add(gql, manager, course, url='http://example.org/page')['success'] is True
        assert add(gql, manager, course, kind='link')['success'] is True


@pytest.mark.django_db
class TestOnlyManagersManage:
    def test_a_learner_can_neither_add_change_publish_nor_delete(
        self, gql, manager, learner, course
    ):
        resource_id = add(gql, manager, course)['id']

        assert add(gql, learner, course)['success'] is False
        changed = gql(UPDATE, {'id': resource_id, 'input': harry(title='Mine')}, learner)
        published = gql(SET_PUBLISHED, {'id': resource_id, 'published': True}, learner)
        deleted = gql(DELETE, {'id': resource_id}, learner)

        assert changed['updateLessonResource']['success'] is False
        assert published['setLessonResourcePublished']['success'] is False
        assert deleted['deleteLessonResource']['success'] is False
        resource = LessonResource.objects.get()
        assert (resource.title, resource.is_published) == (harry()['title'], False)
        assert gql(ADMIN_LESSON, {'id': course['lesson']}, learner)['adminLesson'] is None

    def test_signed_out_callers_can_do_nothing(self, gql, manager, course):
        assert add(gql, None, course)['success'] is False


@pytest.mark.django_db
class TestWhatLearnersSee:
    def test_a_published_resource_shows_in_its_lesson(self, gql, manager, learner, course):
        resource_id = add(gql, manager, course, isPublished=True)['id']

        lesson = gql(LEARNER_LESSON, {'id': course['lesson']}, learner)['lesson']

        assert lesson['resources'] == [
            {
                'id': resource_id,
                'title': 'Python Objects and Classes - CodeWithHarry',
                'description': 'Classes, objects and constructors, with examples.',
                'url': HARRY,
                'kind': 'embed',
            }
        ]
        assert gql(ONE, {'id': resource_id}, learner)['lessonResource']['url'] == HARRY

    def test_an_unpublished_resource_is_hidden_until_published(self, gql, manager, learner, course):
        resource_id = add(gql, manager, course)['id']

        assert gql(LEARNER_LESSON, {'id': course['lesson']}, learner)['lesson']['resources'] == []
        assert gql(ONE, {'id': resource_id}, learner)['lessonResource'] is None

        gql(SET_PUBLISHED, {'id': resource_id, 'published': True}, manager)
        assert len(gql(LEARNER_LESSON, {'id': course['lesson']}, learner)['lesson']['resources'])

        gql(SET_PUBLISHED, {'id': resource_id, 'published': False}, manager)
        assert gql(LEARNER_LESSON, {'id': course['lesson']}, learner)['lesson']['resources'] == []

    def test_a_learner_not_enrolled_sees_no_resource(self, gql, manager, other_learner, course):
        resource_id = add(gql, manager, course, isPublished=True)['id']

        assert gql(ONE, {'id': resource_id}, other_learner)['lessonResource'] is None
        assert gql(ONE, {'id': resource_id})['lessonResource'] is None

    def test_completing_the_lesson_and_moving_on_still_work(self, gql, manager, learner, course):
        add(gql, manager, course, isPublished=True)

        result = gql(COMPLETE, {'id': course['lesson']}, learner)['completeLesson']

        assert result['success'] is True
        assert gql(LEARNER_LESSON, {'id': course['lesson']}, learner)['lesson']['completed'] is True


@pytest.mark.django_db
class TestChangingAResource:
    def test_a_manager_edits_and_deletes_it(self, gql, manager, learner, course):
        resource_id = add(gql, manager, course, isPublished=True)['id']

        updated = gql(
            UPDATE,
            {'id': resource_id, 'input': harry(title='Classes', kind='link', isPublished=True)},
            manager,
        )['updateLessonResource']
        assert updated['success'] is True
        lesson = gql(LEARNER_LESSON, {'id': course['lesson']}, learner)['lesson']
        assert [(r['title'], r['kind']) for r in lesson['resources']] == [('Classes', 'link')]

        assert gql(DELETE, {'id': resource_id}, manager)['deleteLessonResource']['success']
        assert not LessonResource.objects.exists()

    def test_a_bad_address_on_edit_changes_nothing(self, gql, manager, course):
        resource_id = add(gql, manager, course)['id']

        result = gql(UPDATE, {'id': resource_id, 'input': harry(url='javascript:x')}, manager)

        assert result['updateLessonResource']['field'] == 'url'
        assert LessonResource.objects.get().url == HARRY


# --- from the course files --------------------------------------------------------------

RESOURCE_TOML = """
[[lessons.resources]]
title = "Objects and classes"
description = "A tutorial."
url = "https://archive.codewithharry.com/tutorial/python-objects-classes/"
"""


def _course_files(tmp_path, *, resource: str = RESOURCE_TOML):
    from learning.tests.conftest import COURSE, MODULE

    # Under the first lesson: before the second one's table begins.
    second = '[[lessons]]\nslug = "second"'
    module = MODULE.replace(second, resource.lstrip('\n') + '\n' + second, 1)
    assert resource in module
    (tmp_path / 'modules').mkdir(exist_ok=True)
    (tmp_path / 'course.toml').write_text(COURSE, encoding='utf-8')
    (tmp_path / 'modules' / '01.toml').write_text(module, encoding='utf-8')
    return tmp_path


@pytest.mark.django_db
class TestFromTheCourseFiles:
    def test_a_new_course_comes_with_its_resources_published(self, tmp_path):
        from learning.content import sync_course

        report = sync_course(_course_files(tmp_path), publish=True)

        resource = LessonResource.objects.get()
        assert report.resources == 1
        assert (resource.lesson.slug, resource.title, resource.kind, resource.is_published) == (
            'first',
            'Objects and classes',
            'embed',
            True,
        )

    def test_a_loaded_course_gets_only_the_resources_it_lacks(self, tmp_path):
        from learning.content import add_missing_resources, sync_course

        files = _course_files(tmp_path, resource='')
        sync_course(files, publish=True)
        assert not LessonResource.objects.exists()
        _course_files(tmp_path)

        assert add_missing_resources(files) == 1
        assert add_missing_resources(files) == 0
        assert LessonResource.objects.count() == 1

    def test_an_administrators_changes_to_it_are_kept(self, tmp_path):
        from learning.content import add_missing_resources, sync_course

        files = _course_files(tmp_path)
        sync_course(files, publish=True)
        LessonResource.objects.update(title='Renamed', is_published=False)

        assert add_missing_resources(files) == 0
        sync_course(files)  # a reload from the files keeps it as well
        resource = LessonResource.objects.get()
        assert (resource.title, resource.is_published) == ('Renamed', False)

    def test_an_unsafe_address_in_the_files_stops_the_load(self, tmp_path):
        from learning.content import ContentError, sync_course

        bad = RESOURCE_TOML.replace('https://archive', 'javascript://archive')
        with pytest.raises(ContentError, match='https://'):
            sync_course(_course_files(tmp_path, resource=bad), publish=True)
        assert not LessonResource.objects.exists()

    def test_the_python_course_reads_codewithharry_in_its_classes_lesson(self):
        from learning.content import CONTENT_ROOT, sync_course

        sync_course(CONTENT_ROOT / 'python', publish=True)

        resource = LessonResource.objects.get(url=HARRY)
        assert resource.lesson.module.title == 'Object-Oriented Programming'
        assert resource.lesson.title == 'Classes, objects, encapsulation and properties'
        assert resource.is_published is True


@pytest.mark.django_db
class TestOnTheCoursePage:
    COURSE = """query($slug: String!) { course(slug: $slug) { modules { lessons {
      title resources { title url kind }
    } } } }"""

    def test_the_course_lists_each_lessons_published_resources(self, gql, manager, learner, course):
        add(gql, manager, course, isPublished=True)
        add(gql, manager, course, title='Draft page', url='https://example.org/draft')

        modules = gql(self.COURSE, {'slug': 'data-with-python'}, learner)['course']['modules']

        assert modules[0]['lessons'][0] == {
            'title': 'Welcome',
            'resources': [
                {
                    'title': 'Python Objects and Classes - CodeWithHarry',
                    'url': HARRY,
                    'kind': 'embed',
                }
            ],
        }


@pytest.mark.django_db
class TestCroppingTheFrame:
    LEARNER = 'query($id: ID!) { lesson(id: $id) { resources { cropTop } } }'

    def test_a_manager_hides_the_top_of_the_page_and_learners_get_it(
        self, gql, manager, learner, course
    ):
        result = add(gql, manager, course, isPublished=True, cropTop=135)

        assert result['success'] is True
        lesson = gql(self.LEARNER, {'id': course['lesson']}, learner)['lesson']
        assert lesson['resources'] == [{'cropTop': 135}]

    def test_the_whole_page_shows_unless_asked(self, gql, manager, learner, course):
        add(gql, manager, course, isPublished=True)

        lesson = gql(self.LEARNER, {'id': course['lesson']}, learner)['lesson']
        assert lesson['resources'] == [{'cropTop': 0}]

    @pytest.mark.parametrize('crop', [-1, 401, 5000])
    def test_hiding_too_much_or_a_negative_amount_is_refused(self, gql, manager, course, crop):
        assert add(gql, manager, course, cropTop=crop)['field'] == 'cropTop'
        assert not LessonResource.objects.exists()
