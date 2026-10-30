import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderAdminPage } from '../../../test/renderAdmin'
import type { AdminCourse, AdminModule, LessonMaterial } from '../api/courseAuthoringApi'
import { AdminCourseEditorPage } from './AdminCourseEditorPage'

vi.mock('../api/courseAuthoringApi')
const api = vi.mocked(await import('../api/courseAuthoringApi'))
vi.mock('../../learning/api/learningApi', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchLessonFileUrl: vi.fn(),
  downloadLessonFile: vi.fn(),
}))
const fileApi = vi.mocked(await import('../../learning/api/learningApi'))

const OK = { success: true, message: 'Reordered.', field: null, id: null }

const lesson = (id: string, title: string, position: number, materials: LessonMaterial[] = []) => ({
  id,
  title,
  position,
  estimatedMinutes: 10,
  materialCount: materials.length,
  materials,
})
const exercise = (id: string, title: string) => ({
  id,
  title,
  difficulty: 'easy',
  testCount: 2,
  hiddenTestCount: 1,
})
const module = (id: string, title: string, position: number, more: Partial<AdminModule>) => ({
  id,
  title,
  position,
  summary: '',
  objectives: [],
  project: '',
  lessons: [],
  exercises: [],
  quiz: null,
  ...more,
})

const COURSE: AdminCourse = {
  id: '1',
  slug: 'python',
  title: 'Python',
  subtitle: '',
  description: '',
  level: 'beginner',
  estimatedHours: 10,
  audience: [],
  outcomes: [],
  capstoneBrief: '',
  capstoneRequirements: [],
  capstoneOptions: [],
  status: 'draft',
  publishedAt: null,
  enrollmentCount: 0,
  modules: [
    module('A', 'Basics', 1, {
      lessons: [lesson('11', 'Variables', 1), lesson('12', 'Strings', 2)],
      exercises: [exercise('31', 'Double it'), exercise('32', 'Triple it')],
    }),
    module('B', 'Functions', 2, {
      lessons: [lesson('21', 'Defining', 1), lesson('22', 'Returning', 2)],
    }),
  ],
}

function renderEditor() {
  return renderAdminPage(<AdminCourseEditorPage />, {
    path: '/app/admin/courses/1',
    pattern: '/app/admin/courses/:courseId',
  })
}

/** A drag from `source` to `target`, as the browser sends it (the pointer at the target's top). */
function drag(source: HTMLElement, target: HTMLElement) {
  fireEvent.dragStart(source)
  fireEvent.dragOver(target)
  fireEvent.drop(target)
  fireEvent.dragEnd(source)
}

const titles = (list: HTMLElement) =>
  within(list)
    .getAllByRole('link')
    .map((link) => link.textContent)

beforeEach(() => {
  vi.clearAllMocks()
  api.adminCourseRequest.mockResolvedValue(COURSE)
})

