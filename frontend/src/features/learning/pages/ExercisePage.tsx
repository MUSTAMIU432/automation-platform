import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { CheckCircleIcon, LockIcon } from '../../../components/AppIcons'
import {
  exerciseRequest,
  runCodeRequest,
  submitExerciseRequest,
  type Exercise,
  type RunResult,
  type Submission,
} from '../api/learningApi'
import { CodeEditor } from '../components/CodeEditor'
import { CodeBlock, ContentBlocks } from '../components/ContentBlocks'
import { Empty, ErrorNotice, Loading, Pill } from '../components/States'
import {
  DIFFICULTY_CLASSES,
  fieldClasses,
  glassPanel,
  primaryButton,
  secondaryButton,
} from '../components/ui'
import { useLearningQuery } from '../hooks/useLearningQuery'
import { useLearnBase } from '../hooks/useLearnBase'

/** A draft is a per-browser convenience; the server keeps only graded submissions. */
function draftKey(exerciseId: string) {
  return `learning:draft:${exerciseId}`
}

function readDraft(exerciseId: string): string | null {
  try {
    return window.localStorage.getItem(draftKey(exerciseId))
  } catch {
    return null
  }
}

function saveDraft(exerciseId: string, code: string) {
  try {
    window.localStorage.setItem(draftKey(exerciseId), code)
  } catch {
    // Storage can be unavailable (private windows); the editor still works.
  }
}

