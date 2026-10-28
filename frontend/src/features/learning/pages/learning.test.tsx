import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Course, Exercise, Lesson, Quiz } from '../api/learningApi'
import { CourseCatalogPage } from './CourseCatalogPage'
import { CourseOverviewPage } from './CourseOverviewPage'
import { ExercisePage } from './ExercisePage'
import { LearnHomePage } from './LearnHomePage'
import { LearningLayout } from './LearningLayout'
import { LessonPage } from './LessonPage'
import { QuizPage } from './QuizPage'

vi.mock('../api/learningApi', async (importOriginal) => ({
  ...(await importOriginal()),
  coursesRequest: vi.fn(),
  courseRequest: vi.fn(),
  lessonRequest: vi.fn(),
  exerciseRequest: vi.fn(),
  quizRequest: vi.fn(),
  myLearningRequest: vi.fn(),
  enrollRequest: vi.fn(),
  completeLessonRequest: vi.fn(),
  runCodeRequest: vi.fn(),
  submitExerciseRequest: vi.fn(),
  submitQuizRequest: vi.fn(),
  downloadLessonFile: vi.fn(),
}))

// CodeMirror measures layout jsdom does not have; a textarea stands in for it here.
vi.mock('../components/CodeEditor', () => ({
  CodeEditor: ({
    value,
    onChange,
    label,
  }: {
    value: string
    onChange?: (v: string) => void
    label: string
  }) => (
    <textarea
      aria-label={label}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}))

const api = vi.mocked(await import('../api/learningApi'))

function renderAt(path: string, pattern: string, page: ReactElement) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={pattern} element={page} />
      </Routes>
    </MemoryRouter>,
  )
}

const SUMMARY = {
  id: '1',
  slug: 'python',
  title: 'Python Programming',
  subtitle: 'From zero to APIs',
  description: 'A long description.',
  level: 'all_levels',
  levelLabel: 'Beginner to advanced',
  estimatedHours: 60,
  moduleCount: 1,
  lessonCount: 2,
  status: 'published' as const,
  enrolled: false,
}

const PROGRESS = {
  completedLessons: 1,
  totalLessons: 2,
  passedExercises: 0,
  totalExercises: 1,
  passedQuizzes: 0,
  totalQuizzes: 1,
  capstoneSubmitted: false,
  percent: 25,
  nextLessonId: '12',
  completionGaps: ['1 lesson to complete', '1 quiz to pass', 'the capstone project to submit'],
  completedAt: null,
  certificateCode: null,
}

function course(enrolled: boolean): Course {
  return {
    summary: { ...SUMMARY, enrolled },
    audience: ['Beginners'],
    outcomes: ['Write Python'],
    canManage: false,
    modules: [
      {
        id: '5',
        slug: 'intro',
        position: 1,
        title: 'Introduction',
        summary: 'Start here.',
        objectives: ['Run a script'],
        project: 'A calculator.',
        lessons: [
          {
            id: '11',
            slug: 'a',
            title: 'What is Python',
            summary: '',
            estimatedMinutes: 20,
            completed: true,
          },
          {
            id: '12',
            slug: 'b',
            title: 'Variables',
            summary: '',
            estimatedMinutes: 25,
            completed: false,
          },
        ],
        exercises: [
          {
            id: '21',
            slug: 'calc',
            title: 'Calculator',
            difficulty: 'easy',
            lessonId: '12',
            attempted: false,
            passed: false,
          },
        ],
        quiz: {
          id: '31',
          title: 'Intro quiz',
          questionCount: 2,
          passPercentage: 70,
          bestPercentage: null,
          passed: false,
        },
      },
    ],
    capstone: {
      brief: 'Build something real.',
      requirements: ['Tests'],
      options: [{ key: 'api', title: 'An API', summary: 'Build an API.' }],
      submission: null,
    },
    enrollment: enrolled
      ? {
          id: '9',
          enrolledAt: '2026-10-01T00:00:00Z',
          lastActivityAt: '2026-10-02T00:00:00Z',
          progress: PROGRESS,
        }
      : null,
  }
}

const OK = { success: true, message: 'Done.', field: null }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('the catalog', () => {
  it('lists published courses and searches them', async () => {
    api.coursesRequest.mockResolvedValue([SUMMARY])
    renderAt('/c', '/c', <CourseCatalogPage />)

    expect(await screen.findByRole('heading', { name: 'Python Programming' })).toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'apis' } })

    await waitFor(() => expect(api.coursesRequest).toHaveBeenLastCalledWith('apis', ''))
  })

  it('says when nothing matches', async () => {
    api.coursesRequest.mockResolvedValue([])
    renderAt('/c', '/c', <CourseCatalogPage />)

    expect(await screen.findByText('No courses are published yet.')).toBeInTheDocument()
  })
})

