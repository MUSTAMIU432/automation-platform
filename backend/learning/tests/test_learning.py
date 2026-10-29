"""
The Learning API end to end: who sees what, progress, grading, what never leaks,
rate limits, quizzes, the capstone and completion - and the sandbox client itself.
"""

import json
from unittest import mock

import pytest
import requests

from learning import execution, grading, services
from learning.models import (
    AssessmentAttempt,
    CodingExercise,
    Course,
    CourseCompletion,
    Enrollment,
    ExerciseSubmission,
    ExerciseTestCase,
    Lesson,
    LessonProgress,
    Question,
    Quiz,
)
from learning.tests.conftest import grant_course_management, make_user

COURSES = (
    'query($search: String!) { courses(search: $search) { slug title status enrolled '
    'moduleCount lessonCount } }'
)
COURSE = """
query($slug: String!) {
  course(slug: $slug) {
    summary { id slug status enrolled lessonCount }
    modules {
      title
      lessons { id title completed }
      exercises { id passed }
      quiz { id passed bestPercentage }
    }
    capstone { options { key } submission { option } }
    enrollment {
      progress {
        completedLessons totalLessons percent nextLessonId completionGaps completedAt
      }
    }
  }
}"""
LESSON = (
    'query($id: ID!) { lesson(id: $id) { title blocks { kind text } previousLessonId '
    'nextLessonId completed exercises { title } quizId } }'
)
EXERCISE = """
query($id: ID!) {
  exercise(id: $id) {
    title starterCode hiddenTestCount hints hintCount executionAvailable passed
    visibleTests { name call expectedOutput }
    submissions {
      status passedCount totalCount code
      results { name hidden passed expected actual call }
    }
  }
}"""
QUIZ = (
    'query($id: ID!) { quiz(id: $id) { title questions { id kind options { id text } } '
    'attempts { percentage passed } } }'
)
ENROLL = (
    'mutation($id: ID!) { enrollInCourse(courseId: $id) { success message course { summary { '
    'enrolled } } } }'
)
COMPLETE_LESSON = (
    'mutation($id: ID!) { completeLesson(lessonId: $id) { success message lesson { completed } } }'
)
RUN = (
    'mutation($id: ID!, $code: String!, $stdin: String!) { runExerciseCode(exerciseId: $id, '
    'code: $code, stdin: $stdin) { success message result { stdout stderr exitCode killed } }'
    ' }'
)
SUBMIT = (
    'mutation($id: ID!, $code: String!) { submitExercise(exerciseId: $id, code: $code) { '
    'success message submission { status passedCount totalCount results { name hidden passed '
    'stdin call expected actual error } } exercise { hints } } }'
)
SUBMIT_QUIZ = (
    'mutation($id: ID!, $answers: [QuizAnswerInput!]!) { submitQuiz(quizId: $id, answers: '
    '$answers) { success message field attempt { score maxScore percentage passed } results {'
    ' questionId correct explanation } } }'
)
CAPSTONE = (
    'mutation($input: CapstoneInput!) { submitCapstone(input: $input) { success message field } }'
)
COMPLETE_COURSE = (
    'mutation($id: ID!) { completeCourse(courseId: $id) { success message course { enrollment'
    ' { progress { completedAt certificateCode } } } } }'
)
MY_LEARNING = (
    '{ myLearning { courses { course { slug } enrollment { progress { percent } } } '
    'recentActivity { kind title detail } } }'
)

GOOD_CODE = 'def add(a, b):\n    return a + b\n'
CHEAT_CODE = 'def add(a, b):\n    return 5\n'


def enroll(gql, course, user):
    return gql(ENROLL, {'id': str(course.pk)}, user)['enrollInCourse']


def exercise_id(course):
    return str(CodingExercise.objects.get(module__course=course).pk)