describe('AdminCourseEditorPage drag and drop', () => {
  it('drags a lesson up within its module, showing the new order at once', async () => {
    api.reorderLessonsRequest.mockReturnValue(new Promise(() => {}))
    renderEditor()

    drag(await screen.findByTestId('lesson-12'), screen.getByTestId('lesson-11'))

    expect(api.reorderLessonsRequest).toHaveBeenCalledWith('A', ['12', '11'])
    expect(titles(screen.getByRole('list', { name: 'Lessons in Basics' }))).toEqual([
      'Strings',
      'Variables',
    ])
  })

  it('drags a lesson into another module', async () => {
    api.reorderLessonsRequest.mockResolvedValue(OK)
    renderEditor()

    drag(await screen.findByTestId('lesson-11'), screen.getByTestId('module-B'))

    expect(api.reorderLessonsRequest).toHaveBeenCalledWith('B', ['21', '22', '11'])
    await waitFor(() => expect(api.adminCourseRequest).toHaveBeenCalledTimes(2))
  })

  it('drags a module above another', async () => {
    api.reorderModulesRequest.mockReturnValue(new Promise(() => {}))
    renderEditor()

    drag(await screen.findByTestId('drag-module-B'), screen.getByTestId('module-A'))

    expect(api.reorderModulesRequest).toHaveBeenCalledWith('1', ['B', 'A'])
    expect(screen.getByRole('heading', { name: '1. Functions' })).toBeInTheDocument()
  })

  it('drops a module over a lesson row onto that module card', async () => {
    api.reorderModulesRequest.mockReturnValue(new Promise(() => {}))
    renderEditor()

    drag(await screen.findByTestId('drag-module-B'), screen.getByTestId('lesson-11'))

    expect(api.reorderModulesRequest).toHaveBeenCalledWith('1', ['B', 'A'])
  })

  it('reorders exercises by dragging and with the arrow buttons', async () => {
    api.reorderExercisesRequest.mockResolvedValue(OK)
    renderEditor()

    drag(await screen.findByTestId('exercise-32'), screen.getByTestId('exercise-31'))
    expect(api.reorderExercisesRequest).toHaveBeenCalledWith('A', ['32', '31'])

    await waitFor(() => expect(api.adminCourseRequest).toHaveBeenCalledTimes(2))
    fireEvent.click(await screen.findByRole('button', { name: 'Move Double it down' }))
    expect(api.reorderExercisesRequest).toHaveBeenLastCalledWith('A', ['32', '31'])
  })

  it('keeps an exercise in its own module', async () => {
    renderEditor()

    drag(await screen.findByTestId('exercise-31'), screen.getByTestId('module-B'))

    expect(api.reorderExercisesRequest).not.toHaveBeenCalled()
    expect(api.reorderModulesRequest).not.toHaveBeenCalled()
  })

  it('does nothing when an item is dropped where it already is', async () => {
    renderEditor()

    drag(await screen.findByTestId('lesson-11'), screen.getByTestId('lesson-11'))

    expect(api.reorderLessonsRequest).not.toHaveBeenCalled()
  })

  it('goes back to the saved order when the server refuses', async () => {
    api.reorderLessonsRequest.mockResolvedValue({
      success: false,
      message: 'The lessons changed while you were editing. Reload the page.',
      field: null,
      id: null,
    })
    renderEditor()

    drag(await screen.findByTestId('lesson-12'), screen.getByTestId('lesson-11'))

    expect(await screen.findByText(/Reload the page/)).toBeInTheDocument()
    expect(titles(screen.getByRole('list', { name: 'Lessons in Basics' }))).toEqual([
      'Variables',
      'Strings',
    ])
  })
})

