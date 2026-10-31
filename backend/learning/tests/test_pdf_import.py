"""
Lesson notes made from an uploaded PDF (learning/pdf_import.py), on upload and for
lessons uploaded before - a whole course guide as lessons in the outline, and
never over notes somebody wrote.
"""

import io

import pytest
from django.core.management import call_command

from learning.authoring import PDF_PLACEHOLDER_BODY
from learning.models import Lesson
from learning.pdf_import import lessons_from_pdf
from learning.tests.pdf_samples import blank_pdf, course_guide_pdf, lesson_pdf
from learning.tests.test_authoring import CREATE_LESSON, build_course, upload

LEARNER_BLOCKS = """query($id: ID!) { lesson(id: $id) {
  summary objectives estimatedMinutes blocks { kind text language }
} }"""


class TestReadingALessonPdf:
    def test_one_level_of_headings_is_one_lesson_with_sections_lists_code_objectives(self):
        lessons = lessons_from_pdf(lesson_pdf(pages=3), title='What Python is')

        assert len(lessons) == 1
        lesson = lessons[0]
        assert lesson.title == ''  # the lesson it was uploaded to keeps its own
        assert lesson.objectives == [
            'Describe what Python is',
            'Install Python and check the version',
        ]
        assert lesson.summary == (
            'Python is a general-purpose programming language that is easy to read and '
            'beginner-friendly.'
        )
        assert lesson.estimated_minutes >= 5
        body = lesson.body
        assert body.startswith('## Section 1: Why Python matters\n\nPython is a general-purpose')
        assert '- Web backends with Django\n- Automation scripts' in body
        assert '```python\ndef greet(name):\n    print("Hello", name)\ngreet("Ada")\n```' in body
        # The file's title (the page shows the lesson's), running header and page numbers go.
        assert '## What Python is' not in body
        assert 'Course notes' not in body
        assert '\n\n1\n\n' not in body
        assert body.count('## Section') == 3

    def test_a_short_document_loses_its_header_too(self):
        lessons = lessons_from_pdf(lesson_pdf(pages=1), title='What Python is')

        assert lessons[0].body.startswith('## Section 1')

    @pytest.mark.parametrize('data', [blank_pdf(), b'not a pdf at all', b''])
    def test_a_scan_or_a_broken_file_gives_nothing(self, data):
        assert lessons_from_pdf(data, title='Anything') == []


@pytest.fixture(scope='module')
def lessons():
    return lessons_from_pdf(course_guide_pdf(), title='Beginner python course breakdown')


class TestReadingACourseGuide:
    def test_each_top_heading_starts_a_lesson_with_a_calm_title(self, lessons):
        assert [lesson.title for lesson in lessons] == [
            '',
            'Course Overview',
            'Course Schedule',
            'Week 1 - Introduction to Programming',
            'Week 2 - Object-Oriented Programming',
        ]

    def test_the_cover_opens_the_first_lesson_without_its_title(self, lessons):
        assert lessons[0].body == (
            'Beginner Course Breakdown & Student Learning Guide\n\n'
            '- Course level: Absolute beginner\n'
            '- Estimated duration: 8 weeks\n\n'
            'A practical foundation for future Python, Django backend development, AI and '
            'machine learning.'
        )
        assert 'PYTHON PROGRAMMING' not in lessons[0].body

    def test_the_headings_under_a_week_are_its_sections(self, lessons):
        week = lessons[3].body

        assert week.startswith('## Lesson 1.1: The first idea\n\nPython is a general-purpose')
        assert '- Program: instructions a computer executes.\n- Bug: an error.' in week
        assert '## Lesson 1.2: Running code' in week
        assert '```bash\npython3 --version\n```' in week
        assert '```python\nif 5 > 2:\n    print("Five is greater than two")\n```' in week
        assert 'Page 3' not in week
        assert 'Beginner Student Guide' not in week

    def test_a_table_is_rebuilt_row_by_row(self, lessons):
        assert lessons[2].body == (
            '**Week · Main topic · Practical outcome**\n\n'
            '- **1** · Introduction and output · First Python programs\n'
            '- **2** · Variables and operators · Calculator'
        )