def quiz_answers(*, right: bool):
    questions = Question.objects.order_by('position')
    answers = []
    for question in questions:
        options = list(question.options.order_by('position'))
        chosen = (
            [o for o in options if o.is_correct]
            if right
            else [o for o in options if not o.is_correct][:1]
        )
        answers.append({'questionId': str(question.pk), 'optionIds': [str(o.pk) for o in chosen]})
    return answers


# --- visibility -----------------------------------------------------------------------


@pytest.mark.django_db
class TestWhoSeesWhichCourse:
    def test_a_published_course_is_in_the_catalog(self, gql, course, learner):
        courses = gql(COURSES, {'search': ''}, learner)['courses']

        assert courses == [
            {
                'slug': 'mini',
                'title': 'Mini course',
                'status': 'published',
                'enrolled': False,
                'moduleCount': 1,
                'lessonCount': 2,
            }
        ]

    def test_search_filters_the_catalog(self, gql, course, learner):
        assert gql(COURSES, {'search': 'nothing like it'}, learner)['courses'] == []
        assert len(gql(COURSES, {'search': 'MINI'}, learner)['courses']) == 1

    def test_signed_out_callers_see_nothing(self, gql, course):
        assert gql(COURSES, {'search': ''})['courses'] == []
        assert gql(COURSE, {'slug': 'mini'})['course'] is None

    def test_a_draft_is_invisible_to_learners_and_visible_to_managers(self, gql, course, learner):
        Course.objects.filter(pk=course.pk).update(status=Course.Status.DRAFT)
        manager = make_user('manager@example.com')
        grant_course_management(manager)

        assert gql(COURSES, {'search': ''}, learner)['courses'] == []
        assert gql(COURSE, {'slug': 'mini'}, learner)['course'] is None
        assert gql(COURSE, {'slug': 'mini'}, manager)['course']['summary']['status'] == 'draft'
        assert enroll(gql, course, learner)['success'] is False

    def test_an_archived_course_stays_open_to_its_learners(
        self, gql, course, learner, other_learner
    ):
        enroll(gql, course, learner)
        Course.objects.filter(pk=course.pk).update(status=Course.Status.ARCHIVED)

        assert gql(COURSES, {'search': ''}, learner)['courses'] == []
        assert gql(COURSE, {'slug': 'mini'}, learner)['course'] is not None
        assert gql(COURSE, {'slug': 'mini'}, other_learner)['course'] is None
        assert enroll(gql, course, other_learner)['success'] is False

    def test_lessons_exercises_and_quizzes_need_an_enrollment(self, gql, course, learner):
        lesson = Lesson.objects.first()
        quiz = Quiz.objects.get()

        assert gql(LESSON, {'id': str(lesson.pk)}, learner)['lesson'] is None
        assert gql(EXERCISE, {'id': exercise_id(course)}, learner)['exercise'] is None
        assert gql(QUIZ, {'id': str(quiz.pk)}, learner)['quiz'] is None

        enroll(gql, course, learner)
        assert gql(LESSON, {'id': str(lesson.pk)}, learner)['lesson']['title'] == 'First lesson'


# --- enrollment and lessons -----------------------------------------------------------


