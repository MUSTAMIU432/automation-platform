import { useState } from 'react'

import type { ContentBlock } from '../api/learningApi'
import { highlightLines } from '../utils/highlight'
import { RichText } from './RichText'

/** A code example, highlighted, with a copy button. */
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
          className="rounded-full px-2.5 py-1 text-white/70 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-mint"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </figcaption>
      <pre className="code-dark overflow-x-auto px-4 py-3.5 text-[13px] leading-relaxed text-[#e6f4ee]">
        <code>
          {highlightLines(code, language).map((tokens, line) => (
            <span key={line} className="block min-h-[1.25em]">
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

/** A lesson's or an exercise's content, block by block. */
export function ContentBlocks({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <div className="space-y-4 text-[15px] leading-7 text-slate-700">
      {blocks.map((block, index) => {
        switch (block.kind) {
          case 'heading':
            return (
              <h2 key={index} className="pt-3 text-xl font-bold tracking-tight text-slate-900">
                <RichText text={block.text} />
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
                className="rounded-2xl border border-brand-100 bg-brand-50/70 px-4 py-3 text-sm leading-6 text-brand-900"
              >
                <RichText text={block.text} />
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
