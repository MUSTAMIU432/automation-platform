"""
Lesson notes made from an uploaded PDF (learning/pdf_import.py), on upload and for
lessons uploaded before - never over notes somebody wrote.
"""

import io

import pytest
from django.core.management import call_command

from learning.authoring import PDF_PLACEHOLDER_BODY
from learning.models import Lesson
from learning.pdf_import import lesson_from_pdf
from learning.tests.pdf_samples import blank_pdf, lesson_pdf
from learning.tests.test_authoring import CREATE_LESSON, build_course, upload

LEARNER_BLOCKS = """query($id: ID!) { lesson(id: $id) {
  summary objectives estimatedMinutes blocks { kind text language }
} }"""


class TestReadingAPdf:
    def test_a_lesson_pdf_becomes_sections_lists_code_and_objectives(self):
        lesson = lesson_from_pdf(lesson_pdf(pages=3), title='What Python is')

        assert lesson is not None
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
        lesson = lesson_from_pdf(lesson_pdf(pages=1), title='What Python is')

        assert lesson is not None
        assert lesson.body.startswith('## Section 1')

    @pytest.mark.parametrize('data', [blank_pdf(), b'not a pdf at all', b''])
    def test_a_scan_or_a_broken_file_gives_nothing(self, data):
        assert lesson_from_pdf(data, title='Anything') is None


def _pdf_lesson(gql, manager, ids) -> str:
    """A lesson as the console's "Upload PDFs" makes it: the stand-in note, then the file."""
    return gql(
        CREATE_LESSON,
        {'id': ids['module'], 'input': {'title': 'What Python is', 'body': PDF_PLACEHOLDER_BODY}},
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

    def test_notes_somebody_wrote_are_never_replaced(self, client, gql, manager):
        ids = build_course(gql, manager)  # its lesson has notes: "## Hello ..."

        response = upload(client, ids['lesson'], manager, content=lesson_pdf())

        assert response.json()['notesWritten'] is False
        assert Lesson.objects.get(pk=ids['lesson']).body == '## Hello\nThese are the notes.'

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
        assert '1 written, 0 skipped' in first.getvalue()
        assert '0 written, 0 skipped' in again.getvalue()
        lesson.refresh_from_db()
        assert lesson.body.startswith('## Section 1')
        assert lesson.objectives == [
            'Describe what Python is',
            'Install Python and check the version',
        ]
