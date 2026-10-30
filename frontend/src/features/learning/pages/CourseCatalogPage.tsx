import { useState } from 'react'
import { Link } from 'react-router-dom'

import { CapIcon, ClockIcon, SearchIcon } from '../../../components/AppIcons'
import { coursesRequest } from '../api/learningApi'
import { Empty, ErrorNotice, Loading, Pill } from '../components/States'
import { fieldClasses, glassPanel } from '../components/ui'
import { useLearningQuery } from '../hooks/useLearningQuery'
import { useLearnBase } from '../hooks/useLearnBase'

const LEVELS = [
  { value: '', label: 'All levels' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'all_levels', label: 'Beginner to advanced' },
]

/** `/app/learn/courses`: every published course, searchable and filterable by level. */
export function CourseCatalogPage() {
  const learnBase = useLearnBase()
  const [search, setSearch] = useState('')
  const [level, setLevel] = useState('')
  const term = search.trim()
  const courses = useLearningQuery(
    `courses:${term}:${level}`,
    () => coursesRequest(term, level),
    'We could not load the courses.',
  )

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-brand-700">Learning</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Courses</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Structured lessons, hands-on coding exercises, quizzes and projects.
        </p>
      </header>

      <div className={`${glassPanel} flex flex-col gap-3 p-4 sm:flex-row sm:items-end`}>
        <label className="flex-1 text-sm font-medium text-slate-600">
          Search
          <span className="relative mt-1 block">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Python, APIs, testing…"
              className={`${fieldClasses} pl-9`}
            />
          </span>
        </label>
        <label className="text-sm font-medium text-slate-600 sm:w-56">
          Level
          <select
            value={level}
            onChange={(event) => setLevel(event.target.value)}
            className={`${fieldClasses} mt-1`}
          >
            {LEVELS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {courses.error && <ErrorNotice message={courses.error} onRetry={courses.reload} />}
      {courses.loading && !courses.data && <Loading label="Loading courses…" />}
      {courses.data && courses.data.length === 0 && (
        <Empty
          title={term || level ? 'No course matches.' : 'No courses are published yet.'}
          description={term || level ? 'Try another search or level.' : undefined}
        />
      )}

      {courses.data && courses.data.length > 0 && (
        <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {courses.data.map((course) => (
            <li key={course.id}>
              <Link
                to={`${learnBase}/courses/${course.slug}`}
                className={`${glassPanel} flex h-full flex-col p-5 hover:-translate-y-0.5 hover:shadow-[0_26px_50px_-34px_rgba(8,75,56,0.6)] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 motion-safe:transition`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-linear-to-br from-brand-50 to-mint/30 text-brand-700 ring-1 ring-brand-100">
                    <CapIcon className="h-5 w-5" />
                  </span>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {/* Only a course manager is shown these; learners see published courses. */}
                    {course.status !== 'published' && (
                      <Pill className="bg-amber-50 text-amber-800 ring-amber-200">
                        {course.status === 'draft' ? 'Draft · hidden from learners' : 'Archived'}
                      </Pill>
                    )}
                    {course.enrolled && (
                      <Pill className="bg-emerald-50 text-emerald-700 ring-emerald-200">
                        Enrolled
                      </Pill>
                    )}
                  </div>
                </div>
                <h2 className="mt-4 text-lg font-semibold tracking-tight text-slate-900">
                  {course.title}
                </h2>
                <p className="mt-1 line-clamp-3 flex-1 text-sm text-slate-600">{course.subtitle}</p>
                <dl className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <div>
                    <dt className="sr-only">Level</dt>
                    <dd className="font-medium text-brand-700">{course.levelLabel}</dd>
                  </div>
                  <div className="flex items-center gap-1">
                    <dt className="sr-only">Duration</dt>
                    <ClockIcon className="h-3.5 w-3.5" />
                    <dd>{course.estimatedHours} hours</dd>
                  </div>
                  <div>
                    <dt className="sr-only">Size</dt>
                    <dd>
                      {course.moduleCount} modules · {course.lessonCount} lessons
                    </dd>
                  </div>
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
