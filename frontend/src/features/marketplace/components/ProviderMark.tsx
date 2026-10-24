import type { PaymentKind } from '../api/marketplaceApi'

/**
 * A payment provider's mark: a tile in the provider's colours with its name, recognised by
 * the provider name an administrator typed. These are drawn marks, not the providers' own
 * logo files; an official logo can replace one here without touching any caller.
 */
interface Mark {
  match: RegExp
  /** The wordmark; a second line is drawn smaller. */
  lines: [string, string?]
  background: string
  color: string
  lowercase?: boolean
}

const MARKS: Mark[] = [
  {
    match: /mixx|yas|tigo/i,
    lines: ['mixx', 'by yas'],
    background: '#FFD100',
    color: '#0B1F45',
    lowercase: true,
  },
  { match: /m-?pesa|vodacom/i, lines: ['M-PESA'], background: '#00A651', color: '#FFFFFF' },
  {
    match: /airtel/i,
    lines: ['airtel', 'money'],
    background: '#E40000',
    color: '#FFFFFF',
    lowercase: true,
  },
  {
    match: /halo/i,
    lines: ['halo', 'pesa'],
    background: '#F7941D',
    color: '#FFFFFF',
    lowercase: true,
  },
  { match: /visa|master|card/i, lines: ['CARD'], background: '#1A1F71', color: '#FFFFFF' },
  { match: /crdb/i, lines: ['CRDB'], background: '#00843D', color: '#FFFFFF' },
  { match: /nmb/i, lines: ['NMB'], background: '#0060AA', color: '#FFFFFF' },
  { match: /nbc/i, lines: ['NBC'], background: '#14295E', color: '#FFFFFF' },
  { match: /exim/i, lines: ['EXIM'], background: '#C8102E', color: '#FFFFFF' },
  { match: /stanbic/i, lines: ['Stanbic'], background: '#0033A1', color: '#FFFFFF' },
]

const SIZES = {
  sm: { box: 'h-8 w-8 rounded-md', main: 'text-[8px]', sub: 'text-[6px]' },
  md: { box: 'h-11 w-11 rounded-lg', main: 'text-[11px]', sub: 'text-[7px]' },
  lg: { box: 'h-14 w-14 rounded-xl', main: 'text-sm', sub: 'text-[9px]' },
}

export function ProviderMark({
  provider,
  kind,
  size = 'md',
}: {
  provider: string
  kind: PaymentKind
  size?: keyof typeof SIZES
}) {
  const mark = MARKS.find((m) => m.match.test(provider))
  const s = SIZES[size]

  if (!mark) {
    // An unknown provider: a plain phone or bank symbol.
    return (
      <span
        aria-hidden="true"
        className={`${s.box} flex shrink-0 items-center justify-center bg-slate-100 text-slate-600`}
      >
        <svg viewBox="0 0 24 24" className="h-1/2 w-1/2" fill="none" stroke="currentColor">
          {kind === 'bank' ? (
            <path
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 10h18M5 10v8m4.67-8v8m4.66-8v8M19 10v8M3 21h18M12 3l9 5H3l9-5Z"
            />
          ) : (
            <path
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 2.5h8a1.5 1.5 0 0 1 1.5 1.5v16a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V4A1.5 1.5 0 0 1 8 2.5ZM11 18.5h2"
            />
          )}
        </svg>
      </span>
    )
  }

  const [main, sub] = mark.lines
  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: mark.background, color: mark.color }}
      className={`${s.box} flex shrink-0 flex-col items-center justify-center leading-none shadow-sm ring-1 ring-black/5`}
    >
      <span className={`${s.main} font-black tracking-tight ${mark.lowercase ? '' : 'uppercase'}`}>
        {main}
      </span>
      {sub && <span className={`${s.sub} mt-0.5 font-bold opacity-80`}>{sub}</span>}
    </span>
  )
}