describe('AdminCourseEditorPage details', () => {
  it('opens on the curriculum and moves between tabs', async () => {
    renderEditor()

    expect(await screen.findByRole('tab', { name: /Curriculum/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Settings' }))

    expect(screen.getByRole('heading', { name: 'Delete this course' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Lessons in Basics' })).not.toBeInTheDocument()
  })

  it('shows the save bar only once something changed, and saves lists as lists', async () => {
    api.updateCourseRequest.mockResolvedValue({ ...OK, message: 'Course saved.' })
    renderEditor()

    fireEvent.click(await screen.findByRole('tab', { name: 'Details' }))
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Subtitle'), { target: { value: 'From zero' } })
    fireEvent.click(screen.getByRole('button', { name: 'Choose outcomes' }))
    const dialog = within(screen.getByRole('dialog', { name: 'What will learners be able to do?' }))
    fireEvent.click(dialog.getByLabelText('Use version control with Git'))
    fireEvent.change(dialog.getByLabelText('Add your own'), { target: { value: 'Write Python' } })
    fireEvent.keyDown(dialog.getByLabelText('Add your own'), { key: 'Enter' })
    expect(dialog.getByText('2 selected')).toBeInTheDocument()
    fireEvent.click(dialog.getByRole('button', { name: 'Apply' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Details •' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(api.updateCourseRequest).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({
          subtitle: 'From zero',
          outcomes: ['Use version control with Git', 'Write Python'],
          audience: [],
        }),
      ),
    )
  })

  it('picks an audience in a dialog: search, cancel, apply, and remove a chip', async () => {
    renderEditor()

    fireEvent.click(await screen.findByRole('tab', { name: 'Details' }))
    fireEvent.click(screen.getByRole('button', { name: 'Choose audience' }))
    let dialog = within(screen.getByRole('dialog', { name: 'Who is this course for?' }))
    fireEvent.change(dialog.getByLabelText('Search the list'), { target: { value: 'beginners' } })
    expect(dialog.getAllByRole('checkbox')).toHaveLength(1)
    fireEvent.click(dialog.getByLabelText('Complete beginners with no programming experience'))
    fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Choose audience' }))
    dialog = within(screen.getByRole('dialog', { name: 'Who is this course for?' }))
    fireEvent.click(dialog.getByLabelText('Complete beginners with no programming experience'))
    fireEvent.click(dialog.getByLabelText('Teams who need a shared technical foundation'))
    fireEvent.click(dialog.getByRole('button', { name: 'Apply' }))

    const chips = within(screen.getByRole('list', { name: 'Who it is for' }))
    expect(chips.getAllByRole('listitem')).toHaveLength(2)
    fireEvent.click(
      chips.getByRole('button', { name: 'Remove “Teams who need a shared technical foundation”' }),
    )
    expect(chips.getAllByRole('listitem')).toHaveLength(1)
    expect(api.updateCourseRequest).not.toHaveBeenCalled()
  })

  it('throws edits away on Discard', async () => {
    renderEditor()

    fireEvent.click(await screen.findByRole('tab', { name: 'Details' }))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Renamed' } })
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))

    expect(screen.getByLabelText('Title')).toHaveValue('Python')
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument()
  })
})

describe('AdminCourseEditorPage PDF upload', () => {
  const pdf = (name: string) => new File(['%PDF-1.7'], name, { type: 'application/pdf' })

  function choose(files: File[]) {
    fireEvent.change(screen.getByLabelText('Choose PDF files'), { target: { files } })
  }

  it('turns each PDF into a lesson in the chosen module', async () => {
    api.createLessonRequest.mockResolvedValue({ ...OK, id: '55' })
    api.uploadLessonMaterialRequest.mockResolvedValue({
      success: true,
      message: 'Uploaded.',
      notesWritten: true,
      lessonsWritten: 1,
    })
    renderEditor()

    fireEvent.click(await screen.findByRole('button', { name: 'Upload PDFs to Functions' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Upload PDFs as lessons' }))
    expect(dialog.getByLabelText('Module')).toHaveValue('B')
    choose([pdf('03_return-values.pdf')])
    expect(dialog.getByLabelText('Lesson title for 03_return-values.pdf')).toHaveValue(
      '03 return values',
    )
    fireEvent.change(dialog.getByLabelText('Lesson title for 03_return-values.pdf'), {
      target: { value: 'Return values' },
    })
    fireEvent.click(dialog.getByRole('button', { name: 'Upload 1 PDF' }))

    expect(await dialog.findByText('1 lesson added.')).toBeInTheDocument()
    expect(dialog.getByText('Added, notes written')).toBeInTheDocument()
    expect(api.createLessonRequest).toHaveBeenCalledWith(
      'B',
      expect.objectContaining({ title: 'Return values' }),
    )
    expect(api.uploadLessonMaterialRequest).toHaveBeenCalledWith(
      '55',
      expect.any(File),
      'Return values',
    )
    await waitFor(() => expect(api.adminCourseRequest).toHaveBeenCalledTimes(2))
  })

  it('says when a course guide became several lessons', async () => {
    api.createLessonRequest.mockResolvedValue({ ...OK, id: '58' })
    api.uploadLessonMaterialRequest.mockResolvedValue({
      success: true,
      message: 'Uploaded.',
      notesWritten: true,
      lessonsWritten: 16,
    })
    renderEditor()

    fireEvent.click(await screen.findByRole('button', { name: 'Upload PDFs' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Upload PDFs as lessons' }))
    choose([pdf('course_guide.pdf')])
    fireEvent.click(dialog.getByRole('button', { name: 'Upload 1 PDF' }))

    expect(await dialog.findByText('Added as 16 lessons')).toBeInTheDocument()
  })

  it('says when a PDF has no text to make notes from', async () => {
    api.createLessonRequest.mockResolvedValue({ ...OK, id: '57' })
    api.uploadLessonMaterialRequest.mockResolvedValue({
      success: true,
      message: 'Uploaded.',
      notesWritten: false,
      lessonsWritten: 0,
    })
    renderEditor()

    fireEvent.click(await screen.findByRole('button', { name: 'Upload PDFs' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Upload PDFs as lessons' }))
    choose([pdf('scan.pdf')])
    fireEvent.click(dialog.getByRole('button', { name: 'Upload 1 PDF' }))

    expect(await dialog.findByText('Added, file only')).toBeInTheDocument()
  })

  it('removes the lesson again when the server refuses its file', async () => {
    api.createLessonRequest.mockResolvedValue({ ...OK, id: '56' })
    api.uploadLessonMaterialRequest.mockResolvedValue({
      success: false,
      message: 'This file is too large.',
    })
    api.deleteLessonRequest.mockResolvedValue(OK)
    renderEditor()

    fireEvent.click(await screen.findByRole('button', { name: 'Upload PDFs' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Upload PDFs as lessons' }))
    expect(dialog.getByLabelText('Module')).toHaveValue('A')
    choose([pdf('big.pdf')])
    fireEvent.click(dialog.getByRole('button', { name: 'Upload 1 PDF' }))

    expect(await dialog.findByText('This file is too large.')).toBeInTheDocument()
    expect(api.deleteLessonRequest).toHaveBeenCalledWith('56')
  })

  it('leaves out files that are not PDFs', async () => {
    renderEditor()

    fireEvent.click(await screen.findByRole('button', { name: 'Upload PDFs' }))
    choose([pdf('notes.pdf'), new File(['x'], 'photo.png', { type: 'image/png' })])

    const dialog = within(screen.getByRole('dialog', { name: 'Upload PDFs as lessons' }))
    expect(dialog.getAllByRole('listitem')).toHaveLength(1)
    expect(dialog.getByRole('alert')).toHaveTextContent('Only PDF files')
  })
})

describe('AdminCourseEditorPage file preview', () => {
  const NOTES = {
    id: '61',
    title: 'Week 1 notes',
    filename: 'week-1.pdf',
    contentType: 'application/pdf',
    size: 2048,
    createdAt: '2026-10-29T00:00:00Z',
    downloadUrl: '/learning/materials/61/download/',
  }

  beforeEach(() => {
    URL.createObjectURL ??= () => ''
    URL.revokeObjectURL ??= () => {}
    api.adminCourseRequest.mockResolvedValue({
      ...COURSE,
      modules: [module('A', 'Basics', 1, { lessons: [lesson('11', 'Variables', 1, [NOTES])] })],
    })
    fileApi.fetchLessonFileUrl.mockResolvedValue('blob:notes')
    fileApi.downloadLessonFile.mockResolvedValue(undefined)
  })

  it("previews and downloads a lesson's PDF from the curriculum", async () => {
    renderEditor()

    fireEvent.click(await screen.findByRole('button', { name: 'Preview the file of Variables' }))

    const dialog = within(await screen.findByRole('dialog', { name: 'Week 1 notes' }))
    expect(await dialog.findByLabelText('Preview of Week 1 notes')).toHaveAttribute(
      'data',
      'blob:notes',
    )
    fireEvent.click(dialog.getByRole('button', { name: 'Close' }))
    fireEvent.click(screen.getByRole('button', { name: 'Download the file of Variables' }))
    expect(fileApi.downloadLessonFile).toHaveBeenCalledWith(NOTES)
  })

  it('previews a picked PDF before it is uploaded; Escape closes only the preview', async () => {
    renderEditor()

    fireEvent.click(await screen.findByRole('button', { name: 'Upload PDFs' }))
    fireEvent.change(screen.getByLabelText('Choose PDF files'), {
      target: { files: [new File(['%PDF-1.7'], 'syllabus.pdf', { type: 'application/pdf' })] },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Preview syllabus.pdf' }))

    expect(await screen.findByRole('dialog', { name: 'syllabus.pdf' })).toBeInTheDocument()
    expect(fileApi.fetchLessonFileUrl).not.toHaveBeenCalled()
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(screen.queryByRole('dialog', { name: 'syllabus.pdf' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Upload PDFs as lessons' })).toBeInTheDocument()
  })
})
