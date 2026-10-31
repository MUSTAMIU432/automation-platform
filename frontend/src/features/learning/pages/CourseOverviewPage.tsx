import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'

import {
  ArrowRightIcon,
  CheckCircleIcon,
  ChecklistIcon,
  ClockIcon,
  CodeIcon,
  DocumentIcon,
  GlobeIcon,
} from '../../../components/AppIcons'
import {
  completeCourseRequest,
  courseRequest,
  enrollRequest,
  submitCapstoneRequest,
  type Course,
  type CourseModule,
  type Outcome,
} from '../api/learningApi'
import { Empty, ErrorNotice, Loading, Pill, ProgressBar } from '../components/States'
import {
  DIFFICULTY_CLASSES,
  fieldClasses,
  glassPanel,
  primaryButton,
  secondaryButton,
} from '../components/ui'
import { useLearningQuery } from '../hooks/useLearningQuery'
import { useLearnBase } from '../hooks/useLearnBase'

function Notice({ outcome }: { outcome: Outcome | null }) {
  if (!outcome) return null
  return (
    <p
      role={outcome.success ? 'status' : 'alert'}
      className={`rounded-xl px-3 py-2 text-sm ${outcome.success ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}
    >
      {outcome.message}
    </p>
  )
}

function ModuleCard({
  module,
  slug,
  enrolled,
}: {
  module: CourseModule
  slug: string
  enrolled: boolean
}) {
  const learnBase = useLearnBase()
  const done = module.lessons.filter((lesson) => lesson.completed).length
  const base = `${learnBase}/courses/${slug}`
  return (
    <details className={`${glassPanel} group p-0 [&_summary::-webkit-details-marker]:hidden`}>
      <summary className="flex cursor-pointer list-none items-start gap-4 rounded-3xl p-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand-50 text-sm font-bold text-brand-700 ring-1 ring-brand-100">
          {module.position}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-slate-900">{module.title}</span>
          <span className="mt-0.5 block text-sm text-slate-500">{module.summary}</span>
          {enrolled && (
            <span className="mt-1 block text-xs font-medium text-brand-700">
              {done} of {module.lessons.length} lessons completed
              {module.quiz?.passed ? ' · quiz passed' : ''}
            </span>
          )}
        </span>
        <span
          aria-hidden="true"
          className="mt-2 text-slate-400 group-open:rotate-180 motion-safe:transition-transform"
        >
          ▾
        </span>
      </summary>
      <div className="space-y-4 border-t border-slate-900/5 px-5 pt-4 pb-5">
        {module.objectives.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              You will learn to
            </h3>
            <ul className="mt-2 grid gap-1.5 text-sm text-slate-700 sm:grid-cols-2">
              {module.objectives.map((objective) => (
                <li key={objective} className="flex gap-2">
                  <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                  {objective}
                </li>
              ))}
            </ul>
          </div>
        )}
        <ol className="divide-y divide-slate-900/5 overflow-hidden rounded-2xl bg-white/60 ring-1 ring-slate-900/5">
          {module.lessons.map((lesson) => (
            <li key={lesson.id}>
              {enrolled ? (
                <Link
                  to={`${base}/lessons/${lesson.id}`}
                  className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-white focus:outline-none focus-visible:bg-white"
                >
                  <DocumentIcon className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="flex-1 text-slate-800">{lesson.title}</span>
                  <span className="text-xs text-slate-400">{lesson.estimatedMinutes} min</span>
                  {lesson.completed && (
                    <span className="inline-flex text-emerald-600">
                      <CheckCircleIcon className="h-4 w-4" />
                      <span className="sr-only">Completed</span>
                    </span>
                  )}
                </Link>
              ) : (
                <span className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700">
                  <DocumentIcon className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="flex-1">{lesson.title}</span>
                  <span className="text-xs text-slate-400">{lesson.estimatedMinutes} min</span>
                </span>
              )}
              {/* Its external pages, under it: read inside the lesson, after its objectives. */}
              {(lesson.resources ?? []).map((resource) =>
                enrolled ? (
                  <Link
                    key={resource.id}
                    to={`${base}/lessons/${lesson.id}#resource-${resource.id}`}
                    className="flex items-center gap-3 py-2.5 pr-4 pl-11 text-sm hover:bg-white focus:outline-none focus-visible:bg-white"
                  >
                    <GlobeIcon className="h-4 w-4 shrink-0 text-brand-600" />
                    <span className="flex-1 text-slate-700">{resource.title}</span>
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700 ring-1 ring-brand-100">
                      External resource
                    </span>
                  </Link>
                ) : (
                  <span
                    key={resource.id}
                    className="flex items-center gap-3 py-2.5 pr-4 pl-11 text-sm text-slate-600"
                  >
                    <GlobeIcon className="h-4 w-4 shrink-0 text-brand-600" />
                    <span className="flex-1">{resource.title}</span>
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700 ring-1 ring-brand-100">
                      External resource
                    </span>
                  </span>
                ),
              )}
            </li>
          ))}
          {module.exercises.map((exercise) => (
            <li key={exercise.id}>
              {enrolled ? (
                <Link
                  to={`${base}/exercises/${exercise.id}`}
                  className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-white focus:outline-none focus-visible:bg-white"
                >
                  <CodeIcon className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="flex-1 text-slate-800">Exercise: {exercise.title}</span>
                  <Pill className={DIFFICULTY_CLASSES[exercise.difficulty]}>
                    {exercise.difficulty}
                  </Pill>
                  {exercise.passed && (
                    <span className="inline-flex text-emerald-600">
                      <CheckCircleIcon className="h-4 w-4" />
                      <span className="sr-only">Passed</span>
                    </span>
                  )}
                </Link>
              ) : (
                <span className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700">
                  <CodeIcon className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="flex-1">Exercise: {exercise.title}</span>
                </span>
              )}
            </li>
          ))}
          {module.quiz && (
            <li>
              {enrolled ? (
                <Link
                  to={`${base}/quizzes/${module.quiz.id}`}
                  className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-white focus:outline-none focus-visible:bg-white"
                >
                  <ChecklistIcon className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="flex-1 text-slate-800">Quiz: {module.quiz.title}</span>
                  {module.quiz.bestPercentage !== null && (
                    <span className="text-xs text-slate-500">
                      Best {module.quiz.bestPercentage}%
                    </span>
                  )}
                  {module.quiz.passed && (
                    <span className="inline-flex text-emerald-600">
                      <CheckCircleIcon className="h-4 w-4" />
                      <span className="sr-only">Passed</span>
                    </span>
                  )}
                </Link>
              ) : (
                <span className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700">
                  <ChecklistIcon className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="flex-1">Quiz: {module.quiz.title}</span>
                </span>
              )}
            </li>
          )}
        </ol>
        {module.project && (
          <p className="rounded-2xl bg-brand-50/70 px-4 py-3 text-sm text-brand-900">
            <span className="font-semibold">Practical project: </span>
            {module.project}
          </p>
        )}
      </div>
    </details>
  )
}