@pytest.mark.django_db
class TestEnrollmentAndLessons:
    def test_enrolling_twice_is_one_enrollment(self, gql, course, learner):
        assert enroll(gql, course, learner)['success'] is True
        assert enroll(gql, course, learner)['course']['summary']['enrolled'] is True
        assert Enrollment.objects.filter(user=learner).count() == 1

    def test_signing_in_is_required(self, gql, course):
        result = enroll(gql, course, None)

        assert result['success'] is False
        assert not Enrollment.objects.exists()

    def test_a_lesson_reads_in_order_with_its_neighbours(self, gql, course, learner):
        enroll(gql, course, learner)
        first, second = Lesson.objects.order_by('position')

        lesson = gql(LESSON, {'id': str(first.pk)}, learner)['lesson']

        assert lesson['blocks'] == [
            {'kind': 'heading', 'text': 'Hello'},
            {'kind': 'paragraph', 'text': 'Read me.'},
        ]
        assert lesson['previousLessonId'] is None
        assert lesson['nextLessonId'] == str(second.pk)
        assert lesson['exercises'] == [{'title': 'Add two numbers'}]
        assert lesson['quizId'] == str(Quiz.objects.get().pk)

    def test_completing_a_lesson_moves_progress_on(self, gql, course, learner):
        enroll(gql, course, learner)
        first, second = Lesson.objects.order_by('position')

        result = gql(COMPLETE_LESSON, {'id': str(first.pk)}, learner)['completeLesson']
        gql(COMPLETE_LESSON, {'id': str(first.pk)}, learner)  # twice is harmless

        assert result['lesson']['completed'] is True
        progress = gql(COURSE, {'slug': 'mini'}, learner)['course']['enrollment']['progress']
        assert progress['completedLessons'] == 1
        assert progress['nextLessonId'] == str(second.pk)
        assert LessonProgress.objects.count() == 1

    def test_progress_is_per_learner(self, gql, course, learner, other_learner):
        enroll(gql, course, learner)
        enroll(gql, course, other_learner)
        gql(COMPLETE_LESSON, {'id': str(Lesson.objects.first().pk)}, learner)

        theirs = gql(COURSE, {'slug': 'mini'}, other_learner)['course']['enrollment']['progress']
        assert theirs['completedLessons'] == 0

    def test_a_lesson_cannot_be_completed_without_enrolling(self, gql, course, learner):
        result = gql(COMPLETE_LESSON, {'id': str(Lesson.objects.first().pk)}, learner)

        assert result['completeLesson']['success'] is False
        assert not LessonProgress.objects.exists()


# --- exercises ------------------------------------------------------------------------


