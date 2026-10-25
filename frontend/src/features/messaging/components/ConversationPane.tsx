import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'

import { ArrowLeftIcon, SendIcon } from '../../../components/AppIcons'
import { useAuth } from '../../identity/auth/AuthContext'
import { SpinnerIcon } from '../../identity/components/icons'
import {
  markThreadReadRequest,
  participantSummary,
  type Message,
  type MessageThreadSummary,
} from '../api/messagingApi'
import { useThreadMessages } from '../hooks/useMessages'
import { clockTime, dayLabel, sameDay } from '../utils/messageTime'
import { messengerBandClasses } from '../utils/messengerStyles'
import { MessengerWave, ParticipantAvatar } from './MessengerParts'

/**
 * One open conversation: who it is with, its messages by day, and the composer.
 *
 * **Reachable only by somebody in it.** `threadMessages` answers empty for a
 * thread the caller is not in *and* for one that does not exist, so this pane
 * cannot become a way of finding out whether a conversation exists - it says the
 * thread is unavailable and offers the list, which is all the caller can read
 * anyway.
 *
 * Opening a conversation is what "read" means here, so this pane marks it read
 * on arrival: a read position that only moves when somebody presses something is
 * a read position that lies about what they have seen.
 *
 * `summary` is the conversation's row from the list beside it, so the header
 * names the same people the list does without a second request; it is `null`
 * while the list loads and for a thread the caller is not in.
 */
export function ConversationPane({
  threadId,
  summary,
  onSent,
}: {
  threadId: string
  summary: MessageThreadSummary | null
  onSent: () => void
}) {
  const { user } = useAuth()
  const { messages, loading, error, post } = useThreadMessages(threadId)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)
  // A second submission in one tick is dropped by a ref, not by state: state
  // cannot be read synchronously from a click handler, and a double-posted
  // message is a duplicate somebody has to delete by hand.
  const inFlight = useRef(false)
  const lastRead = useRef<string | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const form = useRef<HTMLFormElement>(null)

  /*
    The read position moves on arrival, once per thread, guarded by a ref rather
    than by state: opening the same thread twice should not send the request
    twice, and state cannot be read synchronously to make that decision.
  */
  useEffect(() => {
    if (threadId === '' || lastRead.current === threadId) return
    lastRead.current = threadId
    markThreadReadRequest(threadId).catch(() => {
      // A read position that could not be moved is not worth interrupting the
      // conversation for; it moves the next time the thread is opened.
    })
  }, [threadId])

  // The newest message is at the bottom, so that is where the reader starts,
  // and where a reply they just sent appears.
  const newestId = messages.at(-1)?.id ?? null
  useEffect(() => {
    const element = scroller.current
    if (newestId !== null && element) element.scrollTop = element.scrollHeight
  }, [newestId])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    const trimmed = body.trim()
    if (!trimmed) return

    inFlight.current = true
    setSending(true)
    setRefusal(null)
    try {
      const result = await post(trimmed)
      if (result.success) {
        setBody('')
        // The list beside this pane shows the latest message and orders by it.
        onSent()
        return
      }
      // A refusal keeps the words in the box: the reader has not lost what they
      // wrote, and the message says why nothing was sent.
      setRefusal(result.message)
    } catch {
      setRefusal('We could not reach the server, so your message was not sent.')
    } finally {
      setSending(false)
      inFlight.current = false
    }
  }

  // Enter sends, Shift+Enter starts a new line - except mid-composition in an
  // input method, where Enter picks the characters rather than sending them.
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    form.current?.requestSubmit()
  }

  const people = summary?.otherParticipants ?? []
  const isGroup = people.length > 1
  const subtitle = summary
    ? summary.thread.ideaTitle
      ? `About: ${summary.thread.ideaTitle}`
      : isGroup
        ? `${people.length + 1} people`
        : 'Direct message'
    : ''

  return (
    <>
      <header className={`relative px-4 pt-4 pb-10 sm:px-6 ${messengerBandClasses}`}>
        <div className="flex items-center gap-3">
          <Link
            to="/app/messages"
            aria-label="All conversations"
            className="-ml-1 rounded-full p-2 hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 md:hidden"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          {summary && <ParticipantAvatar people={people} size="lg" />}
          <div className="min-w-0 flex-1">
            <h2 id="thread-heading" className="truncate text-lg font-bold">
              {summary ? participantSummary(people) : 'Conversation'}
            </h2>
            {subtitle && <p className="truncate text-xs text-white/80">{subtitle}</p>}
          </div>
        </div>
        <MessengerWave edge="bottom" />
      </header>

      <div
        ref={scroller}
        className="min-h-0 flex-1 overflow-y-auto px-4 pt-2 pb-6 sm:px-6"
        aria-labelledby="thread-heading"
      >
        {loading && messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-600">Loading this conversation…</p>
        ) : error ? (
          <div
            role="alert"
            className="mx-auto mt-6 max-w-md rounded-2xl border border-red-200 bg-red-50 p-5"
          >
            <p className="text-sm font-semibold text-red-800">Conversation unavailable</p>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <Link
              to="/app/messages"
              className="mt-4 inline-block text-sm font-semibold text-brand-700 hover:text-brand-800"
            >
              Back to your conversations
            </Link>
          </div>
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-600">No messages yet. Say something.</p>
        ) : (
          <ul aria-label="Messages">
            {messages.map((message, index) => (
              <MessageItem
                key={message.id}
                message={message}
                previous={messages[index - 1] ?? null}
                mine={message.senderId === user?.id}
                showSender={isGroup}
              />
            ))}
          </ul>
        )}
      </div>

      {!error && (
        <form
          ref={form}
          className={`relative px-4 pt-9 pb-4 sm:px-6 ${messengerBandClasses}`}
          onSubmit={handleSubmit}
          noValidate
        >
          <MessengerWave edge="top" />
          {/* A refusal is said, and the words stay: the reader has not lost
              what they wrote, and the message says why nothing was sent. */}
          {refusal ? (
            <p
              role="alert"
              className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 shadow"
            >
              {refusal}
            </p>
          ) : null}
          <div className="flex items-end gap-3">
            <label className="sr-only" htmlFor="message-body">
              Write a message
            </label>
            <textarea
              id="message-body"
              rows={1}
              maxLength={5000}
              placeholder="Type your message here…"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
              aria-invalid={refusal !== null}
              className={`field-sizing-content block max-h-40 min-h-11 w-full resize-none rounded-2xl border bg-white px-4 py-2.5 text-sm text-gray-900 shadow-lg shadow-brand-900/20 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white/70 disabled:opacity-70 ${
                refusal ? 'border-red-300' : 'border-white/60'
              }`}
            />
            <button
              type="submit"
              aria-label="Send"
              disabled={sending || body.trim() === ''}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-brand-700 shadow-lg shadow-brand-900/25 hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-60 motion-safe:transition-colors"
            >
              {sending ? (
                <SpinnerIcon className="h-5 w-5 motion-safe:animate-spin" />
              ) : (
                <SendIcon className="h-5 w-5" />
              )}
            </button>
          </div>
          <p className="mt-2 hidden text-[11px] text-white/75 sm:block">
            Enter to send · Shift + Enter for a new line
          </p>
        </form>
      )}
    </>
  )
}