def _pdf_lesson(gql, manager, ids, title='What Python is') -> str:
    """A lesson as the console's "Upload PDFs" makes it: the stand-in note, then the file."""
    return gql(
        CREATE_LESSON,
        {'id': ids['module'], 'input': {'title': title, 'body': PDF_PLACEHOLDER_BODY}},
        manager,
    )['createLesson']['id']


@pytest.mark.django_db
class TestOnUpload:
    def test_a_pdf_writes_the_notes_of_a_lesson_that_has_none(self, client, gql, manager):
        ids = build_course(gql, manager)
        lesson_id = _pdf_lesson(gql, manager, ids)

        response = upload(client, lesson_id, manager, content=lesson_pdf())

        assert response.status_code == 201, response.content
        assert response.json()['notesWritten'] is True
        assert response.json()['lessonsWritten'] == 1
        lesson = gql(LEARNER_BLOCKS, {'id': lesson_id}, manager)['lesson']
        assert lesson['objectives'] == [
            'Describe what Python is',
            'Install Python and check the version',
        ]
        assert lesson['summary'].startswith('Python is a general-purpose')
        kinds = [block['kind'] for block in lesson['blocks']]
        assert kinds[:4] == ['heading', 'paragraph', 'list', 'code']
        assert lesson['blocks'][3]['language'] == 'python'
        # The file stays attached, to open or download.
        assert Lesson.objects.get(pk=lesson_id).materials.count() == 1

    def test_a_course_guide_becomes_lessons_right_after_the_one_uploaded_to(
        self, client, gql, manager
    ):
        ids = build_course(gql, manager)  # module: "Welcome"
        lesson_id = _pdf_lesson(gql, manager, ids, title='Beginner python course breakdown')
        later = gql(
            CREATE_LESSON,
            {'id': ids['module'], 'input': {'title': 'Wrap-up', 'body': 'The end.'}},
            manager,
        )['createLesson']['id']

        response = upload(client, lesson_id, manager, content=course_guide_pdf())

        assert response.json()['lessonsWritten'] == 5
        titles = list(
            Lesson.objects.filter(module_id=ids['module'])
            .order_by('position')
            .values_list('title', flat=True)
        )
        assert titles == [
            'Welcome',
            'Beginner python course breakdown',
            'Course Overview',
            'Course Schedule',
            'Week 1 - Introduction to Programming',
            'Week 2 - Object-Oriented Programming',
            'Wrap-up',
        ]
        assert Lesson.objects.get(pk=later).body == 'The end.'
        week = Lesson.objects.get(title='Week 1 - Introduction to Programming')
        assert [block.kind for block in week.blocks.order_by('position')][:2] == [
            'heading',
            'paragraph',
        ]
        assert week.summary.startswith('Python is a general-purpose')

    def test_notes_somebody_wrote_are_never_replaced(self, client, gql, manager):
        ids = build_course(gql, manager)  # its lesson has notes: "## Hello ..."

        response = upload(client, ids['lesson'], manager, content=course_guide_pdf())

        assert response.json()['notesWritten'] is False
        assert response.json()['lessonsWritten'] == 0
        assert Lesson.objects.get(pk=ids['lesson']).body == '## Hello\nThese are the notes.'
        assert Lesson.objects.filter(module_id=ids['module']).count() == 1

    def test_a_scanned_pdf_keeps_the_stand_in_and_the_file(self, client, gql, manager):
        ids = build_course(gql, manager)
        lesson_id = _pdf_lesson(gql, manager, ids)

        response = upload(client, lesson_id, manager, content=blank_pdf())

        assert response.status_code == 201
        assert response.json()['notesWritten'] is False
        assert Lesson.objects.get(pk=lesson_id).body == PDF_PLACEHOLDER_BODY


