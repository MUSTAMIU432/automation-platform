import {
  PAYMENT_WORDS,
  PROPOSAL_SECTIONS,
  sectionApplies,
  type IdeaProposal,
} from '../api/proposalsApi'

type Block =
  | { kind: 'paragraph'; lines: string[] }
  | { kind: 'bullets'; items: string[] }
  | { kind: 'numbers'; items: string[] }

const BULLET = /^\s*[-*•]\s+/
const NUMBER = /^\s*\d+[.)]\s+/

/**
 * Plain text as reading blocks: paragraphs split on blank lines, and runs of "- " or "1."
 * lines as lists. Only the shape of the text is read - never markup - so what a writer
 * typed is shown exactly, just laid out.
 */
function blocks(text: string): Block[] {
  const result: Block[] = []
  for (const line of text.trim().split('\n')) {
    const last = result.at(-1)
    if (line.trim() === '') {
      if (last?.kind === 'paragraph' && last.lines.length)
        result.push({ kind: 'paragraph', lines: [] })
      continue
    }
    const kind = BULLET.test(line) ? 'bullets' : NUMBER.test(line) ? 'numbers' : 'paragraph'
    if (kind === 'paragraph') {
      if (last?.kind === 'paragraph') last.lines.push(line)
      else result.push({ kind, lines: [line] })
    } else {
      const item = line.replace(kind === 'bullets' ? BULLET : NUMBER, '')
      if (last?.kind === kind) last.items.push(item)
      else result.push({ kind, items: [item] })
    }
  }
  return result.filter((block) => block.kind !== 'paragraph' || block.lines.length > 0)
}

/** One section's text, laid out for reading. */
export function ProposalText({ text }: { text: string }) {
  return (
    <div className="space-y-3 text-[15px] leading-7 text-gray-700">
      {blocks(text).map((block, index) => {
        if (block.kind === 'paragraph') {
          return (
            <p key={index} className="whitespace-pre-line">
              {block.lines.join('\n')}
            </p>
          )
        }
        const List = block.kind === 'bullets' ? 'ul' : 'ol'
        return (
          <List
            key={index}
            className={`space-y-1.5 pl-6 ${block.kind === 'bullets' ? 'list-disc' : 'list-decimal'} marker:text-brand-600`}
          >
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex} className="pl-1">
                {item}
              </li>
            ))}
          </List>
        )
      })}
    </div>
  )
}

function isRequired(section: (typeof PROPOSAL_SECTIONS)[number]): boolean {
  return ('required' in section && section.required) || section.key === 'paymentPlan'
}

/**
 * A proposal's sections as a numbered document, plain text only. Never HTML: a proposal is
 * written by people and read by others, so nothing in it is ever interpreted as markup.
 *
 * `showMissing` is for the writers' preview: a required section that is still empty keeps
 * its place in the document, marked, so the gap is seen where it is rather than in a list.
 */
export function ProposalSections({
  proposal,
  showMissing = false,
}: {
  proposal: IdeaProposal
  showMissing?: boolean
}) {
  const shown = PROPOSAL_SECTIONS.filter((section) => {
    if (section.key === 'title' || !sectionApplies(section.key, proposal.paymentRequired)) {
      return false
    }
    return proposal[section.key].trim() !== '' || (showMissing && isRequired(section))
  })
  if (shown.length === 0) {
    return <p className="text-sm text-gray-600">Nothing has been written yet.</p>
  }
  return (
    <ol className="divide-y divide-gray-200">
      {shown.map((section, index) => {
        const value = proposal[section.key].trim()
        return (
          <li
            key={section.key}
            className="grid gap-x-6 gap-y-2 py-6 first:pt-0 last:pb-0 sm:grid-cols-[11rem_1fr]"
          >
            <h3 className="flex items-baseline gap-2.5 text-base font-semibold text-gray-900">
              <span className="text-sm font-bold text-brand-600 tabular-nums">
                {String(index + 1).padStart(2, '0')}
              </span>
              {section.label}
            </h3>
            {value === '' ? (
              <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Not written yet - required before the proposal can be sent.
              </p>
            ) : section.key === 'paymentRequired' ? (
              <p className="text-[15px] leading-7 text-gray-700">
                {PAYMENT_WORDS[value as 'yes' | 'no'] ?? value}
              </p>
            ) : (
              <ProposalText text={value} />
            )}
          </li>
        )
      })}
    </ol>
  )
}
