import { useEffect, useRef, useState } from 'react'

import { myEnquiryRequest, sendEnquiry, type Enquiry, type MarketIdea } from '../api/marketplaceApi'

/** Questions a buyer can start from with one tap. */
const STARTERS = [
  'What exactly is in the document?',
  'Would this work for an organisation like mine?',
  'How long would it take to put in place?',
  'How do I pay, and how soon do I get access?',
]

function when(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ChatIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12Z" />
      <path d="M8.5 11h.01M12 11h.01M15.5 11h.01" strokeWidth="2.6" />
    </svg>
  )
}

function CloseIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

/**
 * The buyer's conversation with the team behind an idea - what is inside, whether it fits,
 * how to pay - as a chat icon in the corner of the page that opens into a panel and hides
 * again on a click. The team is notified of each message, and the buyer of each answer.
 */
export function EnquirySection({ idea }: { idea: MarketIdea }) {
  const [open, setOpen] = useState(false)
  const [enquiry, setEnquiry] = useState<Enquiry | null | undefined>(undefined)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const endRef = useRef<HTMLLIElement>(null)
  const panelId = `enquiry-panel-${idea.id}`

  // The conversation is fetched when the panel is first opened, not before.
  const loaded = enquiry !== undefined
  useEffect(() => {
    if (!open || loaded) return
    let cancelled = false
    myEnquiryRequest(idea.id)
      .then((answer) => {
        if (!cancelled) setEnquiry(answer)
      })
      .catch(() => {
        if (!cancelled) setEnquiry(null)
      })
    return () => {
      cancelled = true
    }
  }, [open, loaded, idea.id])

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  const messages = enquiry?.messages ?? []

  async function send() {
    if (!body.trim()) return
    setBusy(true)
    setError(null)
    try {
      const result = await sendEnquiry({ ideaId: idea.id, body })
      if (result.success && result.enquiry) {
        setEnquiry(result.enquiry)
        setBody('')
        // Bring the message just sent into view.
        requestAnimationFrame(() => endRef.current?.scrollIntoView?.({ block: 'nearest' }))
      } else setError(result.message)
    } catch {
      setError('We could not reach the server. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {open && (
        <section
          id={panelId}
          aria-labelledby={`${panelId}-heading`}
          className="fixed right-4 bottom-24 z-40 flex max-h-[min(36rem,calc(100dvh-8rem))] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10 sm:right-6 sm:w-[24rem]"
        >
          <div className="flex items-start gap-3 bg-gradient-to-br from-brand-800 to-brand-600 px-5 py-4 text-white">
            <div className="min-w-0 flex-1">
              <h2 id={`${panelId}-heading`} className="text-base font-bold">
                {idea.hasAccess ? 'Questions about this idea?' : 'Have a question before you buy?'}
              </h2>
              <p className="mt-0.5 text-xs leading-5 text-white/80">
                Ask the team anything - what is inside, whether it fits, or how to pay. You will be
                notified when they answer.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Hide messages"
              className="-mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/80 hover:bg-white/15 hover:text-white"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50 px-4 py-4">
            {enquiry === undefined ? (
              <p className="py-6 text-center text-sm text-gray-500">Loading…</p>
            ) : messages.length === 0 ? (
              <div>
                <p className="text-sm text-gray-600">Start with one of these, or write your own:</p>
                <div
                  className="mt-3 flex flex-col items-start gap-2"
                  aria-label="Suggested questions"
                >
                  {STARTERS.map((starter) => (
                    <button
                      key={starter}
                      type="button"
                      onClick={() => {
                        setBody(starter)
                        inputRef.current?.focus()
                      }}
                      className="rounded-2xl rounded-bl-sm border border-gray-200 bg-white px-3 py-2 text-left text-sm text-gray-700 shadow-sm hover:border-brand-400 hover:text-brand-800"
                    >
                      {starter}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <ol aria-label="Conversation" className="space-y-3">
                {messages.map((message) => (
                  <li
                    key={message.id}
                    className={`flex ${message.fromTeam ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                        message.fromTeam
                          ? 'rounded-bl-sm bg-white text-gray-800 ring-1 ring-gray-200'
                          : 'rounded-br-sm bg-brand-600 text-white'
                      }`}
                    >
                      <p className="text-[11px] font-semibold opacity-75">
                        {message.fromTeam ? 'The team' : 'You'} · {when(message.createdAt)}
                      </p>
                      <p className="mt-0.5 whitespace-pre-line">{message.body}</p>
                    </div>
                  </li>
                ))}
                {enquiry?.awaitingReply && (
                  <li className="text-center text-xs text-gray-500">
                    Sent. The team will answer here, and you will be notified.
                  </li>
                )}
                <li ref={endRef} aria-hidden="true" />
              </ol>
            )}
          </div>

          <form
            aria-label="Message the team"
            className="border-t border-gray-200 bg-white p-3"
            onSubmit={(event) => {
              event.preventDefault()
              void send()
            }}
          >
            <label htmlFor={`${panelId}-body`} className="sr-only">
              Your message
            </label>
            <div className="flex items-end gap-2">
              <textarea
                id={`${panelId}-body`}
                ref={inputRef}
                rows={2}
                maxLength={2000}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void send()
                  }
                }}
                placeholder="Write your question…"
                className="block min-w-0 flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy || !body.trim()}
                className="inline-flex h-10 items-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? 'Sending…' : 'Send'}
              </button>
            </div>
            {error && (
              <p role="alert" className="mt-2 text-sm text-red-700">
                {error}
              </p>
            )}
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? 'Hide messages' : 'Ask the team a question'}
        title={open ? 'Hide messages' : 'Ask the team a question'}
        className="fixed right-4 bottom-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg ring-4 ring-white transition hover:scale-105 hover:bg-brand-700 sm:right-6"
      >
        {open ? <CloseIcon /> : <ChatIcon />}
      </button>
    </>
  )
}
