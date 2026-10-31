/**
 * GraphQL operations for Learning: courses, lessons, coding exercises, quizzes.
 *
 * What a learner must not see is not in these shapes because the server never
 * sends it: an exercise's solution, its hidden tests' inputs and expected output,
 * and which quiz answers are correct. Code is only ever run by the server's
 * sandbox (`runExerciseCode`, `submitExercise`) - never in this app.
 */

import { graphqlClient } from '../../../graphql/client'
import { getAccessToken } from '../../../graphql/tokenStore'
import { env } from '../../../lib/env'

export interface Outcome {
  success: boolean
  message: string
  field: string | null
}

export interface ContentBlock {
  kind: 'heading' | 'paragraph' | 'list' | 'code' | 'note'
  text: string
  language: string
}

export interface CourseSummary {
  id: string
  slug: string
  title: string
  subtitle: string
  description: string
  level: string
  levelLabel: string
  estimatedHours: number
  moduleCount: number
  lessonCount: number
  status: 'draft' | 'published' | 'archived'
  enrolled: boolean
}

export interface Progress {
  completedLessons: number
  totalLessons: number
  passedExercises: number
  totalExercises: number
  passedQuizzes: number
  totalQuizzes: number
  capstoneSubmitted: boolean
  percent: number
  nextLessonId: string | null
  completionGaps: string[]
  completedAt: string | null
  certificateCode: string | null
}

export interface Enrollment {
  id: string
  enrolledAt: string
  lastActivityAt: string
  progress: Progress
}

export interface LessonSummary {
  id: string
  slug: string
  title: string
  summary: string
  estimatedMinutes: number
  completed: boolean
}

export interface ExerciseSummary {
  id: string
  slug: string
  title: string
  difficulty: 'easy' | 'medium' | 'hard'
  lessonId: string | null
  attempted: boolean
  passed: boolean
}

export interface QuizSummary {
  id: string
  title: string
  questionCount: number
  passPercentage: number
  bestPercentage: number | null
  passed: boolean
}

export interface CourseModule {
  id: string
  slug: string
  position: number
  title: string
  summary: string
  objectives: string[]
  project: string
  lessons: LessonSummary[]
  exercises: ExerciseSummary[]
  quiz: QuizSummary | null
}

export interface CapstoneSubmission {
  option: string
  repositoryUrl: string
  documentationUrl: string
  howToRun: string
  designDecisions: string
  submittedAt: string
  updatedAt: string
}

export interface Course {
  summary: CourseSummary
  audience: string[]
  outcomes: string[]
  modules: CourseModule[]
  capstone: {
    brief: string
    requirements: string[]
    options: Array<{ key: string; title: string; summary: string }>
    submission: CapstoneSubmission | null
  }
  enrollment: Enrollment | null
  canManage: boolean
}

export interface Lesson {
  id: string
  slug: string
  title: string
  summary: string
  objectives: string[]
  estimatedMinutes: number
  blocks: ContentBlock[]
  courseSlug: string
  courseTitle: string
  moduleId: string
  modulePosition: number
  moduleTitle: string
  previousLessonId: string | null
  nextLessonId: string | null
  completed: boolean
  exercises: ExerciseSummary[]
  quizId: string | null
  materials: LessonFile[]
  /** External web pages for the lesson, in display order. Published ones only. */
  resources: LessonResource[]
}

/**
 * An external web page that belongs to a lesson: `embed` shows it in a frame,
 * `link` offers it to open on its own site (for a site that refuses framing).
 */
export interface LessonResource {
  id: string
  title: string
  description: string
  url: string
  kind: 'embed' | 'link'
}

/** A file the course's authors attached to a lesson: notes, slides, a worksheet. */
export interface LessonFile {
  id: string
  title: string
  filename: string
  contentType: string
  size: number
  /** A path on the API, fetched with the learner's token - the bucket itself is private. */
  downloadUrl: string
}

export interface TestResult {
  name: string
  hidden: boolean
  passed: boolean
  stdin: string
  call: string
  expected: string
  actual: string
  error: string
}

export interface Submission {
  id: string
  code: string
  status: 'passed' | 'failed'
  passedCount: number
  totalCount: number
  results: TestResult[]
  createdAt: string
}

export interface Exercise {
  id: string
  slug: string
  title: string
  difficulty: 'easy' | 'medium' | 'hard'
  instructions: ContentBlock[]
  starterCode: string
  visibleTests: Array<{
    id: string
    name: string
    stdin: string
    call: string
    expectedOutput: string
  }>
  hiddenTestCount: number
  hints: string[]
  hintCount: number
  courseSlug: string
  courseTitle: string
  moduleTitle: string
  lessonId: string | null
  lessonTitle: string
  passed: boolean
  submissions: Submission[]
  executionAvailable: boolean
}

export interface QuizAttempt {
  id: string
  score: number
  maxScore: number
  percentage: number
  passed: boolean
  createdAt: string
}

