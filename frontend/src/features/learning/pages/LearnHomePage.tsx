import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { ArrowRightIcon, CapIcon, CheckCircleIcon, ClockIcon } from '../../../components/AppIcons'
import {
  coursesRequest,
  enrollRequest,
  myLearningRequest,
  type Activity,
  type CourseSummary,
} from '../api/learningApi'
import { Empty, ErrorNotice, Loading, ProgressBar } from '../components/States'
import { glassPanel, primaryButton, secondaryButton } from '../components/ui'
import { useLearningQuery } from '../hooks/useLearningQuery'
import { useLearnBase } from '../hooks/useLearnBase'

const ACTIVITY_LABELS: Record<Activity['kind'], string> = {
  lesson: 'Lesson',
  exercise: 'Exercise',
  quiz: 'Quiz',
}

function when(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/**
 * Published courses the learner has not joined, each with what is in it and a
 * button to enroll - registration right where a new learner lands.
 */
function AvailableCourses({ first }: { first: boolean }) {
  const learnBase = useLearnBase()
  const navigate = useNavigate()
  const catalog = useLearningQuery(
    'catalog',
    () => coursesRequest(),
    'We could not load the courses.',
  )
  const [enrolling, setEnrolling] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const open = (catalog.data ?? []).filter((course) => !course.enrolled)

  async function enroll(course: CourseSummary) {
    setEnrolling(course.id)
    setError(null)
    try {
      const result = await enrollRequest(course.id)
      if (result.success) navigate(`${learnBase}/courses/${course.slug}`)
      else setError(result.message)
    } catch {
      setError('We could not reach the server. Please try again.')
    } finally {
      setEnrolling(null)
    }
  }

  if (catalog.error) return <ErrorNotice message={catalog.error} onRetry={catalog.reload} />
  if (!catalog.data) return first ? <Loading label="Loading the courses…" /> : null
  if (open.length === 0) {
    return first ? (
      <Empty
        title="No course is open yet."
        description="Courses appear here as soon as they are published."
      />
    ) : null
  }

  return (
    <section aria-labelledby="available-courses" className="space-y-4">
      <div>
        <h2 id="available-courses" className="text-lg font-semibold text-slate-900">
          {first ? 'Start a course' : 'More courses'}
        </h2>
        <p className="text-sm text-slate-500">
          Free to join. Each course is a set of modules, with lessons, exercises and a quiz.
        </p>
      </div>
      {error && <ErrorNotice message={error} />}
      <div className="grid gap-4 md:grid-cols-2">
        {open.map((course) => (
          <article key={course.id} className={`${glassPanel} flex flex-col p-5`}>
            <div className="flex items-start gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                <CapIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-slate-900">{course.title}</h3>
                {course.subtitle && (
                  <p className="mt-0.5 text-sm text-slate-600">{course.subtitle}</p>
                )}
                <p className="mt-2 inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-slate-500">
                  <span>{course.levelLabel}</span>
                  <span>{course.moduleCount} modules</span>
                  <span>{course.lessonCount} lessons</span>
                  <span className="inline-flex items-center gap-1">
                    <ClockIcon className="h-3.5 w-3.5" /> {course.estimatedHours} h
                  </span>
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={enrolling !== null}
                onClick={() => void enroll(course)}
                className={primaryButton}
              >
                {enrolling === course.id ? 'Enrolling…' : 'Enroll for free'}
              </button>
              <Link to={`${learnBase}/courses/${course.slug}`} className={secondaryButton}>
                See modules and lessons
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

/**
 * `/app/learn`: the learner's dashboard - where to pick up, every course they are
 * taking with its progress, and what they did most recently.
 */
export function LearnHomePage() {
  const learnBase = useLearnBase()
  const mine = useLearningQuery('my-learning', myLearningRequest, 'We could not load your courses.')
  const courses = mine.data?.courses ?? []
  const current = courses.find((entry) => !entry.enrollment.progress.completedAt) ?? courses[0]

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-brand-700">Learning</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">My learning</h1>
          <p className="mt-2 max-w-2xl text-slate-600">
            Pick up where you left off, see how far you have come, and find a new course.
          </p>
        </div>
        <Link to={`${learnBase}/courses`} className={secondaryButton}>
          Browse courses
        </Link>
      </header>

      {mine.error && <ErrorNotice message={mine.error} onRetry={mine.reload} />}
      {mine.loading && !mine.data && <Loading label="Loading your courses…" />}

      {mine.data && courses.length === 0 && <AvailableCourses first />}

      {current && (
        <section
          aria-label="Continue learning"
          className="relative overflow-hidden rounded-3xl bg-linear-to-br from-forest via-pine to-brand-700 p-6 text-white shadow-[0_30px_60px_-36px_rgba(6,47,37,0.9)] sm:p-8"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-16 -right-10 h-56 w-56 rounded-full bg-mint/20 blur-3xl"
          />
          <p className="text-sm font-medium text-mint">Continue learning</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">{current.course.title}</h2>
          <p className="mt-1 max-w-2xl text-sm text-white/75">{current.course.subtitle}</p>
          <div className="mt-5 max-w-md text-white [&_div]:text-white/80">
            <ProgressBar percent={current.enrollment.progress.percent} label="Course progress" />
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            {current.enrollment.progress.nextLessonId ? (
              <Link
                to={`${learnBase}/courses/${current.course.slug}/lessons/${current.enrollment.progress.nextLessonId}`}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-forest hover:bg-mint/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-mint"
              >
                Next lesson <ArrowRightIcon className="h-4 w-4" />
              </Link>
            ) : null}
            <Link
              to={`${learnBase}/courses/${current.course.slug}`}
              className="inline-flex items-center gap-2 rounded-full border border-white/30 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-mint"
            >
              Course overview
            </Link>
          </div>
        </section>
      )}

      {courses.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <section aria-labelledby="my-courses" className="space-y-4">
            <h2 id="my-courses" className="text-lg font-semibold text-slate-900">
              My courses
            </h2>
            {courses.map(({ course, enrollment }) => {
              const progress = enrollment.progress
              return (
                <Link
                  key={course.id}
                  to={`${learnBase}/courses/${course.slug}`}
                  className={`${glassPanel} block p-5 hover:-translate-y-0.5 hover:shadow-[0_26px_50px_-34px_rgba(8,75,56,0.6)] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 motion-safe:transition`}
                >
                  <div className="flex items-start gap-4">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                      <CapIcon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-semibold text-slate-900">{course.title}</h3>
                        {progress.completedAt && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                            <CheckCircleIcon className="h-4 w-4" /> Completed
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-slate-500">
                        {progress.completedLessons} of {progress.totalLessons} lessons ·{' '}
                        {progress.passedQuizzes} of {progress.totalQuizzes} quizzes ·{' '}
                        {progress.passedExercises} of {progress.totalExercises} exercises
                      </p>
                      <div className="mt-3">
                        <ProgressBar percent={progress.percent} label="Progress" />
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </section>

          <section aria-labelledby="recent-activity" className={`${glassPanel} p-5`}>
            <h2 id="recent-activity" className="text-lg font-semibold text-slate-900">
              Recent activity
            </h2>
            {mine.data && mine.data.recentActivity.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                Your completed lessons, submissions and quiz results will appear here.
              </p>
            ) : (
              <ol className="mt-4 space-y-4">
                {mine.data?.recentActivity.map((item, index) => (
                  <li key={index} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-400 ring-4 ring-brand-50"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800">
                        {ACTIVITY_LABELS[item.kind]}: {item.title}
                      </p>
                      <p className="text-xs text-slate-500">
                        {item.detail} · {when(item.at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}

      {courses.length > 0 && <AvailableCourses first={false} />}
    </div>
  )
}
