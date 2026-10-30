import { useContext, useEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

import { useCollapsed } from '../../../components/useCollapsed'
import { AdminCapabilitiesContext } from '../../administration/context/AdminCapabilitiesContext'
import { courseRequest } from '../api/learningApi'
import { CourseOutline } from '../components/CourseOutline'
import { useLearningQuery } from '../hooks/useLearningQuery'
import type { CurrentCourse } from '../hooks/useCurrentCourse'
import { useLearnBase } from '../hooks/useLearnBase'
import type { Course } from '../api/learningApi'

/** A lesson, exercise or quiz page: the course's contents go beside it. */
const IN_A_COURSE = /^\/app\/(?:admin\/)?learn\/courses\/([^/]+)\/(?:lessons|exercises|quizzes)\//

const tabClasses = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-4 py-1.5 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 motion-safe:transition-colors ${
    isActive
      ? 'bg-brand-600 text-white shadow-[0_8px_18px_-10px_rgba(20,99,73,0.8)]'
      : 'text-slate-600 hover:bg-white hover:text-brand-700'
  }`

/**
 * How far through the course the learner is, across the top of every page in it -
 * where the learning menu sits elsewhere (inside a course, the app's own menu
 * already offers My learning and the catalog).
 */
function CourseProgress({ course }: { course: Course }) {
  if (!course.enrollment) return null
  const { percent, completedLessons, totalLessons } = course.enrollment.progress
  const value = Math.max(0, Math.min(100, Math.round(percent)))
  return (
    <section
      aria-label="Course progress"
      className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-white/80 bg-white/70 px-5 py-3 shadow-[0_12px_30px_-24px_rgba(8,75,56,0.5)] ring-1 ring-slate-900/[0.04] backdrop-blur-xl"
    >
      <span className="text-sm font-semibold text-slate-900">Your progress</span>
      <progress value={value} max={100} aria-label="Your progress" className="sr-only">
        {value}%
      </progress>
      <div
        aria-hidden="true"
        className="h-2.5 min-w-[8rem] flex-1 overflow-hidden rounded-full bg-slate-200/80"
      >
        <div
          className="h-full rounded-full bg-linear-to-r from-brand-500 to-mint motion-safe:transition-[width] motion-safe:duration-500"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-sm font-semibold text-brand-700">{value}% complete</span>
      <span className="text-sm text-slate-500">
        {completedLessons} of {totalLessons} lessons
      </span>
    </section>
  )
}

/** The course's contents beside its lesson, exercise and quiz pages. */
function InCourse({ courseSlug, pathname }: { courseSlug: string; pathname: string }) {
  // Keyed by the page too, so what a page completes shows as done on the next one.
  const course = useLearningQuery(`outline:${courseSlug}:${pathname}`, () =>
    courseRequest(courseSlug),
  )
  // Folded to a rail of module numbers to give the lesson the room; remembered on this device.
  const [expanded, toggleExpanded] = useCollapsed('learn.outline', true)
  const current: CurrentCourse = { course: course.data, reloadCourse: course.reload }
  const asideRef = useRef<HTMLElement>(null)

  // The contents scroll without a scrollbar, so bring the page being read into
  // view: a lesson deep in the course would otherwise sit below the fold. Only the
  // contents scroll - not the window - and only when the entry is out of sight.
  useEffect(() => {
    const aside = asideRef.current
    const link = aside?.querySelector('[aria-current="page"]')
    if (!aside || !link) return
    const box = aside.getBoundingClientRect()
    const entry = link.getBoundingClientRect()
    if (entry.top < box.top || entry.bottom > box.bottom) {
      aside.scrollTop += entry.top - box.top - (box.height - entry.height) / 2
    }
    // Re-run when the contents are drawn anew (loaded, or unfolded): the current
    // entry is found in the DOM, not read from these values.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [course.data, expanded])
  const outline = course.data && (
    <CourseOutline course={course.data} pathname={pathname} onEnrolled={course.reload} />
  )

  return (
    <div className="space-y-6">
      {course.data && <CourseProgress course={course.data} />}
      <div
        className={`grid gap-6 motion-safe:transition-[grid-template-columns] motion-safe:duration-300 ${
          expanded ? '2xl:grid-cols-[20rem_minmax(0,1fr)]' : '2xl:grid-cols-[4rem_minmax(0,1fr)]'
        }`}
      >
        {outline && course.data && (
          <>
            {/* Scrolls by wheel, trackpad or touch, with no scrollbar beside the contents. */}
            <aside
              ref={asideRef}
              className="hidden [scrollbar-width:none] 2xl:sticky 2xl:top-[calc(var(--app-chrome-height,0px)+1rem)] 2xl:block 2xl:max-h-[calc(100dvh-var(--app-chrome-height,0px)-2rem)] 2xl:self-start 2xl:overflow-y-auto [&::-webkit-scrollbar]:hidden"
            >
              <CourseOutline
                course={course.data}
                pathname={pathname}
                onEnrolled={course.reload}
                collapsed={!expanded}
                onToggleCollapsed={toggleExpanded}
              />
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
          <Outlet context={current} />
        </div>
      </div>
    </div>
  )
}

/**
 * Every learning page (`/app/learn/*`, and `/app/admin/learn/*` inside the console):
 * the learning menu - your courses, the catalog to enroll from and, for course
 * managers, the authoring console - or, inside a course, the course's progress
 * in its place, and its modules and lessons beside the page.
 */
export function LearningLayout() {
  const learnBase = useLearnBase()
  const { pathname } = useLocation()
  const canManage = useContext(AdminCapabilitiesContext)?.capabilities.canManageCourses ?? false
  const inCourse = IN_A_COURSE.exec(pathname)

  return (
    <div className="space-y-6">
      {!inCourse && (
        <nav aria-label="Learning" className="flex flex-wrap items-center gap-1">
          <NavLink to={learnBase} end className={tabClasses}>
            My learning
          </NavLink>
          <NavLink to={`${learnBase}/courses`} className={tabClasses}>
            Course catalog
          </NavLink>
          {canManage && (
            <NavLink to="/app/admin/courses" className={tabClasses}>
              Manage courses
            </NavLink>
          )}
        </nav>
      )}
      {inCourse ? (
        <InCourse courseSlug={decodeURIComponent(inCourse[1])} pathname={pathname} />
      ) : (
        <Outlet />
      )}
    </div>
  )
}