@pytest.mark.django_db
class TestExercises:
    def test_the_exercise_never_reveals_hidden_tests_or_the_solution(self, gql, course, learner):
        enroll(gql, course, learner)

        exercise = gql(EXERCISE, {'id': exercise_id(course)}, learner)['exercise']

        assert exercise['visibleTests'] == [
            {'name': 'add(2, 3)', 'call': 'print(add(2, 3))', 'expectedOutput': '5'}
        ]
        assert exercise['hiddenTestCount'] == 1
        assert exercise['hints'] == ['Use +.']
        assert exercise['hintCount'] == 3

    def test_the_schema_has_no_field_for_secrets(self, gql):
        fields = {
            name: {
                f['name']
                for f in gql(f'{{ __type(name: "{name}") {{ fields {{ name }} }} }}')['__type'][
                    'fields'
                ]
            }
            for name in ('ExerciseType', 'QuizOptionType', 'VisibleTestType')
        }

        assert not {'solution', 'solutionCode'} & fields['ExerciseType']
        assert 'isCorrect' not in fields['QuizOptionType']
        assert 'isHidden' not in fields['VisibleTestType']

    def test_without_a_sandbox_nothing_runs_and_nothing_is_recorded(self, gql, course, learner):
        enroll(gql, course, learner)

        run = gql(RUN, {'id': exercise_id(course), 'code': GOOD_CODE, 'stdin': ''}, learner)
        submit = gql(SUBMIT, {'id': exercise_id(course), 'code': GOOD_CODE}, learner)

        assert run['runExerciseCode']['success'] is False
        assert 'not available' in run['runExerciseCode']['message']
        assert submit['submitExercise']['success'] is False
        assert not ExerciseSubmission.objects.exists()
        assert (
            gql(EXERCISE, {'id': exercise_id(course)}, learner)['exercise']['executionAvailable']
            is False
        )

    def test_running_code_returns_its_output(self, gql, course, learner, sandbox):
        enroll(gql, course, learner)
        code = 'name = input()\nprint(f"Hi {name}")\n1 / 0\n'

        result = gql(RUN, {'id': exercise_id(course), 'code': code, 'stdin': 'Amina\n'}, learner)

        output = result['runExerciseCode']['result']
        assert output['stdout'] == 'Hi Amina\n'
        assert 'ZeroDivisionError' in output['stderr']
        assert output['exitCode'] != 0
        assert sandbox.calls == [(code, 'Amina\n')]
        assert not ExerciseSubmission.objects.exists()

    def test_a_correct_submission_passes_every_test(self, gql, course, learner, sandbox):
        enroll(gql, course, learner)

        result = gql(SUBMIT, {'id': exercise_id(course), 'code': GOOD_CODE}, learner)[
            'submitExercise'
        ]

        assert result['submission']['status'] == 'passed'
        assert result['submission']['passedCount'] == 2
        progress = gql(COURSE, {'slug': 'mini'}, learner)['course']['modules'][0]['exercises']
        assert progress[0]['passed'] is True

    def test_matching_the_visible_output_is_not_enough(self, gql, course, learner, sandbox):
        enroll(gql, course, learner)

        result = gql(SUBMIT, {'id': exercise_id(course), 'code': CHEAT_CODE}, learner)[
            'submitExercise'
        ]

        assert result['submission']['status'] == 'failed'
        visible, hidden = result['submission']['results']
        assert visible['passed'] is True
        assert hidden == {
            'name': 'Secret case',
            'hidden': True,
            'passed': False,
            'stdin': '',
            'call': '',
            'expected': '',
            'actual': '',
            'error': '',
        }

    def test_printing_the_expected_output_early_does_not_pass(self, gql, course, learner, sandbox):
        enroll(gql, course, learner)
        code = 'print(5)\nprint(-38)\ndef add(a, b):\n    return None\n'

        result = gql(SUBMIT, {'id': exercise_id(course), 'code': code}, learner)['submitExercise']

        assert result['submission']['passedCount'] == 0

    def test_hidden_inputs_and_expected_outputs_never_reach_the_learner(
        self, client, gql, course, learner, sandbox
    ):
        enroll(gql, course, learner)
        gql(SUBMIT, {'id': exercise_id(course), 'code': CHEAT_CODE}, learner)

        exercise = gql(EXERCISE, {'id': exercise_id(course)}, learner)['exercise']
        rendered = json.dumps(exercise)
        assert 'add(-40, 2)' not in rendered
        assert '-38' not in rendered
        stored = ExerciseSubmission.objects.get().results
        assert 'add(-40, 2)' not in json.dumps(stored)

    def test_each_failure_unlocks_one_more_hint(self, gql, course, learner, sandbox):
        enroll(gql, course, learner)

        first = gql(SUBMIT, {'id': exercise_id(course), 'code': CHEAT_CODE}, learner)
        second = gql(SUBMIT, {'id': exercise_id(course), 'code': CHEAT_CODE}, learner)

        assert first['submitExercise']['exercise']['hints'] == ['Use +.', 'Return the result.']
        assert len(second['submitExercise']['exercise']['hints']) == 3

    def test_learners_see_only_their_own_submissions(
        self, gql, course, learner, other_learner, sandbox
    ):
        enroll(gql, course, learner)
        enroll(gql, course, other_learner)
        gql(SUBMIT, {'id': exercise_id(course), 'code': GOOD_CODE}, learner)

        theirs = gql(EXERCISE, {'id': exercise_id(course)}, other_learner)['exercise']
        assert theirs['submissions'] == []
        assert theirs['passed'] is False

    def test_code_size_is_limited(self, gql, course, learner, sandbox):
        enroll(gql, course, learner)

        result = gql(SUBMIT, {'id': exercise_id(course), 'code': 'x = 1\n' * 5000}, learner)

        assert result['submitExercise']['success'] is False
        assert sandbox.calls == []

    def test_submissions_are_rate_limited(self, gql, course, learner, sandbox, monkeypatch):
        monkeypatch.setattr(services, 'SUBMIT_PER_LEARNER', services.ThrottlePolicy('t', 2, 60))
        enroll(gql, course, learner)

        results = [
            gql(SUBMIT, {'id': exercise_id(course), 'code': GOOD_CODE}, learner)['submitExercise']
            for _ in range(3)
        ]

        assert [r['success'] for r in results] == [True, True, False]
        assert 'little fast' in results[2]['message']


