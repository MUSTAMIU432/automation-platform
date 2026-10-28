import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { CodeEditor } from '../../learning/components/CodeEditor'
import {
  adminCourseRequest,
  adminExerciseRequest,
  saveExerciseRequest,
  type AdminExercise,
  type AdminTest,
} from '../api/courseAuthoringApi'
import {
  AdminCard,
  AdminPageHeader,
  EmptyState,
  ErrorState,
  LoadingState,
  Notice,
  controlClasses,
  primaryButtonClasses,
  secondaryButtonClasses,
} from '../components/AdminUi'
import { BackLink } from '../components/BackLink'
import { useAdminQuery } from '../hooks/useAdminQuery'

const BLANK: Omit<AdminExercise, 'id' | 'courseId' | 'moduleId' | 'moduleTitle'> = {
  title: '',
  difficulty: 'easy',
  lessonId: null,
  instructions: '',
  starterCode: '',
  solutionCode: '',
  hints: [],
  tests: [
    { name: 'Example', stdin: '', call: '', expectedOutput: '', hidden: false },
    { name: 'Hidden check', stdin: '', call: '', expectedOutput: '', hidden: true },
  ],
}

function TestRow({
  test,
  index,
  onChange,
  onRemove,
}: {
  test: AdminTest
  index: number
  onChange: (test: AdminTest) => void
  onRemove: () => void
}) {
  const set = (key: keyof AdminTest) => (event: { target: { value: string } }) =>
    onChange({ ...test, [key]: event.target.value })
  return (
    <fieldset className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <legend className="px-1 text-sm font-semibold text-slate-700">Test {index + 1}</legend>
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-56 flex-1 text-sm font-semibold text-slate-700">
          Name
          <input
            value={test.name}
            onChange={set('name')}
            className={`${controlClasses} mt-1 w-full`}
          />
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={test.hidden}
            onChange={(event) => onChange({ ...test, hidden: event.target.checked })}
            className="accent-brand-600"
          />
          Hidden from learners
        </label>
        <button type="button" className={secondaryButtonClasses} onClick={onRemove}>
          Remove
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-sm font-semibold text-slate-700">
          Input (stdin)
          <textarea
            rows={3}
            value={test.stdin}
            onChange={set('stdin')}
            className={`${controlClasses} mt-1 w-full font-mono text-xs`}
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Code run after theirs
          <textarea
            rows={3}
            value={test.call}
            onChange={set('call')}
            placeholder="print(add(2, 3))"
            className={`${controlClasses} mt-1 w-full font-mono text-xs`}
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Expected output
          <textarea
            rows={3}
            value={test.expectedOutput}
            onChange={set('expectedOutput')}
            className={`${controlClasses} mt-1 w-full font-mono text-xs`}
          />
        </label>
      </div>
    </fieldset>
  )
}

