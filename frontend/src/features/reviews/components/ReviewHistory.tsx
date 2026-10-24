import { useEffect } from 'react'

import { useIdeaReviews } from '../hooks/useIdeaReviews'
import { CRITERION_LABELS, DECISION_LABELS, RATING_LABELS, formatDate } from '../utils/reviewLabels'

/**
 * An idea's review rounds, as the server chose to show them to this viewer.
 *
 * Used by reviewers in the review workspace and by authors on their own idea.
 * It renders whatever `ideaReviews` returned and nothing else: an author
 * receives completed rounds, a reviewer every round, anybody else nothing -
 * so there is no client-side rule here about who may see what, and an empty
 * list is shown as "no reviews" rather than as a refusal.
 *
 * `reviewerId` is shown as "you" when it is the viewer, and otherwise not
 * named: the API carries an id, not a person, on purpose.
 */
/** Each decision's colour, so a round's outcome reads at a glance. */
const DECISION_TONES: Record<string, string> = {
  APPROVED: 'bg-mist text-jade ring-jade/20',
  CONFIRMED: 'bg-mist text-jade ring-jade/20',
  CHANGES_REQUESTED: 'bg-amber-50 text-amber-800 ring-amber-200',
  REJECTED: 'bg-red-50 text-red-700 ring-red-200',
  WITHDRAWN: 'bg-gray-100 text-gray-700 ring-gray-200',
}

export function ReviewHistory({
  ideaId,
  viewerId,
  onCountChange,
}: {
  ideaId: string
  viewerId: string | null
  onCountChange?: (count: number) => void
}) {
  const { reviews, loading, error } = useIdeaReviews(ideaId)
  useEffect(() => {
    if (!loading && !error) onCountChange?.(reviews.length)
  }, [loading, error, reviews.length, onCountChange])

  if (loading) {
    return <p className="text-sm text-gray-500">Loading review history…</p>
  }
  if (error) {
    return (
      <p role="alert" className="text-sm text-red-700">
        {error}
      </p>
    )
  }
  if (reviews.length === 0) {
    return <p className="text-sm text-gray-500">No reviews yet.</p>
  }

  return (
    <ol aria-label="Review history" className="relative space-y-3">
      {/* The rail joining the rounds, through their markers. */}
      <span
        aria-hidden="true"
        className="absolute bottom-6 left-[0.9rem] top-6 w-px bg-gradient-to-b from-jade/40 to-jade/10"
      />
      {reviews.map((review) => (
        <li key={review.id} className="relative flex gap-3">
          <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-jade/30 bg-white text-xs font-bold text-forest shadow-sm">
            <span className="sr-only">Review </span>
            {review.round}
          </span>
          <div className="min-w-0 flex-1 rounded-2xl border border-gray-100 bg-white p-4 shadow-[0_1px_2px_rgba(20,45,37,0.05)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {review.decision ? (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${DECISION_TONES[review.decision] ?? 'bg-gray-100 text-gray-700 ring-gray-200'}`}
                >
                  {DECISION_LABELS[review.decision]}
                </span>
              ) : (
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                  In progress
                </span>
              )}
              <p className="text-xs text-sage">
                {review.completedAt
                  ? `Completed ${formatDate(review.completedAt)}`
                  : `Started ${formatDate(review.createdAt)}`}
                {viewerId !== null && review.reviewerId === viewerId ? ' · by you' : ''}
              </p>
            </div>
            {review.decision === 'WITHDRAWN' && (
              <p className="mt-2 text-sm text-sage">
                The reviewer could no longer review this idea, so another reviewer took it over in
                the next round. No decision was made in this round.
              </p>
            )}
            {review.feedback && (
              <p className="mt-2 text-sm leading-6 whitespace-pre-line text-ink/80">
                {review.feedback}
              </p>
            )}
            {review.assessments.length > 0 && (
              <dl className="mt-3 grid gap-x-6 gap-y-1.5 border-t border-gray-100 pt-3 text-sm sm:grid-cols-2">
                {review.assessments.map((assessment) => (
                  <div key={assessment.criterion} className="flex justify-between gap-3">
                    <dt className="text-sage">{CRITERION_LABELS[assessment.criterion]}</dt>
                    <dd className="font-semibold text-ink">{RATING_LABELS[assessment.rating]}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