# --- quizzes --------------------------------------------------------------------------


@pytest.mark.django_db
class TestQuizzes:
    def test_the_quiz_never_says_which_answer_is_right(self, gql, course, learner):
        enroll(gql, course, learner)

        quiz = gql(QUIZ, {'id': str(Quiz.objects.get().pk)}, learner)['quiz']

        assert [q['kind'] for q in quiz['questions']] == ['single', 'multiple']
        assert set(quiz['questions'][0]['options'][0]) == {'id', 'text'}

    def test_all_correct_passes(self, gql, course, learner):
        enroll(gql, course, learner)

        result = gql(
            SUBMIT_QUIZ,
            {'id': str(Quiz.objects.get().pk), 'answers': quiz_answers(right=True)},
            learner,
        )['submitQuiz']

        assert result['attempt'] == {'score': 2, 'maxScore': 2, 'percentage': 100, 'passed': True}
        assert [r['correct'] for r in result['results']] == [True, True]

    def test_a_multiple_answer_question_needs_exactly_the_right_set(self, gql, course, learner):
        enroll(gql, course, learner)
        single, multiple = Question.objects.order_by('position')
        a, _, _ = multiple.options.order_by('position')
        right = single.options.get(is_correct=True)

        result = gql(
            SUBMIT_QUIZ,
            {
                'id': str(Quiz.objects.get().pk),
                'answers': [
                    {'questionId': str(single.pk), 'optionIds': [str(right.pk)]},
                    {'questionId': str(multiple.pk), 'optionIds': [str(a.pk)]},
                ],
            },
            learner,
        )['submitQuiz']

        assert result['attempt']['score'] == 1
        assert result['attempt']['passed'] is True  # 50% meets this quiz's pass mark
        assert result['results'][1]['explanation'] == 'Both a and c.'

    def test_unanswered_questions_are_wrong(self, gql, course, learner):
        enroll(gql, course, learner)

        result = gql(SUBMIT_QUIZ, {'id': str(Quiz.objects.get().pk), 'answers': []}, learner)

        assert result['submitQuiz']['attempt']['percentage'] == 0

    def test_answers_must_belong_to_the_quiz(self, gql, course, learner):
        enroll(gql, course, learner)
        single, multiple = Question.objects.order_by('position')
        foreign_option = multiple.options.first()

        result = gql(
            SUBMIT_QUIZ,
            {
                'id': str(Quiz.objects.get().pk),
                'answers': [{'questionId': str(single.pk), 'optionIds': [str(foreign_option.pk)]}],
            },
            learner,
        )['submitQuiz']

        assert result['success'] is False
        assert not AssessmentAttempt.objects.exists()

    def test_a_single_answer_question_takes_one_answer(self, gql, course, learner):
        enroll(gql, course, learner)
        single = Question.objects.get(kind='single')

        result = gql(
            SUBMIT_QUIZ,
            {
                'id': str(Quiz.objects.get().pk),
                'answers': [
                    {
                        'questionId': str(single.pk),
                        'optionIds': [str(o.pk) for o in single.options.all()],
                    }
                ],
            },
            learner,
        )['submitQuiz']

        assert result['success'] is False


# --- capstone and completion ----------------------------------------------------------

LONG = 'A careful, complete explanation that is comfortably longer than the minimum length.'


def capstone_input(course, **overrides):
    data = {
        'courseId': str(course.pk),
        'option': 'api',
        'repositoryUrl': 'https://github.com/learner/api',
        'howToRun': LONG,
        'designDecisions': LONG,
    }
    data.update(overrides)
    return {'input': data}