/**
 * One message, with the day's divider above it when it opens a new day. A run of
 * messages from the same person sits close together and is named once, in a
 * group conversation, at the top of the run.
 */
function MessageItem({
  message,
  previous,
  mine,
  showSender,
}: {
  message: Message
  previous: Message | null
  mine: boolean
  showSender: boolean
}) {
  const newDay = previous === null || !sameDay(previous.createdAt, message.createdAt)
  const runStart = newDay || previous === null || previous.senderId !== message.senderId

  return (
    <>
      {newDay && (
        <li className="flex justify-center pt-4 pb-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-gray-600">
            {dayLabel(message.createdAt)}
          </span>
        </li>
      )}
      <li
        className={`flex ${mine ? 'justify-end' : 'justify-start'} ${runStart ? 'mt-3' : 'mt-1'}`}
      >
        <div className="max-w-[85%] md:max-w-[70%] xl:max-w-[60%]">
          {!mine && showSender && runStart && (
            <p className="mb-1 ml-3 text-xs font-semibold text-brand-700">
              {message.senderFirstName}
            </p>
          )}
          <div
            className={`rounded-2xl px-4 py-2.5 text-sm leading-6 shadow-sm ${
              mine
                ? 'rounded-br-md bg-linear-to-br from-brand-600 to-teal-600 text-white'
                : 'rounded-bl-md bg-brand-50 text-gray-800 ring-1 ring-brand-100'
            }`}
          >
            <p className="break-words whitespace-pre-wrap">{message.body}</p>
            <p
              className={`mt-1 text-right text-[11px] ${mine ? 'text-white/75' : 'text-gray-500'}`}
            >
              <span className="sr-only">{mine ? 'You' : message.senderFirstName}, </span>
              <time dateTime={message.createdAt}>{clockTime(message.createdAt)}</time>
            </p>
          </div>
        </div>
      </li>
    </>
  )
}