function CapstoneSection({ course, onSaved }: { course: Course; onSaved: () => void }) {
  const existing = course.capstone.submission
  const [form, setForm] = useState({
    option: existing?.option ?? course.capstone.options[0]?.key ?? '',
    repositoryUrl: existing?.repositoryUrl ?? '',
    documentationUrl: existing?.documentationUrl ?? '',
    howToRun: existing?.howToRun ?? '',
    designDecisions: existing?.designDecisions ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const result = await submitCapstoneRequest({ courseId: course.summary.id, ...form })
      setOutcome(result)
      if (result.success) onSaved()
    } catch {
      setOutcome({ success: false, message: 'We could not reach the server.', field: null })
    } finally {
      setBusy(false)
    }
  }

  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }))

  return (
    <section aria-labelledby="capstone" className={`${glassPanel} space-y-5 p-6`}>
      <div>
        <h2 id="capstone" className="text-xl font-bold tracking-tight text-slate-900">
          Final project
        </h2>
        <p className="mt-2 text-sm text-slate-600">{course.capstone.brief}</p>
      </div>
      {course.capstone.requirements.length > 0 && (
        <ul className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
          {course.capstone.requirements.map((requirement) => (
            <li key={requirement} className="flex gap-2">
              <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
              {requirement}
            </li>
          ))}
        </ul>
      )}
      {course.enrollment && (
        <form
          onSubmit={(event) => void submit(event)}
          className="space-y-4"
          aria-label="Final project"
        >
          <fieldset>
            <legend className="text-sm font-semibold text-slate-700">Choose your project</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {course.capstone.options.map((option) => (
                <label
                  key={option.key}
                  className="grid cursor-pointer grid-cols-[auto_1fr] gap-x-3 rounded-2xl border border-slate-200 bg-white/75 p-3 text-sm font-semibold text-slate-900 has-checked:border-brand-400 has-checked:bg-brand-50/80 has-checked:ring-1 has-checked:ring-brand-200"
                >
                  <input
                    type="radio"
                    name="option"
                    value={option.key}
                    checked={form.option === option.key}
                    onChange={set('option')}
                    className="row-span-2 mt-1 accent-brand-600"
                  />
                  {option.title}
                  <span className="col-start-2 font-normal text-slate-500">{option.summary}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Repository link (source code and tests)
              <input
                type="url"
                required
                value={form.repositoryUrl}
                onChange={set('repositoryUrl')}
                placeholder="https://github.com/you/project"
                className={`${fieldClasses} mt-1`}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Documentation link (optional)
              <input
                type="url"
                value={form.documentationUrl}
                onChange={set('documentationUrl')}
                placeholder="https://…"
                className={`${fieldClasses} mt-1`}
              />
            </label>
          </div>
          <label className="block text-sm font-medium text-slate-700">
            How to install, run and test it
            <textarea
              rows={4}
              required
              value={form.howToRun}
              onChange={set('howToRun')}
              className={`${fieldClasses} mt-1`}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Your design decisions, trade-offs and what you would do next
            <textarea
              rows={5}
              required
              value={form.designDecisions}
              onChange={set('designDecisions')}
              className={`${fieldClasses} mt-1`}
            />
          </label>
          <Notice outcome={outcome} />
          <button type="submit" disabled={busy} className={primaryButton}>
            {existing ? 'Update final project' : 'Submit final project'}
          </button>
        </form>
      )}
    </section>
  )
}

/** `/app/learn/courses/:courseSlug`: what the course teaches, its curriculum and your progress. */
export function CourseOverviewPage() {
  const learnBase = useLearnBase()
  const { courseSlug = '' } = useParams()
  const course = useLearningQuery(
    `course:${courseSlug}`,
    () => courseRequest(courseSlug),
    'We could not load this course.',
  )
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  async function act(action: () => Promise<Outcome>) {
    setBusy(true)
    setOutcome(null)
    try {
      const result = await action()
      setOutcome(result)
      if (result.success) course.reload()
    } catch {
      setOutcome({ success: false, message: 'We could not reach the server.', field: null })
    } finally {
      setBusy(false)
    }
  }

  if (course.error) return <ErrorNotice message={course.error} onRetry={course.reload} />
  if (course.loading && !course.data) return <Loading label="Loading the course…" />
  if (!course.data) {
    return (
      <Empty
        title="This course is not available."
        description="It may have been unpublished, or the link may be wrong."
        action={
          <Link to={`${learnBase}/courses`} className={secondaryButton}>
            Browse courses
          </Link>
        }
      />
    )
  }

  const data = course.data
  const progress = data.enrollment?.progress
  const nextLesson = progress?.nextLessonId ?? data.modules[0]?.lessons[0]?.id

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-forest via-pine to-brand-700 p-6 text-white shadow-[0_30px_60px_-36px_rgba(6,47,37,0.9)] sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 -right-16 h-72 w-72 rounded-full bg-mint/20 blur-3xl"
        />
        <p className="text-sm font-medium text-mint">{data.summary.levelLabel}</p>
        <h1 className="mt-1 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
          {data.summary.title}
        </h1>
        <p className="mt-3 max-w-3xl text-white/80">{data.summary.subtitle}</p>
        <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/80">
          <div className="flex items-center gap-1.5">
            <ClockIcon className="h-4 w-4" />
            <dt className="sr-only">Duration</dt>
            <dd>{data.summary.estimatedHours} hours</dd>
          </div>
          <div>
            <dt className="sr-only">Modules</dt>
            <dd>{data.summary.moduleCount} modules</dd>
          </div>
          <div>
            <dt className="sr-only">Lessons</dt>
            <dd>{data.summary.lessonCount} lessons</dd>
          </div>
        </dl>
        {progress && (
          <div className="mt-6 max-w-md [&_div]:text-white/80">
            <ProgressBar percent={progress.percent} label="Your progress" />
          </div>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          {data.enrollment ? (
            nextLesson && (
              <Link
                to={`${learnBase}/courses/${courseSlug}/lessons/${nextLesson}`}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-forest hover:bg-mint/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-mint"
              >
                {progress?.completedLessons ? 'Continue learning' : 'Start the first lesson'}
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            )
          ) : (
            <button
              type="button"
              disabled={busy || data.summary.status !== 'published'}
              onClick={() => void act(() => enrollRequest(data.summary.id))}
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-forest hover:bg-mint/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-mint disabled:opacity-60"
            >
              Enroll for free
            </button>
          )}
        </div>
      </section>

      <Notice outcome={outcome} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {data.summary.description && (
            <section className={`${glassPanel} p-6`}>
              <h2 className="text-lg font-semibold text-slate-900">About this course</h2>
              <p className="mt-2 leading-7 text-slate-600">{data.summary.description}</p>
            </section>
          )}
          <section aria-labelledby="curriculum" className="space-y-3">
            <h2 id="curriculum" className="text-lg font-semibold text-slate-900">
              Curriculum
            </h2>
            {data.modules.map((module) => (
              <ModuleCard
                key={module.id}
                module={module}
                slug={courseSlug}
                enrolled={data.enrollment !== null}
              />
            ))}
          </section>
        </div>

        <aside className="space-y-6">
          {data.outcomes.length > 0 && (
            <section className={`${glassPanel} p-5`}>
              <h2 className="font-semibold text-slate-900">What you will be able to do</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {data.outcomes.map((item) => (
                  <li key={item} className="flex gap-2">
                    <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {data.audience.length > 0 && (
            <section className={`${glassPanel} p-5`}>
              <h2 className="font-semibold text-slate-900">Who it is for</h2>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {data.audience.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          )}
          {progress && (
            <section className={`${glassPanel} space-y-3 p-5`} aria-labelledby="completion">
              <h2 id="completion" className="font-semibold text-slate-900">
                Completion
              </h2>
              {progress.completedAt ? (
                <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">
                  <p className="font-semibold">Course completed</p>
                  <p className="mt-1">
                    {new Date(progress.completedAt).toLocaleDateString()} · certificate{' '}
                    <code className="text-xs">{progress.certificateCode}</code>
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-slate-600">
                    Complete every lesson, pass every module quiz and submit the final project.
                  </p>
                  {progress.completionGaps.length > 0 && (
                    <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
                      {progress.completionGaps.map((gap) => (
                        <li key={gap}>{gap}</li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    disabled={busy || progress.completionGaps.length > 0}
                    onClick={() => void act(() => completeCourseRequest(data.summary.id))}
                    className={primaryButton}
                  >
                    Complete the course
                  </button>
                </>
              )}
            </section>
          )}
        </aside>
      </div>

      <CapstoneSection course={data} onSaved={course.reload} />
    </div>
  )
}
