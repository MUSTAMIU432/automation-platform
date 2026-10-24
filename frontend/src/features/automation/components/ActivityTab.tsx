import { ArrowRightIcon } from '../../../components/AppIcons'
import { activityRequest } from '../api/automationApi'
import { label } from '../utils/labels'
import { useLoad } from '../utils/useLoad'
import { Empty, Loading, LoadFailed } from './ui'

/** The audit trail: what happened, and when, oldest first. */
export function ActivityTab({ opportunityId }: { opportunityId: string }) {
  const loaded = useLoad(() => activityRequest(opportunityId), `act:${opportunityId}`)

  if (loaded.loading) return <Loading what="the activity" />
  if (loaded.failed) return <LoadFailed what="the activity" onRetry={loaded.reload} />
  if (!loaded.data || loaded.data.length === 0) {
    return <Empty title="Nothing has happened yet." />
  }
  return (
    <section className="rounded-3xl border border-white bg-white/90 p-5 shadow-[0_16px_40px_-30px_rgba(8,75,56,0.5)] sm:p-6">
      <h3 className="text-base font-bold text-ink">What has happened</h3>
      <p className="mt-0.5 text-sm text-sage">Every step of this opportunity, oldest first.</p>
      <ol className="relative mt-5" aria-label="Activity">
        <span
          aria-hidden="true"
          className="absolute bottom-3 left-[0.6875rem] top-3 w-px bg-jade/20"
        />
        {loaded.data.map((event, index) => {
          const latest = index === loaded.data!.length - 1
          const when = new Date(event.createdAt)
          return (
            <li key={event.id} className="relative flex gap-4 pb-5 last:pb-0">
              <span
                aria-hidden="true"
                className={`relative z-10 mt-1 flex h-[1.375rem] w-[1.375rem] shrink-0 items-center justify-center rounded-full border-2 bg-white ${
                  latest ? 'border-jade ring-4 ring-mint/40' : 'border-jade/40'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${latest ? 'bg-jade' : 'bg-jade/40'}`} />
              </span>
              <div className="min-w-0 flex-1 rounded-2xl border border-gray-100 bg-white px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-ink">{label(event.action)}</p>
                  <time dateTime={event.createdAt} className="text-xs text-sage">
                    {when.toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                    {' · '}
                    {when.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </time>
                </div>
                {event.fromStatus && event.toStatus && (
                  <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-ink/70">
                      {label(event.fromStatus)}
                    </span>
                    <ArrowRightIcon className="h-3.5 w-3.5 text-sage" />
                    <span className="rounded-full bg-mist px-2 py-0.5 font-semibold text-jade">
                      {label(event.toStatus)}
                    </span>
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
