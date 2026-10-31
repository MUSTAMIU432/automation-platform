import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ChartIcon,
  CheckCircleIcon,
  ChecklistIcon,
  ChevronRightIcon,
  ClockIcon,
  CodeIcon,
  DocumentIcon,
  DownloadIcon,
  EyeIcon,
  TagIcon,
  TargetIcon,
} from '../../../components/AppIcons'
import {
  canOpenInTab,
  completeLessonRequest,
  downloadLessonFile,
  formatFileSize,
  lessonRequest,
  type Course,
  type Lesson,
  type LessonFile,
} from '../api/learningApi'
import { ContentBlocks } from '../components/ContentBlocks'
import { ExternalResourceCard } from '../components/ExternalResource'
import { FilePreviewDialog } from '../components/FilePreviewDialog'
import { Empty, ErrorNotice, Loading, Pill } from '../components/States'
import { DIFFICULTY_CLASSES, glassPanel, primaryButton, secondaryButton } from '../components/ui'
import { useCurrentCourse } from '../hooks/useCurrentCourse'
import { useLearningQuery } from '../hooks/useLearningQuery'
import { useLearnBase } from '../hooks/useLearnBase'

const roundButton =
  'grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white/85 text-slate-700 hover:border-brand-300 hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300'

const railHeading = 'flex items-center gap-2.5 font-semibold text-slate-900'

