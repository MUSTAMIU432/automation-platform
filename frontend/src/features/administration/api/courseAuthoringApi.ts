/**
 * Course authoring for the console: courses, modules, lesson notes and files,
 * exercises and quizzes. Everything here needs `canManageCourses`; the server
 * answers anybody else with an empty list, null, or a refusal.
 *
 * These shapes carry what learners never see - solutions, hidden tests, correct
 * answers - which is why they live in the console's API, not the learner's.
 */

import { graphqlClient } from '../../../graphql/client'
import { getAccessToken } from '../../../graphql/tokenStore'
import { env } from '../../../lib/env'
import type { ContentBlock } from '../../learning/api/learningApi'

export interface AuthoringResult {
  success: boolean
  message: string
  field: string | null
  id: string | null
}

export interface AdminCourseListItem {
  id: string
  slug: string
  title: string
  status: 'draft' | 'published' | 'archived'
  levelLabel: string
  moduleCount: number
  lessonCount: number
  enrollmentCount: number
  updatedAt: string
}

export interface CapstoneOption {
  key: string
  title: string
  summary: string
}

export interface AdminModule {
  id: string
  position: number
  title: string
  summary: string
  objectives: string[]
  project: string
  lessons: Array<{
    id: string
    position: number
    title: string
    estimatedMinutes: number
    materialCount: number
  }>
  exercises: Array<{
    id: string
    title: string
    difficulty: string
    testCount: number
    hiddenTestCount: number
  }>
  quiz: { id: string; title: string; questionCount: number; passPercentage: number } | null
}

export interface AdminCourse {
  id: string
  slug: string
  title: string
  subtitle: string
  description: string
  level: string
  estimatedHours: number
  audience: string[]
  outcomes: string[]
  capstoneBrief: string
  capstoneRequirements: string[]
  capstoneOptions: CapstoneOption[]
  status: 'draft' | 'published' | 'archived'
  publishedAt: string | null
  enrollmentCount: number
  modules: AdminModule[]
}

export interface LessonMaterial {
  id: string
  title: string
  filename: string
  contentType: string
  size: number
  createdAt: string
  downloadUrl: string
}

export interface AdminLesson {
  id: string
  courseId: string
  courseTitle: string
  moduleId: string
  moduleTitle: string
  title: string
  summary: string
  objectives: string[]
  estimatedMinutes: number
  body: string
  blocks: ContentBlock[]
  materials: LessonMaterial[]
}

export interface AdminTest {
  name: string
  stdin: string
  call: string
  expectedOutput: string
  hidden: boolean
}

export interface AdminExercise {
  id: string
  courseId: string
  moduleId: string
  moduleTitle: string
  title: string
  difficulty: 'easy' | 'medium' | 'hard'
  lessonId: string | null
  instructions: string
  starterCode: string
  solutionCode: string
  hints: string[]
  tests: AdminTest[]
}

export interface AdminQuestion {
  prompt: string
  code: string
  kind: 'single' | 'multiple'
  explanation: string
  options: Array<{ text: string; correct: boolean }>
}

export interface AdminQuiz {
  id: string
  title: string
  passPercentage: number
  questions: AdminQuestion[]
}

export interface CourseInput {
  title: string
  subtitle: string
  description: string
  level: string
  estimatedHours: number
  audience: string[]
  outcomes: string[]
  capstoneBrief: string
  capstoneRequirements: string[]
  capstoneOptions: Array<{ title: string; summary: string; key?: string }>
}

export interface ModuleInput {
  title: string
  summary: string
  objectives: string[]
  project: string
}

export interface LessonInput {
  title: string
  summary: string
  objectives: string[]
  estimatedMinutes: number
  body: string
}

export interface ExerciseInput {
  title: string
  difficulty: string
  lessonId: string | null
  instructions: string
  starterCode: string
  solutionCode: string
  hints: string[]
  tests: AdminTest[]
}

const RESULT = 'success message field id'

async function mutate(name: string, signature: string, call: string, variables: object) {
  const data = await graphqlClient.request<Record<string, AuthoringResult>>(
    `mutation ${signature} { ${name}${call} { ${RESULT} } }`,
    variables,
  )
  return data[name]
}

