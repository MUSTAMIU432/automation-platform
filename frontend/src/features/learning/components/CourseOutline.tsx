import { useState, type ComponentType, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import {
  CapIcon,
  CheckCircleIcon,
  ChecklistIcon,
  ChevronDownIcon,
  CodeIcon,
  DocumentIcon,
  PanelCollapseIcon,
  PanelExpandIcon,
  PlayIcon,
  SearchIcon,
} from '../../../components/AppIcons'
import { enrollRequest, type Course } from '../api/learningApi'
import { glassPanel, primaryButton } from './ui'
import { useLearnBase } from '../hooks/useLearnBase'

const DIFFICULTY_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' } as const

/**
 * One entry under a module: what kind it is (an icon, or a play mark on the page
 * being read), its name and length, and a circle that fills in once it is done.
 */
function OutlineItem({
  to,
  current,
  done,
  Icon,
  title,
  detail,
}: {
  to: string
  current: boolean
  done: boolean
  Icon: ComponentType<{ className?: string }>
  title: string
  detail: ReactNode
}) {
  return (
    <Link
      to={to}
      aria-current={current ? 'page' : undefined}
      className={`flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-[13.5px] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${
        current ? 'bg-brand-50 ring-1 ring-brand-100' : 'hover:bg-white'
      }`}
    >
      <span
        aria-hidden="true"
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-md ${
          current
            ? 'bg-linear-to-br from-brand-600 to-jade text-white'
            : 'bg-slate-100 text-slate-500'
        }`}
      >
        {current ? <PlayIcon className="h-3 w-3 fill-current" /> : <Icon className="h-3.5 w-3.5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block leading-5 ${current ? 'font-semibold text-brand-900' : 'font-medium text-slate-700'}`}
        >
          {title}
        </span>
        <span className="block text-xs leading-4 text-slate-500">{detail}</span>
      </span>
      {done ? (
        <>
          <CheckCircleIcon className="h-4 w-4 shrink-0 text-emerald-600" />
          <span className="sr-only">(done)</span>
        </>
      ) : (
        <span
          aria-hidden="true"
          className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 ${
            current ? 'border-brand-500' : 'border-slate-300'
          }`}
        />
      )}
    </Link>
  )
}

/**
 * A course's contents as a menu: every module with its lessons, exercises and
 * quiz, how long each takes, what is done, and where the learner is now - with a
 * search that narrows it to the entries whose name matches. A learner who has
 * not enrolled yet can do it here; the lessons open once they have.
 *
 * Given `onToggleCollapsed`, it can fold to a rail - the course's mark, its
 * progress and a number per module - so the lesson beside it has the room.
 */
export function CourseOutline({
  course,
  pathname,
  onEnrolled,
  collapsed = false,
  onToggleCollapsed,
}: {
  course: Course
  pathname: string
  onEnrolled: () => void
  collapsed?: boolean
  onToggleCollapsed?: () => void
}) {
  const learnBase = useLearnBase()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const base = `${learnBase}/courses/${course.summary.slug}`
  const isCurrent = (path: string) => pathname === path
  const term = query.trim().toLowerCase()
  const matches = (title: string) => !term || title.toLowerCase().includes(term)

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

  const moduleIsHere = (module: Course['modules'][number]) =>
    [
      ...module.lessons.map((lesson) => `${base}/lessons/${lesson.id}`),
      ...module.exercises.map((exercise) => `${base}/exercises/${exercise.id}`),
      module.quiz ? `${base}/quizzes/${module.quiz.id}` : null,
    ].some((path) => path !== null && isCurrent(path))
  const percent = Math.max(0, Math.min(100, Math.round(course.enrollment?.progress.percent ?? 0)))
  const modules = course.modules
    .map((module) => ({
      module,
      lessons: module.lessons.filter((lesson) => matches(lesson.title)),
      exercises: module.exercises.filter((exercise) => matches(exercise.title)),
      quiz: module.quiz && matches('Module quiz') ? module.quiz : null,
    }))
    .filter(
      ({ module, lessons, exercises, quiz }) =>
        !term || matches(module.title) || lessons.length + exercises.length > 0 || quiz,
    )

  const toggleButton = onToggleCollapsed && (
    <button
      type="button"
      onClick={onToggleCollapsed}
      aria-expanded={!collapsed}
      aria-label={collapsed ? 'Expand course contents' : 'Collapse course contents'}
      title={collapsed ? 'Expand course contents' : 'Collapse course contents'}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white/85 text-slate-600 hover:border-brand-300 hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
    >
      {collapsed ? (
        <PanelExpandIcon className="h-5 w-5" />
      ) : (
        <PanelCollapseIcon className="h-5 w-5" />
      )}
    </button>
  )

  if (collapsed) {
    return (
      <nav
        aria-label="Course contents"
        className={`${glassPanel} flex flex-col items-center gap-3 px-2 py-3`}
      >
        {toggleButton}
        <Link
          to={base}
          title={course.summary.title}
          aria-label={course.summary.title}
          className="grid h-10 w-10 place-items-center rounded-2xl bg-linear-to-br from-pine to-jade text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
        >
          <CapIcon className="h-5 w-5" />
        </Link>
        {course.enrollment && (
          <span className="text-[11px] font-semibold text-slate-600" title="Your progress">
            {percent}%
          </span>
        )}
        <ol className="flex flex-col items-center gap-1.5 border-t border-slate-200 pt-3">
          {course.modules.map((module) => {
            const first = module.lessons[0]
            const here = moduleIsHere(module)
            const number = (
              <span
                className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold ${
                  here
                    ? 'bg-linear-to-br from-brand-500 to-jade text-white'
                    : 'bg-brand-50 text-brand-700 ring-1 ring-brand-100 hover:bg-brand-100'
                }`}
              >
                {module.position}
              </span>
            )
            return (
              <li key={module.id}>
                {first ? (
                  <Link
                    to={`${base}/lessons/${first.id}`}
                    title={module.title}
                    aria-label={`Module ${module.position}: ${module.title}`}
                    aria-current={here ? 'true' : undefined}
                    className="block rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
                  >
                    {number}
                  </Link>
                ) : (
                  <span title={module.title}>{number}</span>
                )}
              </li>
            )
          })}
        </ol>
      </nav>
    )
  }

  return (
    <nav aria-label="Course contents" className={`${glassPanel} space-y-4 p-4`}>
      <div className="space-y-3 px-1">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-pine to-jade text-white shadow-[0_10px_20px_-12px_rgba(8,75,56,0.9)]"
          >
            <CapIcon className="h-5 w-5" />
          </span>
          <Link
            to={base}
            className="min-w-0 flex-1 self-center text-[15px] leading-5 font-semibold tracking-tight text-slate-900 hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
          >
            {course.summary.title}
          </Link>
          {toggleButton}
        </div>
        {!course.enrollment && !course.canManage && (
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
        )}
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            aria-label="Search lessons"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search lessons…"
            className="h-9 w-full rounded-xl border border-slate-200 bg-white/85 pr-3 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-200 focus:outline-none"
          />
        </div>
      </div>

      {modules.length === 0 && (
        <p className="px-2 text-sm text-slate-500">No lesson matches “{query.trim()}”.</p>
      )}
      <ol className="space-y-1">
        {modules.map(({ module, lessons, exercises, quiz }) => {
          const lessonPath = (id: string) => `${base}/lessons/${id}`
          const exercisePath = (id: string) => `${base}/exercises/${id}`
          const quizPath = module.quiz ? `${base}/quizzes/${module.quiz.id}` : null
          const here = moduleIsHere(module)
          const done = module.lessons.filter((lesson) => lesson.completed).length
          return (
            <li key={module.id}>
              <details open={here || Boolean(term)} className="group rounded-2xl">
                <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-white/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 [&::-webkit-details-marker]:hidden">
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                      here
                        ? 'bg-linear-to-br from-brand-500 to-jade text-white'
                        : 'bg-brand-50 text-brand-700 ring-1 ring-brand-100'
                    }`}
                  >
                    {module.position}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm leading-5 font-semibold tracking-tight text-slate-900">
                      {module.title}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {done} of {module.lessons.length} lessons
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-700 ring-1 ring-slate-200 group-hover:bg-brand-50 group-hover:text-brand-700 group-hover:ring-brand-200 group-open:bg-brand-50 group-open:text-brand-700 group-open:ring-brand-200 motion-safe:transition-colors"
                  >
                    <ChevronDownIcon className="h-4 w-4 stroke-[2.6] group-open:rotate-180 motion-safe:transition-transform" />
                  </span>
                </summary>
                <ul className="mt-1 mb-2 ml-[1.1rem] space-y-0.5 border-l border-slate-200 pl-1.5">
                  {lessons.map((lesson) => (
                    <li key={lesson.id}>
                      <OutlineItem
                        to={lessonPath(lesson.id)}
                        current={isCurrent(lessonPath(lesson.id))}
                        done={lesson.completed}
                        Icon={DocumentIcon}
                        title={lesson.title}
                        detail={`${lesson.estimatedMinutes} min`}
                      />
                    </li>
                  ))}
                  {exercises.map((exercise) => (
                    <li key={exercise.id}>
                      <OutlineItem
                        to={exercisePath(exercise.id)}
                        current={isCurrent(exercisePath(exercise.id))}
                        done={exercise.passed}
                        Icon={CodeIcon}
                        title={exercise.title}
                        detail={`${DIFFICULTY_LABEL[exercise.difficulty]} · exercise`}
                      />
                    </li>
                  ))}
                  {quiz && quizPath && (
                    <li>
                      <OutlineItem
                        to={quizPath}
                        current={isCurrent(quizPath)}
                        done={quiz.passed}
                        Icon={ChecklistIcon}
                        title="Module quiz"
                        detail={`${quiz.questionCount} ${quiz.questionCount === 1 ? 'question' : 'questions'}`}
                      />
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
