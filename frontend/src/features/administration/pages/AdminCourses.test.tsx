import { fireEvent, screen, waitFor, within } from '@testing-library/react'
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
  resources: [],
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
    // A draft is out of the catalog; the list says so, so none is left there unnoticed.
    expect(screen.getByText(/1 course is a draft: learners cannot see it/)).toBeInTheDocument()
    expect(screen.getByText('Hidden from learners until published')).toBeInTheDocument()
  })

  it('manages a course from its ⋮ menu', async () => {
    const draft = {
      id: '1',
      slug: 'new',
      title: 'new',
      status: 'draft' as const,
      levelLabel: 'Beginner to advanced',
      moduleCount: 1,
      lessonCount: 2,
      enrollmentCount: 0,
      updatedAt: '2026-10-31T00:00:00Z',
    }
    api.adminCoursesRequest.mockResolvedValue([draft])
    api.publishCourseRequest.mockResolvedValue({ ...OK, message: 'Course published.' })
    renderAdminPage(<AdminCoursesPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'More for new' }))
    const menu = within(screen.getByRole('menu', { name: 'Manage new' }))
    expect(menu.getByRole('menuitem', { name: 'Edit course' })).toHaveAttribute(
      'href',
      '/app/admin/courses/1',
    )
    expect(menu.getByRole('menuitem', { name: 'View as learner' })).toHaveAttribute(
      'href',
      '/app/admin/learn/courses/new',
    )
    // A draft can be published; it is not published, so it cannot be archived or unpublished.
    expect(menu.queryByRole('menuitem', { name: 'Archive' })).toBeNull()
    expect(menu.queryByRole('menuitem', { name: 'Return to draft' })).toBeNull()

    fireEvent.click(menu.getByRole('menuitem', { name: 'Publish' }))

    await waitFor(() => expect(api.publishCourseRequest).toHaveBeenCalledWith('1'))
    expect(await screen.findByText('Course published.')).toBeInTheDocument()
    await waitFor(() => expect(api.adminCoursesRequest).toHaveBeenCalledTimes(2))
  })

  it('asks before deleting, and shows why the server refuses', async () => {
    const live = {
      id: '2',
      slug: 'python',
      title: 'Python course',
      status: 'published' as const,
      levelLabel: 'Beginner to advanced',
      moduleCount: 1,
      lessonCount: 1,
      enrollmentCount: 3,
      updatedAt: '2026-10-30T00:00:00Z',
    }
    api.adminCoursesRequest.mockResolvedValue([live])
    api.deleteCourseRequest.mockResolvedValue({
      success: false,
      message: 'Learners are enrolled in this course, so it cannot be deleted.',
      field: null,
      id: null,
    })
    renderAdminPage(<AdminCoursesPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'More for Python course' }))
    const menu = within(screen.getByRole('menu'))
    expect(menu.getByRole('menuitem', { name: 'Archive' })).toBeInTheDocument()
    expect(menu.getByRole('menuitem', { name: 'Return to draft' })).toBeInTheDocument()
    fireEvent.click(menu.getByRole('menuitem', { name: 'Delete course' }))
    expect(api.deleteCourseRequest).not.toHaveBeenCalled()
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete course' }),
    )

    await waitFor(() => expect(api.deleteCourseRequest).toHaveBeenCalledWith('2'))
    expect(await screen.findByText(/cannot be deleted/)).toBeInTheDocument()
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

describe('AdminLessonEditorPage external resources', () => {
  const HARRY = 'https://archive.codewithharry.com/tutorial/python-objects-classes/'
  const RESOURCE = {
    id: '9',
    title: 'Python Objects and Classes - CodeWithHarry',
    description: 'Classes and objects.',
    url: HARRY,
    kind: 'embed' as const,
    displayOrder: 1,
    isPublished: false,
    createdAt: '2026-10-31T00:00:00Z',
    updatedAt: '2026-10-31T00:00:00Z',
  }

  function renderEditor() {
    return renderAdminPage(<AdminLessonEditorPage />, {
      path: '/courses/1/lessons/7',
      pattern: '/courses/:courseId/lessons/:lessonId',
    })
  }

  it('adds a web page to the lesson, saying where it will show', async () => {
    api.adminLessonRequest.mockResolvedValue(LESSON)
    api.createLessonResourceRequest.mockResolvedValue({ ...OK, message: 'Resource added.' })
    renderEditor()

    fireEvent.click(await screen.findByRole('button', { name: 'Add external resource' }))
    const form = within(screen.getByRole('form', { name: 'External resource' }))
    expect(form.getByText(/Python › Basics › Variables/)).toBeInTheDocument()
    fireEvent.change(form.getByLabelText('Resource title'), {
      target: { value: RESOURCE.title },
    })
    fireEvent.change(form.getByLabelText('Web address'), { target: { value: HARRY } })
    fireEvent.click(form.getByLabelText(/Published/))
    fireEvent.click(form.getByRole('button', { name: 'Add resource' }))

    await waitFor(() =>
      expect(api.createLessonResourceRequest).toHaveBeenCalledWith('7', {
        title: RESOURCE.title,
        url: HARRY,
        description: '',
        kind: 'embed',
        displayOrder: null,
        isPublished: true,
      }),
    )
    expect(await screen.findByText('Resource added.')).toBeInTheDocument()
  })

  it('shows the server refusing an address beside the field', async () => {
    api.adminLessonRequest.mockResolvedValue(LESSON)
    api.createLessonResourceRequest.mockResolvedValue({
      success: false,
      message: 'Use a web address that starts with https:// or http://.',
      field: 'url',
      id: null,
    })
    renderEditor()

    fireEvent.click(await screen.findByRole('button', { name: 'Add external resource' }))
    const form = within(screen.getByRole('form', { name: 'External resource' }))
    fireEvent.change(form.getByLabelText('Resource title'), { target: { value: 'Bad' } })
    fireEvent.change(form.getByLabelText('Web address'), {
      target: { value: 'javascript:alert(1)' },
    })
    fireEvent.click(form.getByRole('button', { name: 'Add resource' }))

    expect(await form.findByRole('alert')).toHaveTextContent('starts with https://')
  })

  it('previews, publishes and deletes a resource', async () => {
    api.adminLessonRequest.mockResolvedValue({ ...LESSON, resources: [RESOURCE] })
    api.setLessonResourcePublishedRequest.mockResolvedValue({
      ...OK,
      message: 'Resource published.',
    })
    api.deleteLessonResourceRequest.mockResolvedValue({ ...OK, message: 'Resource deleted.' })
    renderEditor()

    expect(await screen.findByText(RESOURCE.title)).toBeInTheDocument()
    expect(screen.getByText('Draft')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
    expect(screen.getByTitle(`${RESOURCE.title} (external resource)`)).toHaveAttribute('src', HARRY)

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
    await waitFor(() =>
      expect(api.setLessonResourcePublishedRequest).toHaveBeenCalledWith('9', true),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(api.deleteLessonResourceRequest).toHaveBeenCalledWith('9'))
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
