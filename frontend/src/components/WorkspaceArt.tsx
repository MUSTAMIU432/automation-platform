/**
 * Flat illustrations for the workspace's collection pages (Organizations,
 * Teams): decorative, drawn in the brand greens, hidden from assistive
 * technology because the page title already says what the page is.
 */

/** A small city of buildings among trees - an organization's home. */
export function CityArt({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 320 140" className={className} fill="none">
      <ellipse cx="160" cy="132" rx="150" ry="8" className="fill-brand-100" />
      <circle cx="58" cy="26" r="9" className="fill-brand-100" />
      <circle cx="70" cy="22" r="12" className="fill-brand-100" />
      <circle cx="268" cy="20" r="10" className="fill-brand-100" />
      <circle cx="282" cy="24" r="8" className="fill-brand-100" />
      {/* the low building on the left */}
      <rect x="40" y="78" width="70" height="52" rx="3" className="fill-white stroke-brand-200" />
      <rect x="52" y="90" width="18" height="12" rx="1.5" className="fill-brand-600" />
      <rect x="78" y="90" width="18" height="12" rx="1.5" className="fill-brand-600" />
      <rect x="64" y="110" width="22" height="20" rx="1.5" className="fill-brand-200" />
      {/* the tower */}
      <rect x="120" y="30" width="74" height="100" rx="3" className="fill-white stroke-brand-200" />
      <rect x="132" y="42" width="50" height="76" rx="2" className="fill-brand-700" />
      {[52, 66, 80, 94].map((y) => (
        <path key={y} d={`M132 ${y}h50`} className="stroke-brand-500" strokeWidth="1.5" />
      ))}
      <path d="M157 42v76" className="stroke-brand-500" strokeWidth="1.5" />
      {/* the right block */}
      <rect x="200" y="56" width="60" height="74" rx="3" className="fill-white stroke-brand-200" />
      <rect x="236" y="44" width="16" height="12" rx="1.5" className="fill-brand-500" />
      {[70, 88, 106].map((y) => (
        <g key={y}>
          <rect x="212" y={y} width="10" height="8" rx="1" className="fill-brand-300" />
          <rect x="238" y={y} width="10" height="8" rx="1" className="fill-brand-300" />
        </g>
      ))}
      {/* trees */}
      {[
        [28, 100, 14],
        [116, 108, 10],
        [270, 96, 16],
        [296, 108, 11],
      ].map(([x, y, r]) => (
        <g key={x}>
          <path d={`M${x} ${y + r}v${130 - y - r}`} className="stroke-brand-700" strokeWidth="2" />
          <ellipse cx={x} cy={y} rx={r * 0.8} ry={r} className="fill-brand-400" />
        </g>
      ))}
    </svg>
  )
}

/** Three people side by side - a team. */
export function PeopleArt({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 320 140" className={className} fill="none">
      <ellipse cx="160" cy="132" rx="150" ry="8" className="fill-brand-100" />
      <circle cx="60" cy="28" r="10" className="fill-brand-100" />
      <circle cx="74" cy="24" r="13" className="fill-brand-100" />
      <circle cx="262" cy="22" r="11" className="fill-brand-100" />
      <rect x="70" y="58" width="180" height="70" rx="14" className="fill-white stroke-brand-200" />
      {/* the two at the sides */}
      {[
        [110, 'fill-brand-300'],
        [210, 'fill-brand-300'],
      ].map(([x, fill]) => (
        <g key={x}>
          <circle cx={x as number} cy="72" r="15" className={fill as string} />
          <path
            d={`M${(x as number) - 26} 128c0-18 12-30 26-30s26 12 26 30`}
            className={fill as string}
          />
        </g>
      ))}
      {/* the one in front, in the middle */}
      <circle cx="160" cy="62" r="19" className="fill-brand-600" />
      <path d="M126 130c0-22 15-37 34-37s34 15 34 37" className="fill-brand-600" />
      <circle cx="160" cy="62" r="19" className="stroke-white" strokeWidth="3" />
      {/* a speech bubble and a spark */}
      <rect x="226" y="30" width="38" height="24" rx="8" className="fill-brand-500" />
      <path d="M236 54l-4 8 10-8" className="fill-brand-500" />
      <path
        d="M236 40h18M236 46h12"
        className="stroke-white"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M92 36l3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" className="fill-brand-400" />
    </svg>
  )
}