@pytest.mark.django_db
class TestCapstoneAndCompletion:
    @pytest.mark.parametrize(
        ('override', 'field'),
        [
            ({'option': 'nope'}, 'option'),
            ({'repositoryUrl': 'http://insecure.example.com/x'}, 'repositoryUrl'),
            ({'repositoryUrl': 'javascript:alert(1)'}, 'repositoryUrl'),
            ({'designDecisions': 'Too short.'}, 'designDecisions'),
        ],
    )
    def test_a_capstone_is_validated(self, gql, course, learner, override, field):
        enroll(gql, course, learner)

        result = gql(CAPSTONE, capstone_input(course, **override), learner)['submitCapstone']

        assert result['success'] is False
        assert result['field'] == field

    def test_completion_lists_what_is_missing(self, gql, course, learner):
        enroll(gql, course, learner)

        result = gql(COMPLETE_COURSE, {'id': str(course.pk)}, learner)['completeCourse']

        assert result['success'] is False
        assert '2 lessons to complete' in result['message']
        assert '1 quiz to pass' in result['message']
        assert 'the final project to submit' in result['message']
        assert not CourseCompletion.objects.exists()

    def test_a_finished_course_can_be_completed(self, gql, course, learner):
        enroll(gql, course, learner)
        for lesson in Lesson.objects.all():
            gql(COMPLETE_LESSON, {'id': str(lesson.pk)}, learner)
        gql(
            SUBMIT_QUIZ,
            {'id': str(Quiz.objects.get().pk), 'answers': quiz_answers(right=True)},
            learner,
        )
        assert gql(CAPSTONE, capstone_input(course), learner)['submitCapstone']['success'] is True

        result = gql(COMPLETE_COURSE, {'id': str(course.pk)}, learner)['completeCourse']

        assert result['success'] is True
        progress = result['course']['enrollment']['progress']
        assert progress['completedAt'] is not None
        assert progress['certificateCode']
        overview = gql(COURSE, {'slug': 'mini'}, learner)['course']
        assert overview['enrollment']['progress']['percent'] == 100
        assert overview['capstone']['submission'] == {'option': 'api'}

    def test_my_learning_shows_courses_and_recent_activity(self, gql, course, learner):
        enroll(gql, course, learner)
        gql(COMPLETE_LESSON, {'id': str(Lesson.objects.first().pk)}, learner)
        gql(
            SUBMIT_QUIZ,
            {'id': str(Quiz.objects.get().pk), 'answers': quiz_answers(right=False)},
            learner,
        )

        mine = gql(MY_LEARNING, {}, learner)['myLearning']

        assert mine['courses'][0]['course']['slug'] == 'mini'
        assert [item['kind'] for item in mine['recentActivity']] == ['quiz', 'lesson']
        assert 'not passed' in mine['recentActivity'][0]['detail']


# --- grading and the sandbox client ---------------------------------------------------


def _test(**fields):
    defaults = {'name': 't', 'stdin': '', 'call': '', 'expected_output': '', 'is_hidden': False}
    return ExerciseTestCase(**{**defaults, **fields})


class TestGrading:
    def test_trailing_whitespace_never_decides_a_test(self):
        assert grading.normalize('a  \nb\n\n') == grading.normalize('a\nb')

    def test_only_output_after_the_marker_counts(self):
        def run(source, stdin):
            marker = source.split('print(', 2)[1].split(')')[0].strip("'")
            return execution.ExecutionResult(f'5\n{marker}\n6\n', '', 0, False)

        result = grading.grade('code', [_test(call='print(f())', expected_output='5')], run)

        assert result.results[0].passed is False
        assert result.results[0].actual == '6'

    def test_a_killed_run_fails_with_a_clear_error(self):
        def run(source, stdin):
            return execution.ExecutionResult('', '', None, True)

        (result,) = grading.grade(
            'while True: pass', [_test(expected_output='')], lambda *a: run(*a)
        ).results

        assert result.passed is False
        assert 'too long' in result.error


