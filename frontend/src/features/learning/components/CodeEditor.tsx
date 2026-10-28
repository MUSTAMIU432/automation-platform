import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { python } from '@codemirror/lang-python'
import { bracketMatching, indentOnInput, syntaxHighlighting } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view'
import { classHighlighter } from '@lezer/highlight'
import { useEffect, useRef } from 'react'

/**
 * A Python code editor (CodeMirror 6): line numbers, indentation, Tab to indent,
 * undo history and syntax highlighting with the same token classes as the
 * lesson examples. Controlled from outside: `value` replaces the document when it
 * differs from what is in the editor, and every edit is reported by `onChange`.
 *
 * Tab indents rather than moving focus, as a code editor's Tab does; press Escape
 * then Tab to leave the editor with the keyboard.
 */
export function CodeEditor({
  value,
  onChange,
  label,
  minHeight = '18rem',
  readOnly = false,
}: {
  value: string
  onChange?: (value: string) => void
  label: string
  minHeight?: string
  readOnly?: boolean
}) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const changed = useRef(onChange)
  changed.current = onChange

  useEffect(() => {
    if (!host.current) return
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          history(),
          indentOnInput(),
          bracketMatching(),
          python(),
          syntaxHighlighting(classHighlighter),
          keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
          EditorState.readOnly.of(readOnly),
          EditorView.contentAttributes.of({ 'aria-label': label }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) changed.current?.(update.state.doc.toString())
          }),
          EditorView.theme({
            '&': { minHeight, fontSize: '13.5px' },
            '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
          }),
        ],
      }),
    })
    view.current = editor
    return () => {
      editor.destroy()
      view.current = null
    }
    // The editor is created once; `value` changes are applied below.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [])

  useEffect(() => {
    const editor = view.current
    if (editor && editor.state.doc.toString() !== value) {
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } })
    }
  }, [value])

  return (
    <div
      ref={host}
      className="code-editor overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-[inset_0_1px_2px_rgba(15,74,55,0.06)] focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100"
    />
  )
}
