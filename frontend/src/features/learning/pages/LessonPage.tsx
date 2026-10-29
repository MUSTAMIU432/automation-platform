import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ChecklistIcon,
  ClockIcon,
  CodeIcon,
  DocumentIcon,
} from '../../../components/AppIcons'
import {
  canOpenInTab,
  completeLessonRequest,
  downloadLessonFile,
  formatFileSize,
  lessonRequest,
  openLessonFile,
  type LessonFile,
} from '../api/learningApi'
import { ContentBlocks } from '../components/ContentBlocks'
import { Empty, ErrorNotice, Loading, Pill } from '../components/States'
import { DIFFICULTY_CLASSES, glassPanel, primaryButton, secondaryButton } from '../components/ui'
import { useLearningQuery } from '../hooks/useLearningQuery'
import { useLearnBase } from '../hooks/useLearnBase'

function LessonFiles({ files }: { files: LessonFile[] }) {
  const [error, setError] = useState<string | null>(null)

  async function run(action: () => Promise<void>) {
    setError(null)
    try {
      await action()
    } catch {
      setError('That file could not be downloaded. Please try again.')
    }
  }

  return (
    <section aria-labelledby="lesson-files" className={`${glassPanel} p-5`}>
      <h2 id="lesson-files" className="font-semibold text-slate-900">
        Lesson files
      </h2>
      <ul className="mt-3 space-y-2">
        {files.map((file) => (
          <li
            key={file.id}
            className="flex flex-wrap items-center gap-3 rounded-2xl bg-white/70 px-3.5 py-2.5 ring-1 ring-slate-900/5"
          >
            <DocumentIcon className="h-5 w-5 shrink-0 text-brand-600" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-900">
                {file.title}
              </span>
              <span className="block truncate text-xs text-slate-500">
                {file.filename} · {formatFileSize(file.size)}
              </span>
            </span>
            {canOpenInTab(file) && (
              <button
                type="button"
                onClick={() => void run(() => openLessonFile(file))}
                className="rounded-full px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
              >
                Open
              </button>
            )}
            <button
              type="button"
              onClick={() => void run(() => downloadLessonFile(file))}
              className="rounded-full px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
            >
              Download
            </button>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  )
}

/** `/app/learn/courses/:courseSlug/lessons/:lessonId`: one lesson to read and complete. */
export function LessonPage() {
  const learnBase = useLearnBase()
  const { courseSlug = '', lessonId = '' } = useParams()
  const lesson = useLearningQuery(
    `lesson:${lessonId}`,
    () => lessonRequest(lessonId),
    'We could not load this lesson.',
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function complete() {
    setBusy(true)
    setError(null)
    try {
      const result = await completeLessonRequest(lessonId)
      if (result.success) lesson.reload()
      else setError(result.message)
    } catch {
      setError('We could not reach the server. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (lesson.error) return <ErrorNotice message={lesson.error} onRetry={lesson.reload} />
  if (lesson.loading && !lesson.data) return <Loading label="Loading the lesson…" />
  if (!lesson.data) {
    return (
      <Empty
        title="This lesson is not available."
        description="Enroll in the course to read its lessons."
        action={
          <Link to={`${learnBase}/courses/${courseSlug}`} className={secondaryButton}>
            Go to the course
          </Link>
        }
      />
    )
  }

  const data = lesson.data
  const base = `${learnBase}/courses/${data.courseSlug}`

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <article className="min-w-0 space-y-6">
        <header className={`${glassPanel} p-6`}>
          <p className="text-sm font-medium text-brand-700">
            Module {data.modulePosition} · {data.moduleTitle}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{data.title}</h1>
          {data.summary && <p className="mt-2 text-slate-600">{data.summary}</p>}
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-slate-500">
            <ClockIcon className="h-4 w-4" /> {data.estimatedMinutes} minutes
            {data.completed && (
              <span className="ml-3 inline-flex items-center gap-1 font-semibold text-emerald-700">
                <CheckCircleIcon className="h-4 w-4" /> Completed
              </span>
            )}
          </p>
          {data.objectives.length > 0 && (
            <div className="mt-5 rounded-2xl bg-brand-50/70 p-4 ring-1 ring-brand-100">
              <h2 className="text-xs font-semibold tracking-wide text-brand-800 uppercase">
                In this lesson you will
              </h2>
              <ul className="mt-2 space-y-1 text-sm text-brand-900">
                {data.objectives.map((objective) => (
                  <li key={objective} className="flex gap-2">
                    <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                    {objective}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </header>

        <div className={`${glassPanel} p-6 sm:p-8`}>
          <ContentBlocks blocks={data.blocks} />
        </div>

        {data.materials.length > 0 && <LessonFiles files={data.materials} />}

        <div className={`${glassPanel} flex flex-wrap items-center justify-between gap-3 p-4`}>
          {data.previousLessonId ? (
            <Link to={`${base}/lessons/${data.previousLessonId}`} className={secondaryButton}>
              <ArrowLeftIcon className="h-4 w-4" /> Previous
            </Link>
          ) : (
            <span />
          )}
          <div className="flex flex-wrap items-center gap-3">
            {!data.completed && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void complete()}
                className={primaryButton}
              >
                <CheckCircleIcon className="h-4 w-4" /> Mark as completed
              </button>
            )}
            {data.nextLessonId && (
              <Link to={`${base}/lessons/${data.nextLessonId}`} className={secondaryButton}>
                Next <ArrowRightIcon className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
        {error && <ErrorNotice message={error} />}
      </article>

      <aside className="space-y-4 lg:sticky lg:top-[calc(var(--app-chrome-height,0px)+1rem)] lg:self-start">
        <div className={`${glassPanel} p-5`}>
          <h2 className="font-semibold text-slate-900">Practise</h2>
          {data.exercises.length === 0 && !data.quizId && (
            <p className="mt-2 text-sm text-slate-500">No exercise goes with this lesson.</p>
          )}
          <ul className="mt-3 space-y-2">
            {data.exercises.map((exercise) => (
              <li key={exercise.id}>
                <Link
                  to={`${base}/exercises/${exercise.id}`}
                  className="flex items-center gap-2.5 rounded-2xl bg-white/70 px-3 py-2.5 text-sm ring-1 ring-slate-900/5 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
                >
                  <CodeIcon className="h-4 w-4 shrink-0 text-brand-600" />
                  <span className="flex-1 text-slate-800">{exercise.title}</span>
                  <Pill className={DIFFICULTY_CLASSES[exercise.difficulty]}>
                    {exercise.passed ? 'passed' : exercise.difficulty}
                  </Pill>
                </Link>
              </li>
            ))}
            {data.quizId && (
              <li>
                <Link
                  to={`${base}/quizzes/${data.quizId}`}
                  className="flex items-center gap-2.5 rounded-2xl bg-white/70 px-3 py-2.5 text-sm ring-1 ring-slate-900/5 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
                >
                  <ChecklistIcon className="h-4 w-4 shrink-0 text-brand-600" />
                  <span className="flex-1 text-slate-800">Module quiz</span>
                </Link>
              </li>
            )}
          </ul>
        </div>
        <Link to={base} className={`${secondaryButton} w-full`}>
          Course overview
        </Link>
      </aside>
    </div>
  )
}
