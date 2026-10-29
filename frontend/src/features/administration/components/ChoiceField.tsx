import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { CheckCircleIcon, CloseIcon, PlusIcon, SearchIcon } from '../../../components/AppIcons'
import { brandButton, inputClasses, quietButton } from './CourseEditorUi'

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * Pick several answers from a list, or add your own, in a modal. Rendered on
 * `document.body`: the field sits inside the course form, and an Enter in the
 * dialog's own inputs must never submit that form.
 */
function ChoiceDialog({
  title,
  description,
  suggestions,
  selected,
  addPlaceholder,
  onApply,
  onClose,
}: {
  title: string
  description: string
  suggestions: string[]
  selected: string[]
  addPlaceholder: string
  onApply: (items: string[]) => void
  onClose: () => void
}) {
  const titleId = useId()
  const searchRef = useRef<HTMLInputElement>(null)
  const [chosen, setChosen] = useState(selected)
  const [search, setSearch] = useState('')
  const [custom, setCustom] = useState('')
  // Everything that can be ticked: the suggestions, then answers of this course's own.
  const options = [
    ...suggestions,
    ...selected.filter((item) => !suggestions.some((s) => same(s, item))),
  ]
  const extra = chosen.filter((item) => !options.some((option) => same(option, item)))
  const all = [...options, ...extra]
  const visible = all.filter((option) => option.toLowerCase().includes(search.trim().toLowerCase()))

  // The latest `onClose`, so Escape always calls the current one.
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  }, [onClose])
  useEffect(() => {
    searchRef.current?.focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') close.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  function toggle(option: string) {
    setChosen((current) =>
      current.some((item) => same(item, option))
        ? current.filter((item) => !same(item, option))
        : [...current, option],
    )
  }

  function addCustom() {
    const text = custom.trim()
    if (!text) return
    if (!chosen.some((item) => same(item, text))) setChosen((current) => [...current, text])
    setCustom('')
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 px-4 py-6 backdrop-blur-[2px] sm:items-center">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <dialog
        open
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative m-0 flex max-h-[min(40rem,calc(100dvh-3rem))] w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-white p-0 text-left shadow-[0_30px_80px_-24px_rgba(15,23,42,0.45)] ring-1 ring-slate-900/5"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200/80 px-6 pt-5 pb-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold tracking-tight text-slate-900">
              {title}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </header>

        <div className="px-6 pt-4">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search"
              aria-label="Search the list"
              className={`${inputClasses} pl-10`}
            />
          </div>
        </div>

        <ul aria-label={title} className="min-h-0 flex-1 space-y-1 overflow-y-auto px-4 py-3">
          {visible.map((option) => {
            const checked = chosen.some((item) => same(item, option))
            return (
              <li key={option}>
                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 text-sm ring-1 motion-safe:transition-colors ${
                    checked
                      ? 'bg-brand-50/70 text-brand-900 ring-brand-200'
                      : 'text-slate-700 ring-transparent hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(option)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-brand-600"
                  />
                  <span className="min-w-0 flex-1">{option}</span>
                </label>
              </li>
            )
          })}
          {visible.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-slate-500">
              Nothing matches. Add it as your own below.
            </li>
          )}
        </ul>

        <div className="border-t border-slate-200/80 px-6 py-4">
          <div className="flex gap-2">
            <input
              value={custom}
              onChange={(event) => setCustom(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addCustom()
                }
              }}
              placeholder={addPlaceholder}
              aria-label="Add your own"
              className={`${inputClasses} py-2`}
            />
            <button
              type="button"
              onClick={addCustom}
              disabled={!custom.trim()}
              className={`${quietButton} shrink-0 py-2`}
            >
              <PlusIcon className="h-4 w-4" /> Add
            </button>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-sm text-slate-500" aria-live="polite">
              {chosen.length} selected
            </span>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className={quietButton}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onApply(chosen)
                  onClose()
                }}
                className={brandButton}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      </dialog>
    </div>,
    document.body,
  )
}

/**
 * A course's list - who it is for, what learners will be able to do - shown as
 * chips, and chosen in a dialog of ready-made answers plus the author's own.
 */
export function ChoiceField({
  label,
  hint,
  items,
  onChange,
  suggestions,
  chooseLabel,
  dialogTitle,
  dialogDescription,
  addPlaceholder,
  emptyText,
}: {
  label: string
  hint: string
  items: string[]
  onChange: (items: string[]) => void
  suggestions: string[]
  chooseLabel: string
  dialogTitle: string
  dialogDescription: string
  addPlaceholder: string
  emptyText: string
}) {
  const [open, setOpen] = useState(false)
  const listId = useId()
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p id={listId} className="text-sm font-semibold text-slate-800">
            {label}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`${quietButton} px-3 py-1.5 text-xs`}
        >
          <PlusIcon className="h-3.5 w-3.5" /> {chooseLabel}
        </button>
      </div>
      {items.length === 0 ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2.5 w-full rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500 hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
        >
          {emptyText}
        </button>
      ) : (
        <ul aria-labelledby={listId} className="mt-2.5 flex flex-wrap gap-2">
          {items.map((item) => (
            <li
              key={item}
              className="inline-flex max-w-full items-center gap-1.5 rounded-xl bg-white py-1.5 pr-1.5 pl-2.5 text-sm text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 ring-slate-200"
            >
              <CheckCircleIcon className="h-4 w-4 shrink-0 text-brand-500" />
              <span className="min-w-0">{item}</span>
              <button
                type="button"
                onClick={() => onChange(items.filter((other) => other !== item))}
                aria-label={`Remove “${item}”`}
                title="Remove"
                className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <ChoiceDialog
          title={dialogTitle}
          description={dialogDescription}
          suggestions={suggestions}
          selected={items}
          addPlaceholder={addPlaceholder}
          onApply={onChange}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