describe('the course overview', () => {
  it('lets a visitor enroll', async () => {
    api.courseRequest.mockResolvedValueOnce(course(false)).mockResolvedValue(course(true))
    api.enrollRequest.mockResolvedValue({ ...OK, message: 'You are enrolled.' })
    renderAt('/learn/courses/python', '/learn/courses/:courseSlug', <CourseOverviewPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Enroll for free' }))

    await waitFor(() => expect(api.enrollRequest).toHaveBeenCalledWith('1'))
    expect(await screen.findByRole('link', { name: /Continue learning/ })).toHaveAttribute(
      'href',
      '/app/learn/courses/python/lessons/12',
    )
  })

  it('shows progress and what completion still needs', async () => {
    api.courseRequest.mockResolvedValue(course(true))
    renderAt('/learn/courses/python', '/learn/courses/:courseSlug', <CourseOverviewPage />)

    expect(await screen.findByText('1 quiz to pass')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Complete the course' })).toBeDisabled()
    expect(screen.getAllByRole('progressbar')[0]).toHaveAttribute('value', '25')
  })

  it('says when the course is not available', async () => {
    api.courseRequest.mockResolvedValue(null)
    renderAt('/learn/courses/x', '/learn/courses/:courseSlug', <CourseOverviewPage />)

    expect(await screen.findByText('This course is not available.')).toBeInTheDocument()
  })
})

const LESSON: Lesson = {
  id: '12',
  slug: 'b',
  title: 'Variables',
  summary: 'Naming values.',
  objectives: ['Create variables'],
  estimatedMinutes: 25,
  blocks: [
    { kind: 'heading', text: 'Variables', language: '' },
    { kind: 'paragraph', text: 'Use `name = value`.', language: '' },
    { kind: 'code', text: 'age = 21\nprint(age)', language: 'python' },
  ],
  courseSlug: 'python',
  courseTitle: 'Python Programming',
  moduleId: '5',
  modulePosition: 1,
  moduleTitle: 'Introduction',
  previousLessonId: '11',
  nextLessonId: null,
  completed: false,
  exercises: [
    {
      id: '21',
      slug: 'calc',
      title: 'Calculator',
      difficulty: 'easy',
      lessonId: '12',
      attempted: false,
      passed: false,
    },
  ],
  quizId: '31',
  materials: [
    {
      id: '41',
      title: 'Week 1 slides',
      filename: 'slides.pptx',
      contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      size: 2048,
      downloadUrl: '/learning/materials/41/download/',
    },
  ],
}

describe('a lesson', () => {
  it('renders its notes, code and files, and can be completed', async () => {
    api.lessonRequest
      .mockResolvedValueOnce(LESSON)
      .mockResolvedValue({ ...LESSON, completed: true })
    api.completeLessonRequest.mockResolvedValue(OK)
    renderAt('/l/12', '/l/:lessonId', <LessonPage />)

    expect(await screen.findByText('name = value')).toHaveProperty('tagName', 'CODE')
    expect(screen.getByText('print')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Previous/ })).toHaveAttribute(
      'href',
      '/app/learn/courses/python/lessons/11',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Download' }))
    expect(api.downloadLessonFile).toHaveBeenCalledWith(LESSON.materials[0])

    fireEvent.click(screen.getByRole('button', { name: /Mark as completed/ }))
    await waitFor(() => expect(api.completeLessonRequest).toHaveBeenCalledWith('12'))
    expect(await screen.findByText('Completed')).toBeInTheDocument()
  })

  it('copies a code example', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    api.lessonRequest.mockResolvedValue(LESSON)
    renderAt('/l/12', '/l/:lessonId', <LessonPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Copy' }))

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('age = 21\nprint(age)'))
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument()
  })
})

const EXERCISE: Exercise = {
  id: '21',
  slug: 'calc',
  title: 'Calculator',
  difficulty: 'easy',
  instructions: [{ kind: 'paragraph', text: 'Add two numbers.', language: '' }],
  starterCode: 'def add(a, b):\n    pass\n',
  visibleTests: [
    { id: '1', name: 'add(2, 3)', stdin: '', call: 'print(add(2, 3))', expectedOutput: '5' },
  ],
  hiddenTestCount: 2,
  hints: ['Use +.'],
  hintCount: 2,
  courseSlug: 'python',
  courseTitle: 'Python Programming',
  moduleTitle: 'Introduction',
  lessonId: '12',
  lessonTitle: 'Variables',
  passed: false,
  submissions: [],
  executionAvailable: true,
}

