import { useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'

import {
  adminCourseRequest,
  adminQuizRequest,
  deleteQuizRequest,
  saveQuizRequest,
  type AdminQuestion,
} from '../api/courseAuthoringApi'
import {
  AdminCard,
  AdminPageHeader,
  EmptyState,
  ErrorState,
  LoadingState,
  Notice,
  controlClasses,
  dangerButtonClasses,
  primaryButtonClasses,
  secondaryButtonClasses,
} from '../components/AdminUi'
import { BackLink } from '../components/BackLink'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useAdminQuery } from '../hooks/useAdminQuery'

const blankQuestion = (): AdminQuestion => ({
  prompt: '',
  code: '',
  kind: 'single',
  explanation: '',
  options: [
    { text: '', correct: true },
    { text: '', correct: false },
  ],
})

function QuestionEditor({
  question,
  index,
  onChange,
  onRemove,
}: {
  question: AdminQuestion
  index: number
  onChange: (question: AdminQuestion) => void
  onRemove: () => void
}) {
  function setOption(optionIndex: number, change: Partial<AdminQuestion['options'][number]>) {
    const options = question.options.map((option, i) => {
      if (i === optionIndex) return { ...option, ...change }
      // One answer: choosing a new correct option clears the others.
      if (change.correct && question.kind === 'single') return { ...option, correct: false }
      return option
    })
    onChange({ ...question, options })
  }

  return (
    <AdminCard
      title={`Question ${index + 1}`}
      actions={
        <button type="button" className={secondaryButtonClasses} onClick={onRemove}>
          Remove
        </button>
      }
    >
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-slate-700">
          Question
          <textarea
            rows={2}
            value={question.prompt}
            onChange={(e) => onChange({ ...question, prompt: e.target.value })}
            className={`${controlClasses} mt-1 w-full`}
          />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Code shown with the question (optional)
          <textarea
            rows={3}
            value={question.code}
            onChange={(e) => onChange({ ...question, code: e.target.value })}
            className={`${controlClasses} mt-1 w-full font-mono text-xs`}
          />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Answers
          <select
            value={question.kind}
            onChange={(e) =>
              onChange({ ...question, kind: e.target.value as AdminQuestion['kind'] })
            }
            className={`${controlClasses} mt-1 block`}
          >
            <option value="single">One correct answer</option>
            <option value="multiple">Every correct answer (choose all that apply)</option>
          </select>
        </label>
        <ul className="space-y-2">
          {question.options.map((option, optionIndex) => (
            <li key={optionIndex} className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-sm text-slate-700">
                <input
                  type={question.kind === 'single' ? 'radio' : 'checkbox'}
                  name={`correct-${index}`}
                  checked={option.correct}
                  onChange={(e) => setOption(optionIndex, { correct: e.target.checked })}
                  className="accent-brand-600"
                />
                Correct
              </label>
              <input
                value={option.text}
                onChange={(e) => setOption(optionIndex, { text: e.target.value })}
                aria-label={`Answer ${optionIndex + 1}`}
                className={`${controlClasses} min-w-64 flex-1`}
              />
              <button
                type="button"
                disabled={question.options.length <= 2}
                className={secondaryButtonClasses}
                onClick={() =>
                  onChange({
                    ...question,
                    options: question.options.filter((_, i) => i !== optionIndex),
                  })
                }
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className={secondaryButtonClasses}
          onClick={() =>
            onChange({ ...question, options: [...question.options, { text: '', correct: false }] })
          }
        >
          Add answer
        </button>
        <label className="block text-sm font-semibold text-slate-700">
          Explanation (shown after the quiz is submitted)
          <textarea
            rows={2}
            value={question.explanation}
            onChange={(e) => onChange({ ...question, explanation: e.target.value })}
            className={`${controlClasses} mt-1 w-full`}
          />
        </label>
      </div>
    </AdminCard>
  )
}

/** `/app/admin/courses/:courseId/modules/:moduleId/quiz`: a module's quiz, answers included. */
export function AdminQuizEditorPage() {
  const { courseId = '', moduleId = '' } = useParams()
  const course = useAdminQuery(
    `admin-course:${courseId}`,
    () => adminCourseRequest(courseId),
    'We could not load the course.',
  )
  const quiz = useAdminQuery(
    `admin-quiz:${moduleId}`,
    () => adminQuizRequest(moduleId),
    'We could not load the quiz.',
  )

  if (course.error || quiz.error)
    return <ErrorState message={course.error ?? quiz.error ?? ''} onRetry={quiz.reload} />
  if (course.loading || quiz.loading) return <LoadingState label="Loading the quiz…" />
  const module = course.data?.modules.find((m) => m.id === moduleId)
  if (!course.data || !module) return <EmptyState title="This module does not exist." />

  return (
    <>
      <AdminPageHeader
        back={<BackLink to={`/app/admin/courses/${courseId}`}>{course.data.title}</BackLink>}
        title={`Quiz: ${module.title}`}
        description="Learners see the questions and answers, never which are correct until they submit."
      />
      <QuizForm key={quiz.data?.id ?? 'new'} moduleId={moduleId} initial={quiz.data} />
    </>
  )
}

/**
 * The quiz as being edited. It is the source of truth once saved - the page does
 * not reload underneath it, so the result of a save stays on screen.
 */
function QuizForm({
  moduleId,
  initial,
}: {
  moduleId: string
  initial: { title: string; passPercentage: number; questions: AdminQuestion[] } | null
}) {
  const [title, setTitle] = useState(initial?.title ?? 'Module quiz')
  const [pass, setPass] = useState(String(initial?.passPercentage ?? 70))
  const [questions, setQuestions] = useState<AdminQuestion[]>(
    initial?.questions ?? [blankQuestion()],
  )
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [exists, setExists] = useState(initial !== null)

  async function run(action: () => ReturnType<typeof saveQuizRequest>, afterwards: boolean) {
    setBusy(true)
    setResult(null)
    try {
      const outcome = await action()
      setResult({ tone: outcome.success ? 'success' : 'error', text: outcome.message })
      if (outcome.success) setExists(afterwards)
    } catch {
      setResult({ tone: 'error', text: 'We could not reach the server. Please try again.' })
    } finally {
      setBusy(false)
      setConfirmDelete(false)
    }
  }

  return (
    <form
      className="space-y-5"
      aria-label="Quiz"
      onSubmit={(event: FormEvent) => {
        event.preventDefault()
        void run(() => saveQuizRequest(moduleId, title, Number(pass) || 70, questions), true)
      }}
    >
      <AdminCard title="Quiz">
        <div className="flex flex-wrap gap-4">
          <label className="text-sm font-semibold text-slate-700">
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`${controlClasses} mt-1 block w-80 max-w-full`}
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Pass mark (%)
            <input
              type="number"
              min={1}
              max={100}
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              className={`${controlClasses} mt-1 block w-28`}
            />
          </label>
        </div>
      </AdminCard>
      {questions.map((question, index) => (
        <QuestionEditor
          key={index}
          question={question}
          index={index}
          onChange={(next) => setQuestions((all) => all.map((q, i) => (i === index ? next : q)))}
          onRemove={() => setQuestions((all) => all.filter((_, i) => i !== index))}
        />
      ))}
      <button
        type="button"
        className={secondaryButtonClasses}
        onClick={() => setQuestions((all) => [...all, blankQuestion()])}
      >
        Add question
      </button>
      {result && <Notice tone={result.tone}>{result.text}</Notice>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className={primaryButtonClasses}>
          Save quiz
        </button>
        {exists && (
          <button
            type="button"
            className={dangerButtonClasses}
            onClick={() => setConfirmDelete(true)}
          >
            Delete quiz
          </button>
        )}
      </div>
      {confirmDelete && (
        <ConfirmDialog
          title="Delete this quiz"
          confirmLabel="Delete quiz"
          danger
          busy={busy}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => void run(() => deleteQuizRequest(moduleId), false)}
        >
          Learners&apos; attempts at it are deleted too. This cannot be undone.
        </ConfirmDialog>
      )}
    </form>
  )
}
