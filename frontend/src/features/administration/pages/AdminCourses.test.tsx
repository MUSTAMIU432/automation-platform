import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { READ_ONLY_ADMIN, renderAdminPage } from '../../../test/renderAdmin'
import type { AdminLesson } from '../api/courseAuthoringApi'
import { AdminCoursesPage } from './AdminCoursesPage'
import { AdminLessonEditorPage } from './AdminLessonEditorPage'
import { AdminQuizEditorPage } from './AdminQuizEditorPage'

vi.mock('../api/courseAuthoringApi')
const api = vi.mocked(await import('../api/courseAuthoringApi'))

const OK = { success: true, message: 'Saved.', field: null, id: '3' }

const LESSON: AdminLesson = {
  id: '7',
  courseId: '1',
  courseTitle: 'Python',
  moduleId: '2',
  moduleTitle: 'Basics',
  title: 'Variables',
  summary: '',
  objectives: [],
  estimatedMinutes: 20,
  body: '## Hello',
  blocks: [],
  materials: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  api.previewContentRequest.mockResolvedValue({
    blocks: [{ kind: 'heading', text: 'Hello', language: '' }],
    error: null,
  })
})

describe('AdminCoursesPage', () => {
  it('lists courses with their status', async () => {
    api.adminCoursesRequest.mockResolvedValue([
      {
        id: '1',
        slug: 'python',
        title: 'Python Programming',
        status: 'draft',
        levelLabel: 'Beginner to advanced',
        moduleCount: 12,
        lessonCount: 28,
        enrollmentCount: 0,
        updatedAt: '2026-10-26T00:00:00Z',
      },
    ])
    renderAdminPage(<AdminCoursesPage />)

    expect(await screen.findByText('Python Programming')).toBeInTheDocument()
    expect(screen.getByText('Draft')).toBeInTheDocument()
    expect(screen.getByText(/12 modules · 28 lessons/)).toBeInTheDocument()
  })

  it('creates a course as a draft', async () => {
    api.adminCoursesRequest.mockResolvedValue([])
    api.createCourseRequest.mockResolvedValue(OK)
    renderAdminPage(<AdminCoursesPage />)

    fireEvent.change(await screen.findByLabelText('Title'), {
      target: { value: 'Data with Python' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create course' }))

    await waitFor(() =>
      expect(api.createCourseRequest).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Data with Python' }),
      ),
    )
  })

  it('says so without the course permission', () => {
    api.adminCoursesRequest.mockResolvedValue([])
    renderAdminPage(<AdminCoursesPage />, { capabilities: READ_ONLY_ADMIN })

    expect(screen.getByText('Managing courses needs the course permission.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create course' })).not.toBeInTheDocument()
  })
})

describe('AdminLessonEditorPage', () => {
  function renderEditor() {
    return renderAdminPage(<AdminLessonEditorPage />, {
      path: '/courses/1/lessons/7',
      pattern: '/courses/:courseId/lessons/:lessonId',
    })
  }

  it('previews and saves the notes', async () => {
    api.adminLessonRequest.mockResolvedValue(LESSON)
    api.updateLessonRequest.mockResolvedValue({ ...OK, message: 'Lesson saved.' })
    renderEditor()

    const notes = await screen.findByLabelText('Notes')
    fireEvent.change(notes, { target: { value: '## Hello\nNew notes.' } })
    await waitFor(() =>
      expect(api.previewContentRequest).toHaveBeenLastCalledWith('## Hello\nNew notes.'),
    )
    expect(await screen.findByRole('heading', { name: 'Hello' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Save lesson' }))

    await waitFor(() =>
      expect(api.updateLessonRequest).toHaveBeenCalledWith(
        '7',
        expect.objectContaining({ body: '## Hello\nNew notes.', estimatedMinutes: 20 }),
      ),
    )
    expect(await screen.findByText('Lesson saved.')).toBeInTheDocument()
  })

  it('will not save notes the preview cannot read', async () => {
    api.adminLessonRequest.mockResolvedValue(LESSON)
    api.previewContentRequest.mockResolvedValue({
      blocks: [],
      error: 'A code block is never closed.',
    })
    renderEditor()

    expect(await screen.findByText('A code block is never closed.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save lesson' })).toBeDisabled()
  })

  it('uploads a file to the lesson', async () => {
    api.adminLessonRequest.mockResolvedValue(LESSON)
    api.uploadLessonMaterialRequest.mockResolvedValue({ success: true, message: 'File uploaded.' })
    renderEditor()

    const file = new File(['%PDF-1.4'], 'notes.pdf', { type: 'application/pdf' })
    fireEvent.change(await screen.findByLabelText('File'), { target: { files: [file] } })
    fireEvent.change(screen.getByLabelText('Title (optional)'), { target: { value: 'Week 1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }))

    await waitFor(() =>
      expect(api.uploadLessonMaterialRequest).toHaveBeenCalledWith('7', file, 'Week 1'),
    )
    expect(await screen.findByText('File uploaded.')).toBeInTheDocument()
  })
})

describe('AdminQuizEditorPage', () => {
  it('saves questions with their correct answers', async () => {
    api.adminCourseRequest.mockResolvedValue({
      id: '1',
      slug: 'python',
      title: 'Python',
      subtitle: '',
      description: '',
      level: 'beginner',
      estimatedHours: 1,
      audience: [],
      outcomes: [],
      capstoneBrief: '',
      capstoneRequirements: [],
      capstoneOptions: [],
      status: 'draft',
      publishedAt: null,
      enrollmentCount: 0,
      modules: [
        {
          id: '2',
          position: 1,
          title: 'Basics',
          summary: '',
          objectives: [],
          project: '',
          lessons: [],
          exercises: [],
          quiz: null,
        },
      ],
    })
    api.adminQuizRequest.mockResolvedValue(null)
    api.saveQuizRequest.mockResolvedValue({ ...OK, message: 'Quiz saved.' })
    renderAdminPage(<AdminQuizEditorPage />, {
      path: '/courses/1/modules/2/quiz',
      pattern: '/courses/:courseId/modules/:moduleId/quiz',
    })

    fireEvent.change(await screen.findByLabelText('Question'), {
      target: { value: 'What is 2 + 2?' },
    })
    fireEvent.change(screen.getByLabelText('Answer 1'), { target: { value: '4' } })
    fireEvent.change(screen.getByLabelText('Answer 2'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save quiz' }))

    await waitFor(() =>
      expect(api.saveQuizRequest).toHaveBeenCalledWith('2', 'Module quiz', 70, [
        expect.objectContaining({
          prompt: 'What is 2 + 2?',
          kind: 'single',
          options: [
            { text: '4', correct: true },
            { text: '5', correct: false },
          ],
        }),
      ]),
    )
    expect(await screen.findByText('Quiz saved.')).toBeInTheDocument()
  })
})
