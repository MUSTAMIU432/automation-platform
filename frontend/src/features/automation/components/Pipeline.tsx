import type { PipelineStage } from '../api/automationApi'
import { PIPELINE_LABELS } from '../utils/labels'

const STATE_WORD: Record<PipelineStage['state'], string> = {
  done: 'done',
  current: 'in progress',
  pending: 'not started',
}

/** The delivery pipeline as it really stands, drawn from the project's own records. */
export function Pipeline({ stages }: { stages: PipelineStage[] }) {
  return (
    <ol aria-label="Delivery pipeline" className="flex flex-wrap items-start gap-y-3">
      {stages.map((s, index) => (
        <li key={s.stage} className="flex min-w-[5.5rem] flex-1 items-start">
          <span className="flex w-full flex-col items-center text-center">
            <span className="relative flex w-full items-center justify-center">
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className={`absolute right-1/2 top-1/2 h-0.5 w-full -translate-y-1/2 ${
                    s.state === 'pending' ? 'bg-jade/15' : 'bg-jade'
                  }`}
                />
              )}
              <span
                aria-hidden="true"
                className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                  s.state === 'done'
                    ? 'bg-jade text-white'
                    : s.state === 'current'
                      ? 'bg-mint text-forest ring-4 ring-mint/40'
                      : 'border-2 border-jade/20 bg-white text-sage'
                }`}
              >
                {s.state === 'done' ? '✓' : index + 1}
              </span>
            </span>
            <span
              className={`mt-1.5 px-1 text-xs leading-tight ${
                s.state === 'current'
                  ? 'font-bold text-jade'
                  : s.state === 'done'
                    ? 'font-semibold text-ink'
                    : 'text-sage'
              }`}
            >
              {PIPELINE_LABELS[s.stage] ?? s.stage}
            </span>
            <span className="sr-only">({STATE_WORD[s.state]})</span>
          </span>
        </li>
      ))}
    </ol>
  )
}