function ExerciseForm({
  initial,
  courseId,
  moduleId,
  exerciseId,
  lessons,
  onSaved,
}: {
  initial: typeof BLANK
  courseId: string
  moduleId: string
  exerciseId?: string
  lessons: Array<{ id: string; title: string }>
  onSaved: (id: string) => void
}) {
  const [form, setForm] = useState(initial)
  const [hints, setHints] = useState(initial.hints.join('\n'))
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setResult(null)
    try {
      const outcome = await saveExerciseRequest(
        moduleId,
        {
          ...form,
          hints: hints
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean),
        },
        exerciseId,
      )
      setResult({ tone: outcome.success ? 'success' : 'error', text: outcome.message })
      if (outcome.success && outcome.id) onSaved(outcome.id)
    } catch {
      setResult({ tone: 'error', text: 'We could not reach the server. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  function setTest(index: number, test: AdminTest) {
    setForm((current) => ({
      ...current,
      tests: current.tests.map((t, i) => (i === index ? test : t)),
    }))
  }

  return (
    <form onSubmit={(event) => void save(event)} className="space-y-6" aria-label="Exercise">
      <AdminCard title="Exercise">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-sm font-semibold text-slate-700 md:col-span-1">
              Title
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className={`${controlClasses} mt-1 w-full`}
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Difficulty
              <select
                value={form.difficulty}
                onChange={(e) =>
                  setForm({ ...form, difficulty: e.target.value as AdminExercise['difficulty'] })
                }
                className={`${controlClasses} mt-1 w-full`}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Practises lesson
              <select
                value={form.lessonId ?? ''}
                onChange={(e) => setForm({ ...form, lessonId: e.target.value || null })}
                className={`${controlClasses} mt-1 w-full`}
              >
                <option value="">None</option>
                {lessons.map((lesson) => (
                  <option key={lesson.id} value={lesson.id}>
                    {lesson.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-sm font-semibold text-slate-700">
            Instructions (same formatting as lesson notes)
            <textarea
              rows={8}
              value={form.instructions}
              onChange={(e) => setForm({ ...form, instructions: e.target.value })}
              className={`${controlClasses} mt-1 w-full font-mono text-[13px]`}
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Hints (one per line; the first is always shown, each failed submission unlocks the next)
            <textarea
              rows={3}
              value={hints}
              onChange={(e) => setHints(e.target.value)}
              className={`${controlClasses} mt-1 w-full`}
            />
          </label>
        </div>
      </AdminCard>
      <div className="grid gap-6 xl:grid-cols-2">
        <AdminCard title="Starter code (what learners start with)">
          <CodeEditor
            value={form.starterCode}
            onChange={(code) => setForm((c) => ({ ...c, starterCode: code }))}
            label="Starter code"
            minHeight="14rem"
          />
        </AdminCard>
        <AdminCard title="Reference solution (never shown to learners)">
          <CodeEditor
            value={form.solutionCode}
            onChange={(code) => setForm((c) => ({ ...c, solutionCode: code }))}
            label="Reference solution"
            minHeight="14rem"
          />
        </AdminCard>
      </div>
      <AdminCard title="Tests">
        <p className="mb-4 text-sm text-slate-600">
          Each test runs the learner&apos;s code, then the code below it, with the input given. Only
          output printed after their code counts. Give at least one visible example and one hidden
          test - hidden inputs and expected outputs never reach learners.
        </p>
        <div className="space-y-3">
          {form.tests.map((test, index) => (
            <TestRow
              key={index}
              test={test}
              index={index}
              onChange={(next) => setTest(index, next)}
              onRemove={() =>
                setForm((c) => ({ ...c, tests: c.tests.filter((_, i) => i !== index) }))
              }
            />
          ))}
        </div>
        <button
          type="button"
          className={`${secondaryButtonClasses} mt-3`}
          onClick={() =>
            setForm((c) => ({
              ...c,
              tests: [
                ...c.tests,
                {
                  name: `Test ${c.tests.length + 1}`,
                  stdin: '',
                  call: '',
                  expectedOutput: '',
                  hidden: true,
                },
              ],
            }))
          }
        >
          Add test
        </button>
      </AdminCard>
      {result && <Notice tone={result.tone}>{result.text}</Notice>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={primaryButtonClasses}>
          Save exercise
        </button>
        <BackLink to={`/app/admin/courses/${courseId}`}>Back to the course</BackLink>
      </div>
    </form>
  )
}

/**
 * `/app/admin/courses/:courseId/modules/:moduleId/exercises/:exerciseId` - or `new`
 * to write one.
 */
export function AdminExerciseEditorPage() {
  const { courseId = '', moduleId = '', exerciseId = '' } = useParams()
  const navigate = useNavigate()
  const isNew = exerciseId === 'new'
  const course = useAdminQuery(
    `admin-course:${courseId}`,
    () => adminCourseRequest(courseId),
    'We could not load the course.',
  )
  const exercise = useAdminQuery(
    `admin-exercise:${exerciseId}`,
    () => (isNew ? Promise.resolve(null) : adminExerciseRequest(exerciseId)),
    'We could not load this exercise.',
  )

  const error = course.error ?? exercise.error
  if (error)
    return (
      <ErrorState
        message={error}
        onRetry={() => {
          course.reload()
          exercise.reload()
        }}
      />
    )
  if (!course.data || (!isNew && exercise.loading && !exercise.data)) {
    return course.loading || exercise.loading ? (
      <LoadingState label="Loading…" />
    ) : (
      <EmptyState title="This exercise does not exist." />
    )
  }
  const module = course.data.modules.find((m) => m.id === moduleId)
  if (!module || (!isNew && !exercise.data))
    return <EmptyState title="This exercise does not exist." />

  return (
    <>
      <AdminPageHeader
        back={<BackLink to={`/app/admin/courses/${courseId}`}>{course.data.title}</BackLink>}
        title={isNew ? 'New exercise' : (exercise.data?.title ?? '')}
        description={`Module: ${module.title}`}
      />
      <ExerciseForm
        key={exerciseId}
        initial={exercise.data ?? BLANK}
        courseId={courseId}
        moduleId={moduleId}
        exerciseId={isNew ? undefined : exerciseId}
        lessons={module.lessons}
        onSaved={(id) => {
          if (isNew)
            navigate(`/app/admin/courses/${courseId}/modules/${moduleId}/exercises/${id}`, {
              replace: true,
            })
          else exercise.reload()
        }}
      />
    </>
  )
}
