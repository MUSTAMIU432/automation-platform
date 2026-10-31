import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { adminCoursesRequest, createCourseRequest } from '../api/courseAuthoringApi'
import {
  AdminCard,
  AdminPageHeader,
  EmptyState,
  ErrorState,
  LoadingState,
  Notice,
  controlClasses,
  primaryButtonClasses,
} from '../components/AdminUi'
import { CourseCardMenu } from '../components/CourseCardMenu'
import { CourseStatusBadge } from '../components/CourseStatusBadge'
import { useAdminCapabilities } from '../context/useAdminCapabilities'
import { useAdminQuery } from '../hooks/useAdminQuery'

/**
 * `/app/admin/courses`: every course, whatever its status, for the people who
 * write them. A new course starts as a draft - learners see nothing until it is
 * published. Each card's ⋮ menu edits it, opens it as a learner, publishes,
 * returns to draft, archives or deletes it.
 */
export function AdminCoursesPage() {
  const { capabilities } = useAdminCapabilities()
  const navigate = useNavigate()
  const courses = useAdminQuery(
    'admin-courses',
    adminCoursesRequest,
    'We could not load the courses.',
  )
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // What the last ⋮ menu action came to (published, deleted, refused...).
  const [outcome, setOutcome] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  async function create(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const result = await createCourseRequest({
        title,
        subtitle: '',
        description: '',
        level: 'all_levels',
        estimatedHours: 0,
        audience: [],
        outcomes: [],
        capstoneBrief: '',
        capstoneRequirements: [],
        capstoneOptions: [],
      })
      if (result.success && result.id) navigate(`/app/admin/courses/${result.id}`)
      else setError(result.message)
    } catch {
      setError('We could not reach the server. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (!capabilities.canManageCourses) {
    return (
      <>
        <AdminPageHeader title="Courses" />
        <EmptyState
          title="Managing courses needs the course permission."
          description="A platform administrator can grant it."
        />
      </>
    )
  }

  return (
    <>
      <AdminPageHeader
        title="Courses"
        description="Write courses, lesson notes and files, exercises and quizzes. Learners see a course once it is published."
      />
      <div className="space-y-6">
        <AdminCard title="New course">
          <form onSubmit={(event) => void create(event)} className="flex flex-wrap items-end gap-2">
            <label className="text-sm font-semibold text-slate-700">
              Title
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className={`${controlClasses} mt-1 block w-80 max-w-full`}
                placeholder="e.g. Data Analysis with Python"
              />
            </label>
            <button type="submit" disabled={busy || !title.trim()} className={primaryButtonClasses}>
              Create course
            </button>
          </form>
          {error && (
            <div className="mt-3">
              <Notice tone="error">{error}</Notice>
            </div>
          )}
        </AdminCard>

        {outcome && <Notice tone={outcome.tone}>{outcome.text}</Notice>}
        {courses.error && <ErrorState message={courses.error} onRetry={courses.reload} />}
        {courses.loading && !courses.data && <LoadingState label="Loading courses…" />}
        {courses.data && courses.data.length === 0 && (
          <EmptyState title="No courses yet." description="Create the first one above." />
        )}
        {/* A draft is invisible in the catalog; say how many, so none is left there by accident. */}
        {courses.data && courses.data.some((course) => course.status === 'draft') && (
          <p className="rounded-xl bg-amber-50/80 px-4 py-2.5 text-sm text-amber-900 ring-1 ring-amber-200/70">
            {(() => {
              const drafts = courses.data.filter((course) => course.status === 'draft').length
              return drafts === 1
                ? '1 course is a draft: learners cannot see it until you open it and publish it.'
                : `${drafts} courses are drafts: learners cannot see them until you open each one and publish it.`
            })()}
          </p>
        )}
        {courses.data && courses.data.length > 0 && (
          <ul className="grid gap-4 md:grid-cols-2">
            {courses.data.map((course) => (
              <li key={course.id} className="relative">
                <Link
                  to={`/app/admin/courses/${course.id}`}
                  className="block h-full rounded-2xl border border-white/80 bg-white/70 p-5 pr-14 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_20px_45px_-32px_rgba(8,75,56,0.5)] ring-1 ring-slate-900/[0.04] backdrop-blur-xl hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-semibold text-slate-900">{course.title}</h2>
                    <CourseStatusBadge status={course.status} />
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    {course.levelLabel} · {course.moduleCount} modules · {course.lessonCount}{' '}
                    lessons · {course.enrollmentCount} learners
                  </p>
                  {course.status === 'draft' && (
                    <p className="mt-2 text-xs font-semibold text-amber-800">
                      Hidden from learners until published
                    </p>
                  )}
                  <p className="mt-1 text-xs text-slate-400">
                    Updated {new Date(course.updatedAt).toLocaleString()}
                  </p>
                </Link>
                {/* Beside the card's link, not inside it: a button cannot sit in a link. */}
                <div className="absolute top-3.5 right-3">
                  <CourseCardMenu
                    course={course}
                    onDone={(result) => {
                      setOutcome({
                        tone: result.success ? 'success' : 'error',
                        text: result.message,
                      })
                      if (result.success) courses.reload()
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
