import { classHighlighter, highlightCode } from '@lezer/highlight'
import { parser } from '@lezer/python'

/** One run of text and the token class it carries ('' for plain text). */
export interface Token {
  text: string
  className: string
}

/**
 * Python source as highlighted lines, using the same grammar and token classes
 * (`tok-keyword`, `tok-string`, ...) the code editor uses, so an example in a
 * lesson and the code in the editor look alike. Text only - nothing is ever
 * rendered as HTML. Any other language is returned unhighlighted.
 */
export function highlightLines(code: string, language: string): Token[][] {
  const lines: Token[][] = [[]]
  if (language !== 'python') {
    return code.split('\n').map((line) => [{ text: line, className: '' }])
  }
  highlightCode(
    code,
    parser.parse(code),
    classHighlighter,
    (text, classes) => lines[lines.length - 1].push({ text, className: classes }),
    () => lines.push([]),
  )
  return lines
}