@pytest.mark.django_db
class TestForLessonsUploadedBefore:
    def test_the_command_fills_them_once_and_then_finds_nothing(self, client, gql, manager):
        ids = build_course(gql, manager)
        lesson_id = _pdf_lesson(gql, manager, ids)
        upload(client, lesson_id, manager, content=lesson_pdf())
        # As it was before uploads wrote notes: the stand-in only.
        lesson = Lesson.objects.get(pk=lesson_id)
        lesson.blocks.all().delete()
        Lesson.objects.filter(pk=lesson_id).update(body=PDF_PLACEHOLDER_BODY, objectives=[])

        first, again = io.StringIO(), io.StringIO()
        call_command('write_pdf_lesson_notes', stdout=first)
        call_command('write_pdf_lesson_notes', stdout=again)

        assert 'Wrote notes for "What Python is"' in first.getvalue()
        assert '1 written, 0 rebuilt, 0 skipped' in first.getvalue()
        assert '0 written, 0 rebuilt, 0 skipped' in again.getvalue()
        lesson.refresh_from_db()
        assert lesson.body.startswith('## Section 1')
        assert lesson.objectives == [
            'Describe what Python is',
            'Install Python and check the version',
        ]


@pytest.mark.django_db
class TestNotesTheFirstConverterWrote:
    """The first converter made a course guide one long lesson; those are rebuilt, nothing else."""

    def _first_converter_lesson(self, client, gql, manager, ids, *, edit: str = '') -> Lesson:
        from learning.pdf_import_v1 import lesson_from_pdf as first_converter

        title = 'Beginner python course breakdown'
        first = first_converter(course_guide_pdf(), title=title)
        lesson_id = gql(
            CREATE_LESSON,
            {
                'id': ids['module'],
                'input': {
                    'title': title,
                    'body': first.body + edit,
                    'summary': first.summary,
                    'objectives': first.objectives,
                    'estimatedMinutes': first.estimated_minutes,
                },
            },
            manager,
        )['createLesson']['id']
        # Attaching the file now writes nothing: the lesson has notes.
        assert (
            upload(client, lesson_id, manager, content=course_guide_pdf()).json()['lessonsWritten']
            == 0
        )
        return Lesson.objects.get(pk=lesson_id)

    def test_untouched_ones_become_the_guides_lessons(self, client, gql, manager):
        ids = build_course(gql, manager)
        lesson = self._first_converter_lesson(client, gql, manager, ids)
        # What the first converter made of it: the cover's lines as headings, one long page.
        assert lesson.body.startswith('## PYTHON PROGRAMMING\n\n## Beginner Course Breakdown')

        out, again = io.StringIO(), io.StringIO()
        call_command('write_pdf_lesson_notes', stdout=out)
        call_command('write_pdf_lesson_notes', stdout=again)

        assert 'Rebuilt "Beginner python course breakdown"' in out.getvalue()
        assert '0 written, 1 rebuilt, 0 skipped' in out.getvalue()
        assert '0 written, 0 rebuilt, 0 skipped' in again.getvalue()
        titles = list(
            Lesson.objects.filter(module_id=ids['module'])
            .order_by('position')
            .values_list('title', flat=True)
        )
        assert titles == [
            'Welcome',
            'Beginner python course breakdown',
            'Course Overview',
            'Course Schedule',
            'Week 1 - Introduction to Programming',
            'Week 2 - Object-Oriented Programming',
        ]
        lesson.refresh_from_db()
        assert lesson.body.startswith('Beginner Course Breakdown & Student Learning Guide')
        assert lesson.summary == 'Beginner Course Breakdown & Student Learning Guide'

    def test_ones_an_administrator_edited_are_left_alone(self, client, gql, manager):
        ids = build_course(gql, manager)
        lesson = self._first_converter_lesson(client, gql, manager, ids, edit='\n\nMy own note.')
        before = lesson.body

        out = io.StringIO()
        call_command('write_pdf_lesson_notes', stdout=out)

        assert '0 written, 0 rebuilt, 0 skipped' in out.getvalue()
        lesson.refresh_from_db()
        assert lesson.body == before
        assert Lesson.objects.filter(module_id=ids['module']).count() == 2