/** The tinted square an icon sits in, beside a rail heading or a file. */
function IconTile({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1 ${className}`}
    >
      {children}
    </span>
  )
}

/** A file's colour by what it is: a document reads red, slides amber, code blue. */
function fileTone(file: LessonFile): string {
  const type = file.contentType
  if (type === 'application/pdf') return 'bg-rose-50 text-rose-600 ring-rose-100'
  if (/presentation|powerpoint/.test(type)) return 'bg-amber-50 text-amber-600 ring-amber-100'
  if (/zip|python|text\/x-|json|javascript/.test(type)) return 'bg-sky-50 text-sky-600 ring-sky-100'
  if (type.startsWith('video/')) return 'bg-violet-50 text-violet-600 ring-violet-100'
  return 'bg-brand-50 text-brand-600 ring-brand-100'
}

/** Where this lesson sits in its course: its number in its module ("Lesson 2 of 3"). */
function placeInCourse(course: Course | null, lesson: Lesson) {
  const module = course?.modules.find((candidate) => candidate.id === lesson.moduleId)
  const index = module?.lessons.findIndex((candidate) => candidate.id === lesson.id) ?? -1
  return module && index >= 0 ? { at: index + 1, of: module.lessons.length } : null
}

function LessonFiles({ files }: { files: LessonFile[] }) {
  const [error, setError] = useState<string | null>(null)
  const [previewAt, setPreviewAt] = useState<number | null>(null)

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
      <h2 id="lesson-files" className={railHeading}>
        <IconTile className="bg-brand-50 text-brand-600 ring-brand-100">
          <DocumentIcon className="h-5 w-5" />
        </IconTile>
        Lesson resources
      </h2>
      <ul className="mt-4 space-y-2.5">
        {files.map((file, index) => (
          <li key={file.id} className="flex items-center gap-3">
            <IconTile className={fileTone(file)}>
              <DocumentIcon className="h-5 w-5" />
            </IconTile>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-900">
                {file.title}
              </span>
              <span className="block truncate text-xs text-slate-500" title={file.filename}>
                {file.filename} · {formatFileSize(file.size)}
              </span>
            </span>
            {canOpenInTab(file) && (
              <button
                type="button"
                onClick={() => setPreviewAt(index)}
                aria-label={`Preview ${file.title}`}
                title="Preview"
                className={roundButton}
              >
                <EyeIcon className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => void run(() => downloadLessonFile(file))}
              aria-label={`Download ${file.title}`}
              title="Download"
              className={roundButton}
            >
              <DownloadIcon className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {previewAt !== null && (
        <FilePreviewDialog
          files={files.map((file) => ({ saved: file }))}
          initial={previewAt}
          onClose={() => setPreviewAt(null)}
        />
      )}
    </section>
  )
}

/** The exercises and quiz that go with the lesson, under its "Practice" tab. */
function Practice({ data, base }: { data: Lesson; base: string }) {
  const item =
    'flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-3 text-sm ring-1 ring-slate-900/5 hover:bg-white hover:ring-brand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300'
  return (
    <ul className="space-y-2.5">
      {data.exercises.map((exercise) => (
        <li key={exercise.id}>
          <Link to={`${base}/exercises/${exercise.id}`} className={item}>
            <IconTile className="bg-sky-50 text-sky-600 ring-sky-100">
              <CodeIcon className="h-5 w-5" />
            </IconTile>
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-slate-900">{exercise.title}</span>
              <span className="block text-xs text-slate-500">
                Write and run code, then submit it
              </span>
            </span>
            <Pill className={DIFFICULTY_CLASSES[exercise.difficulty]}>
              {exercise.passed ? 'passed' : exercise.difficulty}
            </Pill>
          </Link>
        </li>
      ))}
      {data.quizId && (
        <li>
          <Link to={`${base}/quizzes/${data.quizId}`} className={item}>
            <IconTile className="bg-brand-50 text-brand-600 ring-brand-100">
              <ChecklistIcon className="h-5 w-5" />
            </IconTile>
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-slate-900">Module quiz</span>
              <span className="block text-xs text-slate-500">Check what the module covered</span>
            </span>
          </Link>
        </li>
      )}
    </ul>
  )
}

type Tab = 'lesson' | 'practice'

/** `/app/learn/courses/:courseSlug/lessons/:lessonId`: one lesson to read and complete. */
export function LessonPage() {
  const learnBase = useLearnBase()
  const { courseSlug = '', lessonId = '' } = useParams()
  const { course, reloadCourse } = useCurrentCourse()
  const lesson = useLearningQuery(
    `lesson:${lessonId}`,
    () => lessonRequest(lessonId),
    'We could not load this lesson.',
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Kept per lesson: moving to the next one opens it on its reading.
  const [tab, setTab] = useState<{ lessonId: string; tab: Tab }>({ lessonId, tab: 'lesson' })
  const activeTab = tab.lessonId === lessonId ? tab.tab : 'lesson'

  async function complete() {
    setBusy(true)
    setError(null)
    try {
      const result = await completeLessonRequest(lessonId)
      if (result.success) {
        // The outline and the progress across the top show it done as well.
        reloadCourse()
        lesson.reload()
      } else setError(result.message)
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
  const previousPath = data.previousLessonId ? `${base}/lessons/${data.previousLessonId}` : null
  const nextPath = data.nextLessonId ? `${base}/lessons/${data.nextLessonId}` : null
  const place = placeInCourse(course, data)
  const practiceCount = data.exercises.length + (data.quizId ? 1 : 0)
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'lesson', label: 'Lesson' },
    ...(practiceCount > 0
      ? [{ id: 'practice' as const, label: `Practice (${practiceCount})` }]
      : []),
  ]

  return (
    <div
      className={`grid gap-6 ${data.materials.length > 0 ? 'lg:grid-cols-[minmax(0,1fr)_19rem]' : ''}`}
    >
      <article className="min-w-0 space-y-6">
        <header className={`${glassPanel} p-6`}>
          <div className="flex items-start justify-between gap-4">
            <nav aria-label="Where this lesson is" className="min-w-0">
              <ol className="flex flex-wrap items-center gap-1 text-sm font-medium text-brand-700">
                <li>Module {data.modulePosition}</li>
                <li aria-hidden="true">
                  <ChevronRightIcon className="h-3.5 w-3.5 text-slate-400" />
                </li>
                <li>
                  <Link
                    to={base}
                    className="hover:underline focus:outline-none focus-visible:underline"
                  >
                    {data.moduleTitle}
                  </Link>
                </li>
                {place && (
                  <>
                    <li aria-hidden="true">
                      <ChevronRightIcon className="h-3.5 w-3.5 text-slate-400" />
                    </li>
                    <li className="text-slate-500">
                      Lesson {place.at} of {place.of}
                    </li>
                  </>
                )}
              </ol>
            </nav>
            <div className="flex shrink-0 gap-2">
              {previousPath ? (
                <Link
                  to={previousPath}
                  aria-label="Previous lesson"
                  title="Previous lesson"
                  className={roundButton}
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                </Link>
              ) : (
                <span aria-hidden="true" className={`${roundButton} opacity-40`}>
                  <ArrowLeftIcon className="h-4 w-4" />
                </span>
              )}
              {nextPath ? (
                <Link
                  to={nextPath}
                  aria-label="Next lesson"
                  title="Next lesson"
                  className={roundButton}
                >
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              ) : (
                <span aria-hidden="true" className={`${roundButton} opacity-40`}>
                  <ArrowRightIcon className="h-4 w-4" />
                </span>
              )}
            </div>
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{data.title}</h1>
          {data.summary && <p className="mt-2 text-slate-600">{data.summary}</p>}
          <ul className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-500">
            <li className="inline-flex items-center gap-1.5">
              <ClockIcon className="h-4 w-4" /> {data.estimatedMinutes} minutes
            </li>
            {course?.summary.levelLabel && (
              <li className="inline-flex items-center gap-1.5">
                <ChartIcon className="h-4 w-4" /> {course.summary.levelLabel}
              </li>
            )}
            <li className="inline-flex items-center gap-1.5">
              <TagIcon className="h-4 w-4" /> {practiceCount > 0 ? 'Reading + practice' : 'Reading'}
            </li>
            {data.completed && (
              <li className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                <CheckCircleIcon className="h-4 w-4" /> Completed
              </li>
            )}
          </ul>

          {tabs.length > 1 && (
            <div
              role="tablist"
              aria-label="Lesson"
              className="-mb-6 mt-5 flex gap-1 border-b border-slate-200"
            >
              {tabs.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  id={`lesson-tab-${id}`}
                  aria-selected={activeTab === id}
                  aria-controls={`lesson-panel-${id}`}
                  onClick={() => setTab({ lessonId, tab: id })}
                  className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${
                    activeTab === id
                      ? 'border-brand-600 text-brand-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </header>

        <div
          role={tabs.length > 1 ? 'tabpanel' : undefined}
          id={`lesson-panel-${activeTab}`}
          aria-labelledby={tabs.length > 1 ? `lesson-tab-${activeTab}` : undefined}
          className="space-y-6"
        >
          {activeTab === 'practice' ? (
            <div className={`${glassPanel} p-6`}>
              <Practice data={data} base={base} />
            </div>
          ) : (
            <>
              {data.objectives.length > 0 && (
                <section
                  aria-labelledby="lesson-objectives"
                  className="rounded-3xl border border-brand-100 bg-brand-50/60 p-5"
                >
                  <div className="flex items-start gap-3">
                    <IconTile className="bg-white text-brand-600 ring-brand-100">
                      <TargetIcon className="h-5 w-5" />
                    </IconTile>
                    <div>
                      <h2 id="lesson-objectives" className="font-semibold text-slate-900">
                        Learning objectives
                      </h2>
                      <p className="text-sm text-slate-600">
                        By the end of this lesson, you will be able to:
                      </p>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-2 text-sm text-brand-900">
                    {data.objectives.map((objective) => (
                      <li key={objective} className="flex gap-2.5">
                        <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                        {objective}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* External pages the authors added, in their order, before the notes. */}
              {(data.resources ?? []).map((resource) => (
                <ExternalResourceCard key={resource.id} resource={resource} />
              ))}

              {data.blocks.length > 0 && (
                <div className={`${glassPanel} p-6 sm:p-8`}>
                  <ContentBlocks blocks={data.blocks} reading />
                </div>
              )}
            </>
          )}
        </div>

        <div className={`${glassPanel} flex flex-wrap items-center justify-between gap-3 p-4`}>
          {previousPath ? (
            <Link to={previousPath} className={secondaryButton}>
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
                className={secondaryButton}
              >
                <CheckCircleIcon className="h-4 w-4" /> Mark as completed
              </button>
            )}
            {nextPath && (
              <Link to={nextPath} className={primaryButton}>
                Next <ArrowRightIcon className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
        {error && <ErrorNotice message={error} />}
      </article>

      {/* Beside the lesson only when there is something to put there: its files. */}
      {data.materials.length > 0 && (
        <aside className="space-y-4 lg:sticky lg:top-[calc(var(--app-chrome-height,0px)+1rem)] lg:self-start">
          <LessonFiles files={data.materials} />
        </aside>
      )}
    </div>
  )
}
