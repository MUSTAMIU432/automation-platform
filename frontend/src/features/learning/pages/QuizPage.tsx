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
  const isAnswered = (questionId: string) => (answers[questionId] ?? []).length > 0
  const answered = data.questions.filter((question) => isAnswered(question.id)).length
  const answeredPercent = data.questions.length
    ? Math.round((answered / data.questions.length) * 100)
    : 0

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="min-w-0 space-y-6">
        <header className={`${glassPanel} p-6`}>
          <p className="text-sm font-medium text-brand-700">
            Module {data.modulePosition} · {data.moduleTitle}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{data.title}</h1>
          <p className="mt-2 text-sm text-slate-600">
            {data.questions.length} questions · pass mark {data.passPercentage}%
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

        <form
          id="quiz-form"
          onSubmit={(event) => void submit(event)}
          className="space-y-4"
          aria-label={data.title}
        >
          {data.questions.map((question, index) => {
            const result = results.get(question.id)
            const multiple = question.kind === 'multiple'
            return (
              <fieldset
                key={question.id}
                id={`quiz-question-${question.id}`}
                className={`${glassPanel} scroll-mt-[calc(var(--app-chrome-height,0px)+1rem)] p-5 ${result ? (result.correct ? 'ring-2 ring-emerald-300' : 'ring-2 ring-rose-300') : ''}`}
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
                {/* Two answers a row on a wide screen: the choices are short, the page is not. */}
                <div className="mt-3 grid gap-2 xl:grid-cols-2">
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
        </form>
      </div>

      {/* Where the quiz stands, and the one way to hand it in: in view however far down the reader is. */}
      <aside className="space-y-4 lg:sticky lg:top-[calc(var(--app-chrome-height,0px)+1rem)] lg:self-start">
        <section aria-labelledby="quiz-answers" className={`${glassPanel} space-y-4 p-5`}>
          <div>
            <h2 id="quiz-answers" className="font-semibold text-slate-900">
              Your answers
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {answered} of {data.questions.length} answered
            </p>
            <progress
              value={answeredPercent}
              max={100}
              aria-label="Questions answered"
              className="sr-only"
            >
              {answeredPercent}%
            </progress>
            <div
              aria-hidden="true"
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200/80"
            >
              <div
                className="h-full rounded-full bg-linear-to-r from-brand-500 to-mint motion-safe:transition-[width]"
                style={{ width: `${answeredPercent}%` }}
              />
            </div>
          </div>
          <ol aria-label="Questions" className="grid grid-cols-5 gap-2">
            {data.questions.map((question, index) => {
              const result = results.get(question.id)
              const tone = result
                ? result.correct
                  ? 'bg-emerald-500 text-white'
                  : 'bg-rose-500 text-white'
                : isAnswered(question.id)
                  ? 'bg-brand-600 text-white'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-brand-300'
              const state = result
                ? result.correct
                  ? 'correct'
                  : 'not correct'
                : isAnswered(question.id)
                  ? 'answered'
                  : 'not answered'
              return (
                <li key={question.id}>
                  <a
                    href={`#quiz-question-${question.id}`}
                    aria-label={`Question ${index + 1}, ${state}`}
                    className={`grid h-9 place-items-center rounded-lg text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${tone}`}
                  >
                    {index + 1}
                  </a>
                </li>
              )
            })}
          </ol>
          <dl className="space-y-1.5 border-t border-slate-200 pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Pass mark</dt>
              <dd className="font-semibold text-slate-900">{data.passPercentage}%</dd>
            </div>
            {best >= 0 && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Your best</dt>
                <dd className="font-semibold text-slate-900">{best}%</dd>
              </div>
            )}
          </dl>
          <button
            type="submit"
            form="quiz-form"
            disabled={busy}
            className={`${primaryButton} w-full py-2.5`}
          >
            {outcome ? 'Submit again' : 'Submit answers'}
          </button>
        </section>
        <Link
          to={`${learnBase}/courses/${data.courseSlug}`}
          className={`${secondaryButton} w-full`}
        >
          Back to the course
        </Link>
      </aside>
    </div>
  )
}
