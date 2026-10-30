import { useOutletContext } from 'react-router-dom'

import type { Course } from '../api/learningApi'

/** What `LearningLayout` hands a lesson, exercise or quiz page about its course. */
export interface CurrentCourse {
  /** The course, once loaded; null before then, and outside a course. */
  course: Course | null
  /** Asks for the course again - after a page completes something the outline shows. */
  reloadCourse: () => void
}

const NONE: CurrentCourse = { course: null, reloadCourse: () => {} }

/**
 * The course the current page sits in, from the outline beside it: one request
 * serves both, so the outline and the page never disagree about progress. A page
 * rendered on its own (outside `LearningLayout`) simply gets no course.
 */
export function useCurrentCourse(): CurrentCourse {
  return useOutletContext<CurrentCourse | undefined>() ?? NONE
}