export async function adminCoursesRequest(): Promise<AdminCourseListItem[]> {
  const data = await graphqlClient.request<{ adminCourses: AdminCourseListItem[] }>(
    `query AdminCourses {
       adminCourses {
         id slug title status levelLabel moduleCount lessonCount enrollmentCount updatedAt
       }
     }`,
  )
  return data.adminCourses
}

export async function adminCourseRequest(id: string): Promise<AdminCourse | null> {
  const data = await graphqlClient.request<{ adminCourse: AdminCourse | null }>(
    `query AdminCourse($id: ID!) {
       adminCourse(id: $id) {
         id slug title subtitle description level estimatedHours audience outcomes
         capstoneBrief capstoneRequirements capstoneOptions { key title summary }
         status publishedAt enrollmentCount
         modules {
           id position title summary objectives project
           lessons { id position title estimatedMinutes materialCount }
           exercises { id title difficulty testCount hiddenTestCount }
           quiz { id title questionCount passPercentage }
         }
       }
     }`,
    { id },
  )
  return data.adminCourse
}

export async function adminLessonRequest(id: string): Promise<AdminLesson | null> {
  const data = await graphqlClient.request<{ adminLesson: AdminLesson | null }>(
    `query AdminLesson($id: ID!) {
       adminLesson(id: $id) {
         id courseId courseTitle moduleId moduleTitle title summary objectives
         estimatedMinutes body blocks { kind text language }
         materials { id title filename contentType size createdAt downloadUrl }
       }
     }`,
    { id },
  )
  return data.adminLesson
}

export async function adminExerciseRequest(id: string): Promise<AdminExercise | null> {
  const data = await graphqlClient.request<{ adminExercise: AdminExercise | null }>(
    `query AdminExercise($id: ID!) {
       adminExercise(id: $id) {
         id courseId moduleId moduleTitle title difficulty lessonId instructions
         starterCode solutionCode hints tests { name stdin call expectedOutput hidden }
       }
     }`,
    { id },
  )
  return data.adminExercise
}

export async function adminQuizRequest(moduleId: string): Promise<AdminQuiz | null> {
  const data = await graphqlClient.request<{ adminQuiz: AdminQuiz | null }>(
    `query AdminQuiz($moduleId: ID!) {
       adminQuiz(moduleId: $moduleId) {
         id title passPercentage
         questions { prompt code kind explanation options { text correct } }
       }
     }`,
    { moduleId },
  )
  return data.adminQuiz
}

export async function previewContentRequest(
  source: string,
): Promise<{ blocks: ContentBlock[]; error: string | null }> {
  const data = await graphqlClient.request<{
    previewContent: { blocks: ContentBlock[]; error: string | null }
  }>(
    `query Preview($source: String!) {
       previewContent(source: $source) { blocks { kind text language } error }
     }`,
    { source },
  )
  return data.previewContent
}

export const createCourseRequest = (input: CourseInput) =>
  mutate('createCourse', 'CreateCourse($input: CourseInput!)', '(input: $input)', { input })

export const updateCourseRequest = (id: string, input: CourseInput) =>
  mutate(
    'updateCourse',
    'UpdateCourse($id: ID!, $input: CourseInput!)',
    '(id: $id, input: $input)',
    {
      id,
      input,
    },
  )

export const publishCourseRequest = (id: string) =>
  mutate('publishCourse', 'PublishCourse($id: ID!)', '(id: $id)', { id })

export const archiveCourseRequest = (id: string) =>
  mutate('archiveCourse', 'ArchiveCourse($id: ID!)', '(id: $id)', { id })

export const unpublishCourseRequest = (id: string) =>
  mutate('unpublishCourse', 'UnpublishCourse($id: ID!)', '(id: $id)', { id })

export const deleteCourseRequest = (id: string) =>
  mutate('deleteCourse', 'DeleteCourse($id: ID!)', '(id: $id)', { id })

export const createModuleRequest = (courseId: string, input: ModuleInput) =>
  mutate(
    'createModule',
    'CreateModule($courseId: ID!, $input: ModuleInput!)',
    '(courseId: $courseId, input: $input)',
    { courseId, input },
  )

export const updateModuleRequest = (id: string, input: ModuleInput) =>
  mutate(
    'updateModule',
    'UpdateModule($id: ID!, $input: ModuleInput!)',
    '(id: $id, input: $input)',
    {
      id,
      input,
    },
  )

