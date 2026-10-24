import type { Fact } from './proposalFacts'

/**
 * The labelled facts at the head of a proposal - who, when, for how long - laid out like the
 * cover block of a prepared document. A fact with no value is left out rather than shown blank.
 */
export function ProposalFacts({ facts, label }: { facts: Fact[]; label?: string }) {
  const shown = facts.filter(([, value]) => value !== null && value !== undefined && value !== '')
  if (shown.length === 0) return null
  return (
    <dl
      aria-label={label}
      className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-gray-200 bg-gray-50/70 px-5 py-4 sm:grid-cols-3 lg:grid-cols-4"
    >
      {shown.map(([name, value]) => (
        <div key={name} className="min-w-0">
          <dt className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
            {name}
          </dt>
          <dd className="mt-1 text-sm font-medium break-words text-gray-900">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
