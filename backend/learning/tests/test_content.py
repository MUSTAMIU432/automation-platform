"""
The Python course's own content, checked like code.

Every module file must load; every Python example, starter and solution must
compile; and every exercise's reference solution must pass every one of its own
tests while its starter fails at least one - so a typo in an expected output, or a
test that passes for anything, fails here instead of in front of a learner.

The solutions are the course's own trusted code, so they run locally in a
subprocess (`run_trusted`). Learner code is never run this way: it only ever
goes to the sandbox (`learning/execution.py`).
"""

import pytest

from learning import grading
from learning.content import CONTENT_ROOT, ContentError, parse_blocks, read_course, sync_course
from learning.models import CodingExercise, ExerciseTestCase, Lesson, LessonProgress, Question
from learning.tests.trusted import run_trusted

PYTHON_COURSE = CONTENT_ROOT / 'python'
FILES = read_course(PYTHON_COURSE)


def _tests_for(data: dict) -> list[ExerciseTestCase]:
    return [
        ExerciseTestCase(
            name=test['name'],
            stdin=test.get('stdin', ''),
            call=test.get('call', '').strip(),
            expected_output=test['expected'],
            is_hidden=test.get('hidden', False),
        )
        for test in data['tests']
    ]


EXERCISES = [
    pytest.param(exercise, id=f'{module["slug"]}/{exercise["slug"]}')
    for _, module in FILES.modules
    for exercise in module.get('exercises', [])
]
LESSONS = [
    pytest.param(lesson, id=f'{module["slug"]}/{lesson["slug"]}')
    for _, module in FILES.modules
    for lesson in module['lessons']
]


class TestTheCurriculum:
    def test_all_twelve_modules_in_order(self):
        assert [module['position'] for _, module in FILES.modules] == list(range(1, 13))

    @pytest.mark.parametrize('module', [m for _, m in FILES.modules], ids=lambda m: m['slug'])
    def test_every_module_is_complete(self, module):
        assert len(module['lessons']) >= 2
        assert len(module.get('exercises', [])) >= 1
        assert len(module['quiz']['questions']) >= 4
        assert module['objectives']
        assert module['project']
        for lesson in module['lessons']:
            assert lesson['objectives'], lesson['slug']

    def test_the_capstone_offers_the_five_projects(self):
        assert len(FILES.course['capstone']['options']) == 5


class TestTheCodeIsValid:
    @pytest.mark.parametrize('lesson', LESSONS)
    def test_every_python_example_compiles(self, lesson):
        for block in parse_blocks(lesson['body']):
            if block.kind == 'code' and block.language == 'python':
                compile(block.text, f'<{lesson["slug"]}>', 'exec')

    @pytest.mark.parametrize('exercise', EXERCISES)
    def test_starter_solution_and_tests_compile(self, exercise):
        compile(exercise.get('starter', ''), 'starter', 'exec')
        compile(exercise['solution'], 'solution', 'exec')
        for test in exercise['tests']:
            compile(test.get('call', ''), test['name'], 'exec')


class TestEveryExerciseIsGradedCorrectly:
    @pytest.mark.parametrize('exercise', EXERCISES)
    def test_the_reference_solution_passes_every_test(self, exercise):
        result = grading.grade(exercise['solution'], _tests_for(exercise), run_trusted)

        failures = [r for r in result.results if not r.passed]
        assert not failures, [(f.name, f.actual, f.error) for f in failures]

    @pytest.mark.parametrize('exercise', EXERCISES)
    def test_the_starter_does_not(self, exercise):
        result = grading.grade(exercise.get('starter', ''), _tests_for(exercise), run_trusted)

        assert not result.passed

    @pytest.mark.parametrize('exercise', EXERCISES)
    def test_some_tests_are_hidden_and_some_visible(self, exercise):
        hidden = [test.get('hidden', False) for test in exercise['tests']]
        assert any(hidden)
        assert not all(hidden)