export const moveModuleRequest = (id: string, direction: -1 | 1) =>
  mutate('moveModule', 'MoveModule($id: ID!, $d: Int!)', '(id: $id, direction: $d)', {
    id,
    d: direction,
  })

/** Every module of the course, in its new order. */
export const reorderModulesRequest = (courseId: string, ids: string[]) =>
  mutate(
    'reorderModules',
    'ReorderModules($courseId: ID!, $ids: [ID!]!)',
    '(courseId: $courseId, ids: $ids)',
    { courseId, ids },
  )

/** Every lesson the module will hold, in order - including any dragged in from another module. */
export const reorderLessonsRequest = (moduleId: string, ids: string[]) =>
  mutate(
    'reorderLessons',
    'ReorderLessons($moduleId: ID!, $ids: [ID!]!)',
    '(moduleId: $moduleId, ids: $ids)',
    { moduleId, ids },
  )

/** Every exercise of the module, in its new order. */
export const reorderExercisesRequest = (moduleId: string, ids: string[]) =>
  mutate(
    'reorderExercises',
    'ReorderExercises($moduleId: ID!, $ids: [ID!]!)',
    '(moduleId: $moduleId, ids: $ids)',
    { moduleId, ids },
  )

export const deleteModuleRequest = (id: string) =>
  mutate('deleteModule', 'DeleteModule($id: ID!)', '(id: $id)', { id })

export const createLessonRequest = (moduleId: string, input: LessonInput) =>
  mutate(
    'createLesson',
    'CreateLesson($moduleId: ID!, $input: LessonInput!)',
    '(moduleId: $moduleId, input: $input)',
    { moduleId, input },
  )

export const updateLessonRequest = (id: string, input: LessonInput) =>
  mutate(
    'updateLesson',
    'UpdateLesson($id: ID!, $input: LessonInput!)',
    '(id: $id, input: $input)',
    {
      id,
      input,
    },
  )

export const moveLessonRequest = (id: string, direction: -1 | 1) =>
  mutate('moveLesson', 'MoveLesson($id: ID!, $d: Int!)', '(id: $id, direction: $d)', {
    id,
    d: direction,
  })

export const deleteLessonRequest = (id: string) =>
  mutate('deleteLesson', 'DeleteLesson($id: ID!)', '(id: $id)', { id })

export const saveExerciseRequest = (moduleId: string, input: ExerciseInput, id?: string) =>
  mutate(
    'saveExercise',
    'SaveExercise($moduleId: ID!, $input: ExerciseInput!, $id: ID)',
    '(moduleId: $moduleId, input: $input, id: $id)',
    { moduleId, input, id: id ?? null },
  )

export const deleteExerciseRequest = (id: string) =>
  mutate('deleteExercise', 'DeleteExercise($id: ID!)', '(id: $id)', { id })

export const saveQuizRequest = (
  moduleId: string,
  title: string,
  passPercentage: number,
  questions: AdminQuestion[],
) =>
  mutate(
    'saveQuiz',
    'SaveQuiz($moduleId: ID!, $title: String!, $pass: Int!, $questions: [QuestionInput!]!)',
    '(moduleId: $moduleId, title: $title, passPercentage: $pass, questions: $questions)',
    { moduleId, title, pass: passPercentage, questions },
  )

export const deleteQuizRequest = (moduleId: string) =>
  mutate('deleteQuiz', 'DeleteQuiz($moduleId: ID!)', '(moduleId: $moduleId)', { moduleId })

export const deleteLessonMaterialRequest = (id: string) =>
  mutate('deleteLessonMaterial', 'DeleteMaterial($id: ID!)', '(id: $id)', { id })

/** Upload a file to a lesson. Multipart, outside GraphQL - like an idea's attachments. */
export async function uploadLessonMaterialRequest(
  lessonId: string,
  file: File,
  title: string,
): Promise<{ success: boolean; message: string; material?: LessonMaterial }> {
  const body = new FormData()
  body.append('file', file)
  body.append('title', title)
  const token = getAccessToken()
  try {
    const response = await fetch(`${env.apiBaseUrl}/learning/lessons/${lessonId}/materials/`, {
      method: 'POST',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body,
    })
    const payload = (await response.json()) as {
      success: boolean
      message: string
      material?: LessonMaterial
    }
    return payload
  } catch {
    return { success: false, message: 'We could not reach the server. Please try again.' }
  }
}