function SubmissionResults({ submission }: { submission: Submission }) {
  const passed = submission.status === 'passed'
  return (
    <section aria-label="Test results" className="space-y-3">
      <p
        className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${passed ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}
      >
        {passed && <CheckCircleIcon className="h-5 w-5" />}
        {passed
          ? 'Every test passed - well done!'
          : `${submission.passedCount} of ${submission.totalCount} tests passed.`}
      </p>
      <ul className="space-y-2">
        {submission.results.map((result, index) => (
          <li
            key={index}
            className={`rounded-2xl border px-4 py-3 text-sm ${result.passed ? 'border-emerald-200 bg-emerald-50/60' : 'border-rose-200 bg-rose-50/60'}`}
          >
            <p className="flex items-center gap-2 font-medium text-slate-900">
              <span aria-hidden="true">{result.passed ? '✓' : '✗'}</span>
              {result.hidden && <LockIcon className="h-3.5 w-3.5 text-slate-500" />}
              {result.name}
              <span className="sr-only">{result.passed ? 'passed' : 'failed'}</span>
            </p>
            {!result.hidden && !result.passed && (
              <div className="mt-2 grid gap-2 font-mono text-xs sm:grid-cols-2">
                {result.call && (
                  <p className="sm:col-span-2">
                    <span className="font-sans font-semibold text-slate-600">Ran: </span>
                    {result.call}
                  </p>
                )}
                <div>
                  <p className="font-sans font-semibold text-slate-600">Expected</p>
                  <pre className="mt-1 overflow-x-auto rounded-lg bg-white/80 p-2 whitespace-pre-wrap">
                    {result.expected || '(nothing)'}
                  </pre>
                </div>
                <div>
                  <p className="font-sans font-semibold text-slate-600">Your output</p>
                  <pre className="mt-1 overflow-x-auto rounded-lg bg-white/80 p-2 whitespace-pre-wrap">
                    {result.actual || '(nothing)'}
                  </pre>
                </div>
                {result.error && <p className="text-rose-700 sm:col-span-2">{result.error}</p>}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

function Workspace({ exercise, onGraded }: { exercise: Exercise; onGraded: () => void }) {
  const [code, setCode] = useState(() => readDraft(exercise.id) ?? exercise.starterCode)
  const [stdin, setStdin] = useState('')
  const [busy, setBusy] = useState<'run' | 'submit' | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [output, setOutput] = useState<RunResult | null>(null)
  const [graded, setGraded] = useState<Submission | null>(null)

  useEffect(() => saveDraft(exercise.id, code), [exercise.id, code])

  async function run() {
    setBusy('run')
    setMessage(null)
    try {
      const result = await runCodeRequest(exercise.id, code, stdin)
      setOutput(result.result)
      if (!result.success) setMessage({ ok: false, text: result.message })
    } catch {
      setMessage({ ok: false, text: 'We could not reach the server. Please try again.' })
    } finally {
      setBusy(null)
    }
  }

  async function submit() {
    setBusy('submit')
    setMessage(null)
    try {
      const result = await submitExerciseRequest(exercise.id, code)
      if (result.success && result.submission) {
        setGraded(result.submission)
        onGraded()
      } else {
        setMessage({ ok: false, text: result.message })
      }
    } catch {
      setMessage({ ok: false, text: 'We could not reach the server. Please try again.' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      {!exercise.executionAvailable && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-900">
          Running and grading code is not switched on for this platform yet. You can still write
          your answer here - it is saved in this browser - and submit it once it is.
        </p>
      )}
      <CodeEditor value={code} onChange={setCode} label={`Code for ${exercise.title}`} />
      <details className="rounded-2xl bg-white/60 px-4 py-2 ring-1 ring-slate-900/5">
        <summary className="cursor-pointer text-sm font-medium text-slate-600">
          Input for Run (optional)
        </summary>
        <textarea
          rows={3}
          value={stdin}
          onChange={(event) => setStdin(event.target.value)}
          aria-label="Input for Run"
          placeholder="Lines your program reads with input()"
          className={`${fieldClasses} mt-2 mb-2 font-mono`}
        />
      </details>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void run()}
          disabled={busy !== null || !exercise.executionAvailable}
          className={secondaryButton}
        >
          {busy === 'run' ? 'Running…' : 'Run'}
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy !== null || !exercise.executionAvailable}
          className={primaryButton}
        >
          {busy === 'submit' ? 'Checking…' : 'Submit for grading'}
        </button>
        <button
          type="button"
          onClick={() => setCode(exercise.starterCode)}
          className="text-sm font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
        >
          Reset to starter code
        </button>
      </div>
      {message && (
        <p
          role="alert"
          className={`rounded-xl px-3 py-2 text-sm ${message.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}
        >
          {message.text}
        </p>
      )}
      {output && (
        <section aria-label="Console output" className="overflow-hidden rounded-2xl bg-[#0d2a22]">
          <p className="border-b border-white/10 px-4 py-2 text-xs font-medium tracking-wide text-white/60 uppercase">
            Console {output.killed ? '· stopped' : `· exit code ${output.exitCode ?? '?'}`}
          </p>
          <pre className="max-h-72 overflow-auto px-4 py-3 font-mono text-[13px] whitespace-pre-wrap text-[#e6f4ee]">
            {output.stdout || (output.stderr ? '' : '(no output)')}
            {output.stderr && <span className="text-rose-300">{output.stderr}</span>}
            {output.killed && (
              <span className="text-amber-300">
                {'\n'}Stopped: the program took too long or used too much memory.
              </span>
            )}
          </pre>
        </section>
      )}
      {graded && <SubmissionResults submission={graded} />}
      {exercise.submissions.length > 0 && (
        <details className={`${glassPanel} p-4`}>
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">
            Previous attempts ({exercise.submissions.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {exercise.submissions.map((submission) => (
              <li
                key={submission.id}
                className="flex flex-wrap items-center gap-3 rounded-xl bg-white/70 px-3 py-2 text-sm"
              >
                <span
                  className={submission.status === 'passed' ? 'text-emerald-700' : 'text-amber-800'}
                >
                  {submission.passedCount}/{submission.totalCount} tests
                </span>
                <span className="flex-1 text-xs text-slate-500">
                  {new Date(submission.createdAt).toLocaleString()}
                </span>
                <button
                  type="button"
                  onClick={() => setCode(submission.code)}
                  className="rounded-full px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50"
                >
                  Load this code
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

/** `/app/learn/courses/:courseSlug/exercises/:exerciseId`: the coding workspace. */
export function ExercisePage() {
  const learnBase = useLearnBase()
  const { courseSlug = '', exerciseId = '' } = useParams()
  const exercise = useLearningQuery(
    `exercise:${exerciseId}`,
    () => exerciseRequest(exerciseId),
    'We could not load this exercise.',
  )

  if (exercise.error) return <ErrorNotice message={exercise.error} onRetry={exercise.reload} />
  if (exercise.loading && !exercise.data) return <Loading label="Loading the exercise…" />
  if (!exercise.data) {
    return (
      <Empty
        title="This exercise is not available."
        description="Enroll in the course to practise its exercises."
        action={
          <Link to={`${learnBase}/courses/${courseSlug}`} className={secondaryButton}>
            Go to the course
          </Link>
        }
      />
    )
  }

  const data = exercise.data
  return (
    // The instructions take the larger share: they are read in full, while the
    // editor only needs room for a line of code.
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <section className="space-y-5">
        <header className={`${glassPanel} p-6`}>
          <p className="text-sm font-medium text-brand-700">{data.moduleTitle}</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{data.title}</h1>
            <Pill className={DIFFICULTY_CLASSES[data.difficulty]}>{data.difficulty}</Pill>
            {data.passed && (
              <Pill className="bg-emerald-50 text-emerald-700 ring-emerald-200">Passed</Pill>
            )}
          </div>
          {data.lessonId && (
            <p className="mt-2 text-sm text-slate-500">
              Practises{' '}
              <Link
                to={`${learnBase}/courses/${data.courseSlug}/lessons/${data.lessonId}`}
                className="font-medium text-brand-700 underline decoration-brand-200 underline-offset-2"
              >
                {data.lessonTitle}
              </Link>
            </p>
          )}
        </header>
        <div className={`${glassPanel} p-6`}>
          <ContentBlocks blocks={data.instructions} />
        </div>
        {data.visibleTests.length > 0 && (
          <div className={`${glassPanel} space-y-3 p-6`}>
            <h2 className="font-semibold text-slate-900">Examples</h2>
            {data.visibleTests.map((test) => (
              <div key={test.id} className="space-y-2">
                <p className="text-sm font-medium text-slate-700">{test.name}</p>
                {test.stdin && <CodeBlock code={test.stdin} language="text" label="Input" />}
                {test.call && <CodeBlock code={test.call} label="Then runs" />}
                <CodeBlock code={test.expectedOutput} language="text" label="Expected output" />
              </div>
            ))}
            {data.hiddenTestCount > 0 && (
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <LockIcon className="h-4 w-4" />
                Plus {data.hiddenTestCount} hidden {data.hiddenTestCount === 1 ? 'test' : 'tests'}{' '}
                checked when you submit.
              </p>
            )}
          </div>
        )}
        {data.hintCount > 0 && (
          <details className={`${glassPanel} p-5`}>
            <summary className="cursor-pointer font-semibold text-slate-900">
              Hints ({data.hints.length} of {data.hintCount} unlocked)
            </summary>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700">
              {data.hints.map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
            </ol>
            {data.hints.length < data.hintCount && (
              <p className="mt-3 text-xs text-slate-500">
                Each submission that does not pass unlocks the next hint.
              </p>
            )}
          </details>
        )}
      </section>
      <section aria-label="Coding workspace">
        <Workspace key={data.id} exercise={data} onGraded={exercise.reload} />
      </section>
    </div>
  )
}
