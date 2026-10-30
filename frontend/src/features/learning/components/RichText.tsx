import { Fragment } from 'react'

/**
 * The inline markup lessons may use: `code`, **bold** and *italic*. Everything
 * else is plain text, rendered as text - never as HTML. Italic needs a letter
 * against each asterisk, so arithmetic such as `2 * 3 * 4` stays as written.
 */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s](?:[^*]*[^*\s])?\*)/g)
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
          return (
            <code
              key={index}
              className="rounded-md bg-brand-50 px-1.5 py-0.5 font-mono text-[0.9em] text-brand-800 ring-1 ring-brand-100"
            >
              {part.slice(1, -1)}
            </code>
          )
        }
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
          return (
            <strong key={index} className="font-semibold text-slate-900">
              {part.slice(2, -2)}
            </strong>
          )
        }
        if (part.length > 2 && /^\*[^*\s](?:[^*]*[^*\s])?\*$/.test(part)) {
          return <em key={index}>{part.slice(1, -1)}</em>
        }
        return <Fragment key={index}>{part}</Fragment>
      })}
    </>
  )
}
