import { useState } from 'react'
import { Link } from 'react-router-dom'

import {
  CheckCircleIcon,
  ChecklistIcon,
  CodeIcon,
  DocumentIcon,
} from '../../../components/AppIcons'
import { enrollRequest, type Course } from '../api/learningApi'
import { ProgressBar } from './States'
import { glassPanel, primaryButton } from './ui'

const itemClasses = (current: boolean) =>
  `flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${
    current
      ? 'bg-brand-50 font-semibold text-brand-800 ring-1 ring-brand-100'
      : 'text-slate-700 hover:bg-white'
  }`

function Done({ done }: { done: boolean }) {
  return done ? (
    <>
      <CheckCircleIcon className="h-4 w-4 shrink-0 text-emerald-600" />
      <span className="sr-only">(done)</span>
    </>
  ) : null
}

/**
 * A course's contents as a menu: every module with its lessons, exercises and
 * quiz, what is done, and where the learner is now. A learner who has not
 * enrolled yet can do it here; the lessons open once they have.
 */
export function CourseOutline({
  course,
  pathname,
  onEnrolled,
}: {
  course: Course
  pathname: string
  onEnrolled: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const base = `/app/learn/courses/${course.summary.slug}`
  const isCurrent = (path: string) => pathname === path

  async function enroll() {
    setBusy(true)
    setError(null)
    try {
      const result = await enrollRequest(course.summary.id)
      if (result.success) onEnrolled()
      else setError(result.message)
    } catch {
      setError('We could not reach the server. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <nav aria-label="Course contents" className={`${glassPanel} space-y-4 p-4`}>
      <div className="space-y-3 px-1">
        <Link
          to={base}
          className="block font-semibold text-slate-900 hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
        >
          {course.summary.title}
        </Link>
        {course.enrollment ? (
          <ProgressBar percent={course.enrollment.progress.percent} label="Your progress" />
        ) : (
          !course.canManage && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">Enroll to open the lessons. It is free.</p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void enroll()}
                className={`${primaryButton} w-full`}
              >
                Enroll for free
              </button>
              {error && <p className="text-xs text-rose-700">{error}</p>}
            </div>
          )
        )}
      </div>

      <ol className="space-y-1">
        {course.modules.map((module) => {
          const lessonPaths = module.lessons.map((lesson) => `${base}/lessons/${lesson.id}`)
          const exercisePaths = module.exercises.map(
            (exercise) => `${base}/exercises/${exercise.id}`,
          )
          const quizPath = module.quiz ? `${base}/quizzes/${module.quiz.id}` : null
          const here = [...lessonPaths, ...exercisePaths, quizPath].some(
            (path) => path !== null && isCurrent(path),
          )
          const done = module.lessons.filter((lesson) => lesson.completed).length
          return (
            <li key={module.id}>
              <details open={here} className="group rounded-2xl">
                <summary className="flex cursor-pointer list-none items-start gap-2 rounded-xl px-2.5 py-2 hover:bg-white/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 [&::-webkit-details-marker]:hidden">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-brand-50 text-[11px] font-bold text-brand-700 ring-1 ring-brand-100">
                    {module.position}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-800">
                      {module.title}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {done} of {module.lessons.length} lessons
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="text-xs text-slate-400 group-open:rotate-180 motion-safe:transition-transform"
                  >
                    ▾
                  </span>
                </summary>
                <ul className="mt-1 mb-2 ml-4 space-y-0.5 border-l border-slate-200 pl-2">
                  {module.lessons.map((lesson, index) => (
                    <li key={lesson.id}>
                      <Link
                        to={lessonPaths[index]}
                        aria-current={isCurrent(lessonPaths[index]) ? 'page' : undefined}
                        className={itemClasses(isCurrent(lessonPaths[index]))}
                      >
                        <DocumentIcon className="h-4 w-4 shrink-0 text-slate-400" />
                        <span className="min-w-0 flex-1">{lesson.title}</span>
                        <Done done={lesson.completed} />
                      </Link>
                    </li>
                  ))}
                  {module.exercises.map((exercise, index) => (
                    <li key={exercise.id}>
                      <Link
                        to={exercisePaths[index]}
                        aria-current={isCurrent(exercisePaths[index]) ? 'page' : undefined}
                        className={itemClasses(isCurrent(exercisePaths[index]))}
                      >
                        <CodeIcon className="h-4 w-4 shrink-0 text-brand-600" />
                        <span className="min-w-0 flex-1">{exercise.title}</span>
                        <Done done={exercise.passed} />
                      </Link>
                    </li>
                  ))}
                  {module.quiz && quizPath && (
                    <li>
                      <Link
                        to={quizPath}
                        aria-current={isCurrent(quizPath) ? 'page' : undefined}
                        className={itemClasses(isCurrent(quizPath))}
                      >
                        <ChecklistIcon className="h-4 w-4 shrink-0 text-brand-600" />
                        <span className="min-w-0 flex-1">Module quiz</span>
                        <Done done={module.quiz.passed} />
                      </Link>
                    </li>
                  )}
                </ul>
              </details>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