class TestPistonExecutor:
    def _response(self, payload, status=200):
        response = mock.Mock()
        response.status_code = status
        response.json.return_value = payload
        response.raise_for_status.side_effect = (
            None if status < 400 else requests.HTTPError(f'{status}')
        )
        return response

    def test_it_sends_the_code_with_limits_and_reads_the_result(self, settings):
        settings.CODE_EXECUTION_TIMEOUT_MS = 2500
        settings.CODE_EXECUTION_MEMORY_LIMIT_BYTES = 64_000_000
        executor = execution.PistonExecutor('https://sandbox.internal/', token='t0ken')
        reply = {'run': {'stdout': 'hi\n', 'stderr': '', 'code': 0, 'signal': None}}

        with mock.patch.object(
            execution.requests, 'post', return_value=self._response(reply)
        ) as post:
            result = executor.run('print("hi")', 'in')

        assert result == execution.ExecutionResult('hi\n', '', 0, False)
        (url,), kwargs = post.call_args
        assert url == 'https://sandbox.internal/api/v2/execute'
        assert kwargs['json']['files'] == [{'name': 'main.py', 'content': 'print("hi")'}]
        assert kwargs['json']['stdin'] == 'in'
        assert kwargs['json']['run_timeout'] == 2500
        assert kwargs['json']['run_memory_limit'] == 64_000_000
        assert kwargs['headers'] == {'Authorization': 'Bearer t0ken'}
        assert kwargs['timeout'] > 2.5

    def test_a_killed_run_is_reported(self):
        reply = {'run': {'stdout': '', 'stderr': '', 'code': None, 'signal': 'SIGKILL'}}
        with mock.patch.object(execution.requests, 'post', return_value=self._response(reply)):
            result = execution.PistonExecutor('https://s').run('x', '')

        assert result.killed is True
        assert result.succeeded is False

    @pytest.mark.parametrize(
        'failure',
        [requests.ConnectionError('down'), requests.Timeout('slow')],
    )
    def test_an_unreachable_sandbox_is_unavailable_not_a_crash(self, failure):
        with (
            mock.patch.object(execution.requests, 'post', side_effect=failure),
            pytest.raises(execution.ExecutionUnavailable),
        ):
            execution.PistonExecutor('https://s').run('x', '')

    def test_a_malformed_reply_is_unavailable(self):
        reply = self._response({'nope': 1})
        with (
            mock.patch.object(execution.requests, 'post', return_value=reply),
            pytest.raises(execution.ExecutionUnavailable),
        ):
            execution.PistonExecutor('https://s').run('x', '')

    def test_huge_output_is_clipped(self):
        reply = {'run': {'stdout': 'x' * 100_000, 'stderr': '', 'code': 0, 'signal': None}}
        with mock.patch.object(execution.requests, 'post', return_value=self._response(reply)):
            result = execution.PistonExecutor('https://s').run('x', '')

        assert len(result.stdout) < 20_000

    def test_with_no_url_there_is_no_executor(self, settings):
        settings.CODE_EXECUTION_URL = ''

        with pytest.raises(execution.ExecutionUnavailable):
            execution.executor()


@pytest.mark.django_db
class TestConstraints:
    def test_one_enrollment_per_learner_and_course(self, course, learner):
        from django.db import IntegrityError, transaction

        Enrollment.objects.create(user=learner, course=course)
        with pytest.raises(IntegrityError), transaction.atomic():
            Enrollment.objects.create(user=learner, course=course)

    def test_a_score_cannot_exceed_its_maximum(self, course, learner):
        from django.db import IntegrityError, transaction

        enrollment = Enrollment.objects.create(user=learner, course=course)
        with pytest.raises(IntegrityError), transaction.atomic():
            AssessmentAttempt.objects.create(
                enrollment=enrollment,
                quiz=Quiz.objects.get(),
                score=3,
                max_score=2,
                percentage=100,
                passed=True,
            )