export interface Quiz {
  id: string
  title: string
  passPercentage: number
  courseSlug: string
  courseTitle: string
  modulePosition: number
  moduleTitle: string
  questions: Array<{
    id: string
    prompt: string
    code: string
    kind: 'single' | 'multiple'
    options: Array<{ id: string; text: string }>
  }>
  attempts: QuizAttempt[]
}

export interface RunResult {
  stdout: string
  stderr: string
  exitCode: number | null
  killed: boolean
}

export interface Activity {
  kind: 'lesson' | 'exercise' | 'quiz'
  title: string
  detail: string
  courseSlug: string
  courseTitle: string
  at: string
}

export interface MyLearning {
  courses: Array<{ course: CourseSummary; enrollment: Enrollment }>
  recentActivity: Activity[]
}

const SUMMARY = `id slug title subtitle description level levelLabel estimatedHours
  moduleCount lessonCount status enrolled`
const PROGRESS = `progress { completedLessons totalLessons passedExercises totalExercises
  passedQuizzes totalQuizzes capstoneSubmitted percent nextLessonId completionGaps
  completedAt certificateCode }`
const ENROLLMENT = `id enrolledAt lastActivityAt ${PROGRESS}`
const EXERCISE_SUMMARY = 'id slug title difficulty lessonId attempted passed'
const COURSE = `
  summary { ${SUMMARY} }
  audience outcomes canManage
  modules {
    id slug position title summary objectives project
    lessons { id slug title summary estimatedMinutes completed }
    exercises { ${EXERCISE_SUMMARY} }
    quiz { id title questionCount passPercentage bestPercentage passed }
  }
  capstone {
    brief requirements options { key title summary }
    submission { option repositoryUrl documentationUrl howToRun designDecisions submittedAt updatedAt }
  }
  enrollment { ${ENROLLMENT} }`
const BLOCK = 'kind text language'
const LESSON = `id slug title summary objectives estimatedMinutes blocks { ${BLOCK} }
  courseSlug courseTitle moduleId modulePosition moduleTitle previousLessonId nextLessonId
  completed exercises { ${EXERCISE_SUMMARY} } quizId
  materials { id title filename contentType size downloadUrl }
  resources { id title description url kind }`
const SUBMISSION = `id code status passedCount totalCount createdAt
  results { name hidden passed stdin call expected actual error }`
const EXERCISE = `id slug title difficulty instructions { ${BLOCK} } starterCode
  visibleTests { id name stdin call expectedOutput } hiddenTestCount hints hintCount
  courseSlug courseTitle moduleTitle lessonId lessonTitle passed executionAvailable
  submissions { ${SUBMISSION} }`

export async function coursesRequest(search = '', level = ''): Promise<CourseSummary[]> {
  const data = await graphqlClient.request<{ courses: CourseSummary[] }>(
    `query Courses($search: String!, $level: String!) {
       courses(search: $search, level: $level) { ${SUMMARY} }
     }`,
    { search, level },
  )
  return data.courses
}

export async function courseRequest(slug: string): Promise<Course | null> {
  const data = await graphqlClient.request<{ course: Course | null }>(
    `query Course($slug: String!) { course(slug: $slug) { ${COURSE} } }`,
    { slug },
  )
  return data.course
}

export async function lessonRequest(id: string): Promise<Lesson | null> {
  const data = await graphqlClient.request<{ lesson: Lesson | null }>(
    `query Lesson($id: ID!) { lesson(id: $id) { ${LESSON} } }`,
    { id },
  )
  return data.lesson
}

export async function exerciseRequest(id: string): Promise<Exercise | null> {
  const data = await graphqlClient.request<{ exercise: Exercise | null }>(
    `query Exercise($id: ID!) { exercise(id: $id) { ${EXERCISE} } }`,
    { id },
  )
  return data.exercise
}

export async function quizRequest(id: string): Promise<Quiz | null> {
  const data = await graphqlClient.request<{ quiz: Quiz | null }>(
    `query Quiz($id: ID!) {
       quiz(id: $id) {
         id title passPercentage courseSlug courseTitle modulePosition moduleTitle
         questions { id prompt code kind options { id text } }
         attempts { id score maxScore percentage passed createdAt }
       }
     }`,
    { id },
  )
  return data.quiz
}

export async function myLearningRequest(): Promise<MyLearning> {
  const data = await graphqlClient.request<{ myLearning: MyLearning }>(
    `query MyLearning {
       myLearning {
         courses { course { ${SUMMARY} } enrollment { ${ENROLLMENT} } }
         recentActivity { kind title detail courseSlug courseTitle at }
       }
     }`,
  )
  return data.myLearning
}

export async function enrollRequest(courseId: string): Promise<Outcome> {
  const data = await graphqlClient.request<{ enrollInCourse: Outcome }>(
    `mutation Enroll($id: ID!) { enrollInCourse(courseId: $id) { success message field } }`,
    { id: courseId },
  )
  return data.enrollInCourse
}