describe('the coding workspace', () => {
  it('runs code and shows its output', async () => {
    api.exerciseRequest.mockResolvedValue(EXERCISE)
    api.runCodeRequest.mockResolvedValue({
      ...OK,
      result: { stdout: 'hello\n', stderr: '', exitCode: 0, killed: false },
    })
    renderAt('/e/21', '/e/:exerciseId', <ExercisePage />)

    const editor = await screen.findByLabelText('Code for Calculator')
    fireEvent.change(editor, { target: { value: 'print("hello")' } })
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))

    await waitFor(() => expect(api.runCodeRequest).toHaveBeenCalledWith('21', 'print("hello")', ''))
    expect(await screen.findByText('hello')).toBeInTheDocument()
    expect(screen.getByText(/Plus 2 hidden tests/)).toBeInTheDocument()
  })

  it('shows graded results, hiding a hidden test’s details', async () => {
    api.exerciseRequest.mockResolvedValue(EXERCISE)
    api.submitExerciseRequest.mockResolvedValue({
      ...OK,
      exercise: EXERCISE,
      submission: {
        id: '7',
        code: 'x',
        status: 'failed',
        passedCount: 1,
        totalCount: 2,
        createdAt: '2026-10-02T00:00:00Z',
        results: [
          {
            name: 'add(2, 3)',
            hidden: false,
            passed: true,
            stdin: '',
            call: '',
            expected: '5',
            actual: '5',
            error: '',
          },
          {
            name: 'Secret',
            hidden: true,
            passed: false,
            stdin: '',
            call: '',
            expected: '',
            actual: '',
            error: '',
          },
        ],
      },
    })
    renderAt('/e/21', '/e/:exerciseId', <ExercisePage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Submit for grading' }))

    const results = await screen.findByRole('region', { name: 'Test results' })
    expect(within(results).getByText('1 of 2 tests passed.')).toBeInTheDocument()
    expect(within(results).getByText('Secret')).toBeInTheDocument()
    expect(within(results).queryByText('Your output')).not.toBeInTheDocument()
  })

  it('says plainly when code cannot run yet', async () => {
    api.exerciseRequest.mockResolvedValue({ ...EXERCISE, executionAvailable: false })
    renderAt('/e/21', '/e/:exerciseId', <ExercisePage />)

    expect(await screen.findByText(/not switched on for this platform yet/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Submit for grading' })).toBeDisabled()
  })
})

const QUIZ: Quiz = {
  id: '31',
  title: 'Intro quiz',
  passPercentage: 70,
  courseSlug: 'python',
  courseTitle: 'Python Programming',
  modulePosition: 1,
  moduleTitle: 'Introduction',
  questions: [
    {
      id: '1',
      prompt: 'Pick `a`.',
      code: '',
      kind: 'single',
      options: [
        { id: '10', text: 'a' },
        { id: '11', text: 'b' },
      ],
    },
    {
      id: '2',
      prompt: 'Pick both.',
      code: '',
      kind: 'multiple',
      options: [
        { id: '20', text: 'x' },
        { id: '21', text: 'y' },
      ],
    },
  ],
  attempts: [],
}

describe('a quiz', () => {
  it('submits the chosen answers and explains the result', async () => {
    api.quizRequest.mockResolvedValue(QUIZ)
    api.submitQuizRequest.mockResolvedValue({
      ...OK,
      attempt: {
        id: '1',
        score: 1,
        maxScore: 2,
        percentage: 50,
        passed: false,
        createdAt: '2026-10-02T00:00:00Z',
      },
      results: [
        { questionId: '1', correct: true, explanation: 'It was a.' },
        { questionId: '2', correct: false, explanation: 'Both x and y.' },
      ],
    })
    window.scrollTo = vi.fn()
    renderAt('/q/31', '/q/:quizId', <QuizPage />)

    fireEvent.click(await screen.findByRole('radio', { name: 'a' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'x' }))
    fireEvent.click(screen.getByRole('button', { name: 'Submit answers' }))

    await waitFor(() =>
      expect(api.submitQuizRequest).toHaveBeenCalledWith('31', [
        { questionId: '1', optionIds: ['10'] },
        { questionId: '2', optionIds: ['20'] },
      ]),
    )
    expect(await screen.findByText(/You scored 50%/)).toBeInTheDocument()
    expect(screen.getByText('Both x and y.')).toBeInTheDocument()
  })
})

describe('my learning', () => {
  it('offers the next lesson of the current course', async () => {
    api.myLearningRequest.mockResolvedValue({
      courses: [
        {
          course: { ...SUMMARY, enrolled: true },
          enrollment: { id: '9', enrolledAt: '', lastActivityAt: '', progress: PROGRESS },
        },
      ],
      recentActivity: [
        {
          kind: 'lesson',
          title: 'What is Python',
          detail: 'Lesson completed',
          courseSlug: 'python',
          courseTitle: 'Python Programming',
          at: '2026-10-02T00:00:00Z',
        },
      ],
    })
    renderAt('/learn', '/learn', <LearnHomePage />)

    expect(await screen.findByRole('link', { name: /Next lesson/ })).toHaveAttribute(
      'href',
      '/app/learn/courses/python/lessons/12',
    )
    expect(screen.getByText('Lesson: What is Python')).toBeInTheDocument()
  })

  it('lets a newcomer enroll in a course right there', async () => {
    api.myLearningRequest.mockResolvedValue({ courses: [], recentActivity: [] })
    api.coursesRequest.mockResolvedValue([SUMMARY])
    api.enrollRequest.mockResolvedValue({ success: true, message: 'Enrolled.', field: null })
    render(
      <MemoryRouter initialEntries={['/app/learn']}>
        <Routes>
          <Route path="/app/learn" element={<LearnHomePage />} />
          <Route path="/app/learn/courses/:courseSlug" element={<p>Course page</p>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Start a course' })).toBeInTheDocument()
    expect(screen.getByText('1 modules')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'See modules and lessons' })).toHaveAttribute(
      'href',
      '/app/learn/courses/python',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Enroll for free' }))

    await waitFor(() => expect(api.enrollRequest).toHaveBeenCalledWith('1'))
    expect(await screen.findByText('Course page')).toBeInTheDocument()
  })

  it('says so when no course is open yet', async () => {
    api.myLearningRequest.mockResolvedValue({ courses: [], recentActivity: [] })
    api.coursesRequest.mockResolvedValue([])
    renderAt('/learn', '/learn', <LearnHomePage />)

    expect(await screen.findByText('No course is open yet.')).toBeInTheDocument()
  })
})

describe('the learning menu and course contents', () => {
  function renderLearning(path: string) {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/app/learn" element={<LearningLayout />}>
            <Route path="courses/:courseSlug/lessons/:lessonId" element={<p>Lesson body</p>} />
            <Route path="courses" element={<p>Catalog</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )
  }

  it('offers my learning and the catalog on every learning page', () => {
    renderLearning('/app/learn/courses')

    const menu = within(screen.getByRole('navigation', { name: 'Learning' }))
    expect(menu.getByRole('link', { name: 'My learning' })).toHaveAttribute('href', '/app/learn')
    expect(menu.getByRole('link', { name: 'Course catalog' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByText('Catalog')).toBeInTheDocument()
  })

  it('lists the modules, lessons, exercises and quiz beside a lesson', async () => {
    api.courseRequest.mockResolvedValue(course(true))
    renderLearning('/app/learn/courses/python/lessons/12')

    const [contents] = await screen.findAllByRole('navigation', { name: 'Course contents' })
    const menu = within(contents)
    expect(menu.getByText('Introduction')).toBeInTheDocument()
    expect(menu.getByRole('link', { name: 'Variables' })).toHaveAttribute('aria-current', 'page')
    expect(menu.getByRole('link', { name: /What is Python/ })).toHaveTextContent('(done)')
    expect(menu.getByRole('link', { name: 'Calculator' })).toBeInTheDocument()
    expect(menu.getByRole('link', { name: 'Module quiz' })).toBeInTheDocument()
    expect(screen.getByText('Lesson body')).toBeInTheDocument()
  })

  it('lets a learner who has not enrolled do it from the contents', async () => {
    api.courseRequest.mockResolvedValue(course(false))
    api.enrollRequest.mockResolvedValue({ success: true, message: 'Enrolled.', field: null })
    renderLearning('/app/learn/courses/python/lessons/12')

    const [contents] = await screen.findAllByRole('navigation', { name: 'Course contents' })
    fireEvent.click(within(contents).getByRole('button', { name: 'Enroll for free' }))

    await waitFor(() => expect(api.enrollRequest).toHaveBeenCalledWith('1'))
    await waitFor(() => expect(api.courseRequest).toHaveBeenCalledTimes(2))
  })
})
