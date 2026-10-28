import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderAdminPage } from '../../../test/renderAdmin'
import type { AdminCourse, AdminModule } from '../api/courseAuthoringApi'
import { AdminCourseEditorPage } from './AdminCourseEditorPage'

vi.mock('../api/courseAuthoringApi')
const api = vi.mocked(await import('../api/courseAuthoringApi'))

const OK = { success: true, message: 'Reordered.', field: null, id: null }

const lesson = (id: string, title: string, position: number) => ({
  id,
  title,
  position,
  estimatedMinutes: 10,
  materialCount: 0,
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