class TestParsingBlocks:
    def test_every_block_kind(self):
        blocks = parse_blocks(
            '## Title\nOne\nparagraph.\n\n- a\n- b\n> A note\n```sql\nSELECT 1;\n```\nEnd.'
        )

        assert [(b.kind, b.text, b.language) for b in blocks] == [
            ('heading', 'Title', ''),
            ('paragraph', 'One paragraph.', ''),
            ('list', 'a\nb', ''),
            ('note', 'A note', ''),
            ('code', 'SELECT 1;', 'sql'),
            ('paragraph', 'End.', ''),
        ]

    def test_code_keeps_its_indentation_and_blank_lines(self):
        (block,) = parse_blocks('```\ndef f():\n\n    return 1\n```')

        assert block.text == 'def f():\n\n    return 1'
        assert block.language == 'python'

    def test_an_unclosed_code_block_is_refused(self):
        with pytest.raises(ContentError, match='never closed'):
            parse_blocks('```python\nprint(1)')


def _write_course(directory, module_toml: str):
    (directory / 'modules').mkdir(parents=True)
    (directory / 'course.toml').write_text(
        'slug = "mini"\ntitle = "Mini"\n[capstone]\nbrief = "b"\n'
        '[[capstone.options]]\nkey = "k"\ntitle = "t"\nsummary = "s"\n',
        encoding='utf-8',
    )
    (directory / 'modules' / '01.toml').write_text(module_toml, encoding='utf-8')


MINI_MODULE = """
position = 1
slug = "basics"
title = "Basics"
summary = "s"

[[lessons]]
slug = "one"
title = "One"
body = "Hello."

[[exercises]]
slug = "ex"
title = "Ex"
lesson = "one"
instructions = "Do it."
solution = "print(1)"
[[exercises.tests]]
name = "t"
expected = "1"

[quiz]
title = "Q"
[[quiz.questions]]
prompt = "p"
options = ["a", "b"]
correct = [0]
"""


@pytest.mark.django_db
class TestSyncing:
    def test_the_real_course_loads(self):
        report = sync_course(PYTHON_COURSE, publish=True)

        assert report.modules == 12
        assert report.lessons >= 24
        assert report.exercises >= 12
        assert report.course.status == 'published'
        assert CodingExercise.objects.filter(test_cases__is_hidden=True).distinct().count() >= 12

    def test_syncing_again_keeps_ids_and_learner_progress(self, tmp_path):
        from identity.models import User
        from learning.models import Enrollment

        _write_course(tmp_path, MINI_MODULE)
        report = sync_course(tmp_path, publish=True)
        lesson = Lesson.objects.get(slug='one')
        user = User.objects.create_user(
            email='l@example.com', password='a-strong-unique-pass-1', first_name='L', last_name='L'
        )
        enrollment = Enrollment.objects.create(user=user, course=report.course)
        LessonProgress.objects.create(enrollment=enrollment, lesson=lesson)

        (tmp_path / 'modules' / '01.toml').write_text(
            MINI_MODULE.replace('body = "Hello."', 'body = "Hello again."'), encoding='utf-8'
        )
        sync_course(tmp_path)

        assert Lesson.objects.get(slug='one').pk == lesson.pk
        assert LessonProgress.objects.filter(lesson=lesson).exists()
        assert lesson.blocks.get().text == 'Hello again.'

    def test_a_bad_file_changes_nothing(self, tmp_path):
        _write_course(tmp_path, MINI_MODULE.replace('correct = [0]', 'correct = [5]'))

        with pytest.raises(ContentError, match='correct'):
            sync_course(tmp_path)
        assert not Question.objects.exists()

    def test_content_no_longer_in_the_files_is_kept_unless_pruned(self, tmp_path):
        _write_course(tmp_path, MINI_MODULE)
        sync_course(tmp_path)
        two_lessons = MINI_MODULE.replace(
            '[[exercises]]', '[[lessons]]\nslug = "two"\ntitle = "Two"\nbody = "x"\n\n[[exercises]]'
        )
        (tmp_path / 'modules' / '01.toml').write_text(two_lessons, encoding='utf-8')
        sync_course(tmp_path)
        (tmp_path / 'modules' / '01.toml').write_text(MINI_MODULE, encoding='utf-8')

        kept = sync_course(tmp_path)
        assert kept.kept == ['lesson basics/two']
        pruned = sync_course(tmp_path, prune=True)
        assert pruned.pruned == ['lesson basics/two']
        assert not Lesson.objects.filter(slug='two').exists()
