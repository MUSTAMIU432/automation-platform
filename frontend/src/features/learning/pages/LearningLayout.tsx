import { useContext } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

import { AdminCapabilitiesContext } from '../../administration/context/AdminCapabilitiesContext'
import { courseRequest } from '../api/learningApi'
import { CourseOutline } from '../components/CourseOutline'
import { useLearningQuery } from '../hooks/useLearningQuery'

/** A lesson, exercise or quiz page: the course's contents go beside it. */
const IN_A_COURSE = /^\/app\/learn\/courses\/([^/]+)\/(?:lessons|exercises|quizzes)\//

const tabClasses = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-4 py-1.5 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 motion-safe:transition-colors ${
    isActive
      ? 'bg-brand-600 text-white shadow-[0_8px_18px_-10px_rgba(20,99,73,0.8)]'
      : 'text-slate-600 hover:bg-white hover:text-brand-700'
  }`

/** The course's contents beside its lesson, exercise and quiz pages. */
function InCourse({ courseSlug, pathname }: { courseSlug: string; pathname: string }) {
  // Keyed by the page too, so what a page completes shows as done on the next one.
  const course = useLearningQuery(`outline:${courseSlug}:${pathname}`, () =>
    courseRequest(courseSlug),
  )
  const outline = course.data && (
    <CourseOutline course={course.data} pathname={pathname} onEnrolled={course.reload} />
  )

  return (
    <div className="grid gap-6 2xl:grid-cols-[17rem_minmax(0,1fr)]">
      {outline && (
        <>
          <aside className="hidden 2xl:sticky 2xl:top-[calc(var(--app-chrome-height,0px)+1rem)] 2xl:block 2xl:max-h-[calc(100dvh-var(--app-chrome-height,0px)-2rem)] 2xl:self-start 2xl:overflow-y-auto">
            {outline}
          </aside>
          {/* Narrower screens: the same contents, folded away above the page. */}
          <details className="2xl:hidden">
            <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-full border border-slate-200 bg-white/85 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-brand-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 [&::-webkit-details-marker]:hidden">
              Course contents ▾
            </summary>
            <div className="mt-3 max-w-md">{outline}</div>
          </details>
        </>
      )}
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  )
}

/**
 * Every learning page (`/app/learn/*`): the learning menu - your courses, the
 * catalog to enroll from and, for course managers, the authoring console - and,
 * inside a course, its modules and lessons.
 */
export function LearningLayout() {
  const { pathname } = useLocation()
  const canManage = useContext(AdminCapabilitiesContext)?.capabilities.canManageCourses ?? false
  const inCourse = IN_A_COURSE.exec(pathname)

  return (
    <div className="space-y-6">
      <nav aria-label="Learning" className="flex flex-wrap items-center gap-1">
        <NavLink to="/app/learn" end className={tabClasses}>
          My learning
        </NavLink>
        <NavLink to="/app/learn/courses" className={tabClasses}>
          Course catalog
        </NavLink>
        {canManage && (
          <NavLink to="/app/admin/courses" className={tabClasses}>
            Manage courses
          </NavLink>
        )}
      </nav>
      {inCourse ? (
        <InCourse courseSlug={decodeURIComponent(inCourse[1])} pathname={pathname} />
      ) : (
        <Outlet />
      )}
    </div>
  )
}
