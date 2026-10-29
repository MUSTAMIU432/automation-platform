import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'

import {
  quizRequest,
  submitQuizRequest,
  type QuestionResult,
  type QuizAttempt,
} from '../api/learningApi'
import { CodeBlock } from '../components/ContentBlocks'
import { RichText } from '../components/RichText'
import { Empty, ErrorNotice, Loading } from '../components/States'
import { glassPanel, primaryButton, secondaryButton } from '../components/ui'
import { useLearningQuery } from '../hooks/useLearningQuery'
import { useLearnBase } from '../hooks/useLearnBase'

/** `/app/learn/courses/:courseSlug/quizzes/:quizId`: a module's quiz. */
export function QuizPage() {
  const learnBase = useLearnBase()
  const { courseSlug = '', quizId = '' } = useParams()
  const quiz = useLearningQuery(
    `quiz:${quizId}`,
    () => quizRequest(quizId),
    'We could not load this quiz.',
  )
  const [answers, setAnswers] = useState<Record<string, string[]>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<{
    attempt: QuizAttempt
    results: QuestionResult[]
  } | null>(null)

  function choose(questionId: string, optionId: string, multiple: boolean) {
    setOutcome(null)
    setAnswers((current) => {
      const chosen = current[questionId] ?? []
      if (!multiple) return { ...current, [questionId]: [optionId] }
      return {
        ...current,
        [questionId]: chosen.includes(optionId)
          ? chosen.filter((id) => id !== optionId)
          : [...chosen, optionId],
      }
    })
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const result = await submitQuizRequest(
        quizId,
        Object.entries(answers).map(([questionId, optionIds]) => ({ questionId, optionIds })),
      )
      if (result.success && result.attempt) {
        setOutcome({ attempt: result.attempt, results: result.results })
        quiz.reload()
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        setError(result.message)
      }
    } catch {
      setError('We could not reach the server. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (quiz.error) return <ErrorNotice message={quiz.error} onRetry={quiz.reload} />
  if (quiz.loading && !quiz.data) return <Loading label="Loading the quiz…" />
  if (!quiz.data) {
    return (
      <Empty
        title="This quiz is not available."
        description="Enroll in the course to take its quizzes."
        action={
          <Link to={`${learnBase}/courses/${courseSlug}`} className={secondaryButton}>
            Go to the course
          </Link>
        }
      />
    )
  }

  const data = quiz.data
  const results = new Map(outcome?.results.map((result) => [result.questionId, result]))
  const best = data.attempts.reduce((top, attempt) => Math.max(top, attempt.percentage), -1)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className={`${glassPanel} p-6`}>
        <p className="text-sm font-medium text-brand-700">
          Module {data.modulePosition} · {data.moduleTitle}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{data.title}</h1>
        <p className="mt-2 text-sm text-slate-600">
          {data.questions.length} questions · pass mark {data.passPercentage}%
          {best >= 0 && ` · your best ${best}%`}
        </p>
      </header>

      {outcome && (
        <output
          className={`block rounded-2xl px-5 py-4 text-sm font-semibold ${outcome.attempt.passed ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}
        >
          You scored {outcome.attempt.percentage}% ({outcome.attempt.score} of{' '}
          {outcome.attempt.maxScore}).{' '}
          {outcome.attempt.passed
            ? 'Passed - well done!'
            : 'Not passed yet. Review the explanations and try again.'}
        </output>
      )}

      <form onSubmit={(event) => void submit(event)} className="space-y-4" aria-label={data.title}>
        {data.questions.map((question, index) => {
          const result = results.get(question.id)
          const multiple = question.kind === 'multiple'
          return (
            <fieldset
              key={question.id}
              className={`${glassPanel} p-5 ${result ? (result.correct ? 'ring-2 ring-emerald-300' : 'ring-2 ring-rose-300') : ''}`}
            >
              <legend className="sr-only">Question {index + 1}</legend>
              <p className="font-medium text-slate-900">
                <span className="mr-2 text-brand-700">{index + 1}.</span>
                <RichText text={question.prompt} />
              </p>
              {multiple && (
                <p className="mt-1 text-xs text-slate-500">Choose every correct answer.</p>
              )}
              {question.code && (
                <div className="mt-3">
                  <CodeBlock code={question.code} />
                </div>
              )}
              <div className="mt-3 space-y-2">
                {question.options.map((option) => (
                  <label
                    key={option.id}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white/75 px-3.5 py-2.5 text-sm text-slate-800 has-checked:border-brand-400 has-checked:bg-brand-50/80"
                  >
                    <input
                      type={multiple ? 'checkbox' : 'radio'}
                      name={`question-${question.id}`}
                      checked={(answers[question.id] ?? []).includes(option.id)}
                      onChange={() => choose(question.id, option.id, multiple)}
                      className="mt-0.5 accent-brand-600"
                    />
                    <span>
                      <RichText text={option.text} />
                    </span>
                  </label>
                ))}
              </div>
              {result && (
                <p
                  className={`mt-3 rounded-xl px-3 py-2 text-sm ${result.correct ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}
                >
                  <span className="font-semibold">
                    {result.correct ? 'Correct. ' : 'Not quite. '}
                  </span>
                  {result.explanation}
                </p>
              )}
            </fieldset>
          )
        })}
        {error && <ErrorNotice message={error} />}
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={busy} className={primaryButton}>
            {outcome ? 'Submit again' : 'Submit answers'}
          </button>
          <Link to={`${learnBase}/courses/${data.courseSlug}`} className={secondaryButton}>
            Back to the course
          </Link>
        </div>
      </form>
    </div>
  )
}
