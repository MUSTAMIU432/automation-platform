import { useState } from 'react'

import { BulbIcon, CopyIcon } from '../../../components/AppIcons'
import type { ContentBlock } from '../api/learningApi'
import { highlightLines } from '../utils/highlight'
import { RichText } from './RichText'

/** A code example, highlighted and (unless it is output) numbered line by line, with a copy button. */
export function CodeBlock({
  code,
  language = 'python',
  label,
}: {
  code: string
  language?: string
  /** The caption; by default named from the language ("Python", "Output"). */
  label?: string
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  const caption =
    label ?? (language === 'text' ? 'Output' : language === 'python' ? 'Python' : language)
  return (
    <figure className="group overflow-hidden rounded-2xl bg-[#0d2a22] shadow-[0_18px_40px_-28px_rgba(6,47,37,0.9)] ring-1 ring-black/10">
      <figcaption className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs font-medium text-white/60">
        <span className="uppercase tracking-wide">{caption}</span>
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1 text-white/75 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-mint"
        >
          <CopyIcon className="h-3.5 w-3.5" />
          {copied ? 'Copied' : 'Copy'}
        </button>
      </figcaption>
      <pre className="code-dark overflow-x-auto px-4 py-3.5 text-[13px] leading-relaxed text-[#e6f4ee]">
        <code>
          {highlightLines(code, language).map((tokens, line) => (
            <span key={line} className="block min-h-[1.25em]">
              {/* Numbers to point at ("line 2"), not part of the code: copy skips them. Output has none. */}
              {language !== 'text' && (
                <span
                  aria-hidden="true"
                  className="mr-4 inline-block w-5 text-right text-white/30 select-none"
                >
                  {line + 1}
                </span>
              )}
              {tokens.map((token, index) => (
                <span key={index} className={token.className || undefined}>
                  {token.text}
                </span>
              ))}
            </span>
          ))}
        </code>
      </pre>
    </figure>
  )
}

/**
 * A lesson's or an exercise's content, block by block. A lesson is set for
 * reading (`reading`): larger type across the full width of its panel,
 * and numbered headings so its sections read as steps - the number is a marker,
 * not part of the heading's name.
 */
export function ContentBlocks({
  blocks,
  reading = false,
}: {
  blocks: ContentBlock[]
  reading?: boolean
}) {
  // Each heading's step number: how many headings come up to and including it.
  const sections = blocks.map(
    (_, index) => blocks.slice(0, index + 1).filter((block) => block.kind === 'heading').length,
  )
  return (
    <div
      className={
        reading
          ? 'space-y-5 text-base leading-[1.75] text-slate-700'
          : 'space-y-4 text-[15px] leading-7 text-slate-700'
      }
    >
      {blocks.map((block, index) => {
        switch (block.kind) {
          case 'heading':
            return (
              <h2
                key={index}
                className="flex items-center gap-3 pt-3 text-xl font-bold tracking-tight text-slate-900"
              >
                {reading && (
                  <span
                    aria-hidden="true"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-linear-to-br from-brand-500 to-jade text-sm font-bold text-white shadow-[0_6px_14px_-8px_rgba(11,143,101,0.9)]"
                  >
                    {sections[index]}
                  </span>
                )}
                <span>
                  <RichText text={block.text} />
                </span>
              </h2>
            )
          case 'list':
            return (
              <ul key={index} className="space-y-1.5 pl-1">
                {block.text.split('\n').map((item, itemIndex) => (
                  <li key={itemIndex} className="flex gap-2.5">
                    <span
                      aria-hidden="true"
                      className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400"
                    />
                    <span>
                      <RichText text={item} />
                    </span>
                  </li>
                ))}
              </ul>
            )
          case 'note':
            return (
              <aside
                key={index}
                className="flex gap-3 rounded-2xl border border-brand-100 bg-brand-50/70 px-4 py-3.5 text-sm leading-6 text-brand-900"
              >
                <span
                  aria-hidden="true"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-brand-600 ring-1 ring-brand-100"
                >
                  <BulbIcon className="h-5 w-5" />
                </span>
                <span className="min-w-0 self-center">
                  <RichText text={block.text} />
                </span>
              </aside>
            )
          case 'code':
            return <CodeBlock key={index} code={block.text} language={block.language} />
          default:
            return (
              <p key={index}>
                <RichText text={block.text} />
              </p>
            )
        }
      })}
    </div>
  )
}