export async function completeLessonRequest(lessonId: string): Promise<Outcome> {
  const data = await graphqlClient.request<{ completeLesson: Outcome }>(
    `mutation CompleteLesson($id: ID!) { completeLesson(lessonId: $id) { success message field } }`,
    { id: lessonId },
  )
  return data.completeLesson
}

export async function runCodeRequest(
  exerciseId: string,
  code: string,
  stdin: string,
): Promise<Outcome & { result: RunResult | null }> {
  const data = await graphqlClient.request<{
    runExerciseCode: Outcome & { result: RunResult | null }
  }>(
    `mutation RunCode($id: ID!, $code: String!, $stdin: String!) {
       runExerciseCode(exerciseId: $id, code: $code, stdin: $stdin) {
         success message field result { stdout stderr exitCode killed }
       }
     }`,
    { id: exerciseId, code, stdin },
  )
  return data.runExerciseCode
}

export async function submitExerciseRequest(
  exerciseId: string,
  code: string,
): Promise<Outcome & { submission: Submission | null; exercise: Exercise | null }> {
  const data = await graphqlClient.request<{
    submitExercise: Outcome & { submission: Submission | null; exercise: Exercise | null }
  }>(
    `mutation SubmitExercise($id: ID!, $code: String!) {
       submitExercise(exerciseId: $id, code: $code) {
         success message field submission { ${SUBMISSION} } exercise { ${EXERCISE} }
       }
     }`,
    { id: exerciseId, code },
  )
  return data.submitExercise
}

export interface QuestionResult {
  questionId: string
  correct: boolean
  explanation: string
}

export async function submitQuizRequest(
  quizId: string,
  answers: Array<{ questionId: string; optionIds: string[] }>,
): Promise<Outcome & { attempt: QuizAttempt | null; results: QuestionResult[] }> {
  const data = await graphqlClient.request<{
    submitQuiz: Outcome & { attempt: QuizAttempt | null; results: QuestionResult[] }
  }>(
    `mutation SubmitQuiz($id: ID!, $answers: [QuizAnswerInput!]!) {
       submitQuiz(quizId: $id, answers: $answers) {
         success message field
         attempt { id score maxScore percentage passed createdAt }
         results { questionId correct explanation }
       }
     }`,
    { id: quizId, answers },
  )
  return data.submitQuiz
}

export interface CapstoneInput {
  courseId: string
  option: string
  repositoryUrl: string
  documentationUrl: string
  howToRun: string
  designDecisions: string
}

export async function submitCapstoneRequest(input: CapstoneInput): Promise<Outcome> {
  const data = await graphqlClient.request<{ submitCapstone: Outcome }>(
    `mutation SubmitCapstone($input: CapstoneInput!) {
       submitCapstone(input: $input) { success message field }
     }`,
    { input },
  )
  return data.submitCapstone
}

export async function completeCourseRequest(courseId: string): Promise<Outcome> {
  const data = await graphqlClient.request<{ completeCourse: Outcome }>(
    `mutation CompleteCourse($id: ID!) { completeCourse(courseId: $id) { success message field } }`,
    { id: courseId },
  )
  return data.completeCourse
}

const BLOB_URL_LIFETIME_MS = 40_000

/**
 * A lesson file, fetched with the reader's token, as an object URL. The caller revokes
 * it when done - the in-app preview keeps it for as long as the preview is open.
 */
export async function fetchLessonFileUrl(
  file: Pick<LessonFile, 'downloadUrl' | 'contentType'>,
): Promise<string> {
  const token = getAccessToken()
  const response = await fetch(`${env.apiBaseUrl}${file.downloadUrl}`, {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok) throw new Error('Could not download this file.')
  // Re-typed from the server's recorded type, never the response's.
  return URL.createObjectURL(new Blob([await response.blob()], { type: file.contentType }))
}

async function fetchFile(file: Pick<LessonFile, 'downloadUrl' | 'contentType'>): Promise<string> {
  const url = await fetchLessonFileUrl(file)
  setTimeout(() => URL.revokeObjectURL(url), BLOB_URL_LIFETIME_MS)
  return url
}

/** Save a lesson file through the browser's own download. */
export async function downloadLessonFile(
  file: Pick<LessonFile, 'downloadUrl' | 'contentType' | 'filename'>,
): Promise<void> {
  const url = await fetchFile(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/** PDFs and images can be read in a tab; everything else is a download. SVG never is. */
export function canOpenInTab(file: Pick<LessonFile, 'contentType'>): boolean {
  return ['application/pdf', 'image/png', 'image/jpeg'].includes(file.contentType)
}

/** Open a PDF or image in a new tab. The tab opens first, as the click allows. */
export async function openLessonFile(
  file: Pick<LessonFile, 'downloadUrl' | 'contentType'>,
): Promise<void> {
  const tab = window.open('about:blank', '_blank')
  try {
    const url = await fetchFile(file)
    if (tab === null) {
      window.location.assign(url)
      return
    }
    tab.opener = null
    tab.location.href = url
  } catch (error) {
    tab?.close()
    throw error
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
