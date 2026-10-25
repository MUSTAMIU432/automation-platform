import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { ChatIcon, SearchIcon } from '../../../components/AppIcons'
import { useAuth } from '../../identity/auth/AuthContext'
import { Avatar } from '../../identity/components/Avatar'
import { participantSummary, type MessageThreadSummary } from '../api/messagingApi'
import { useMessageThreads } from '../hooks/useMessages'
import { listTime } from '../utils/messageTime'
import { messengerBandClasses } from '../utils/messengerStyles'
import { ConversationPane } from './ConversationPane'
import { MessengerWave, ParticipantAvatar } from './MessengerParts'

/**
 * The messenger behind `/app/messages` and `/app/messages/:threadId`: the
 * caller's conversations on the left and the open one on the right.
 *
 * **Private messages are not comments.** A conversation is between the people
 * who were put in it, and access comes from that participant list rather than
 * from the idea it may be anchored to - so this shows only what the server
 * returned, and there is deliberately no "messages about this idea" view.
 *
 * One `useMessageThreads` feeds both panes, so the list and the open
 * conversation's header can never disagree about who it is with, and the list
 * and its unread counts are a single request.
 *
 * On a phone the two panes take turns: the list at `/app/messages`, the
 * conversation (with a way back) once one is open.
 */
export function Messenger({ activeThreadId }: { activeThreadId: string | null }) {
  const { threads, loading, error, reload } = useMessageThreads()
  const active = threads.find((entry) => entry.thread.id === activeThreadId) ?? null

  return (
    <section aria-labelledby="messages-heading" className="mt-2">
      <div className="grid h-[calc(100dvh-var(--app-chrome-height,0px)-2rem)] min-h-[34rem] overflow-hidden rounded-3xl border border-white bg-white shadow-[0_24px_60px_-32px_rgba(8,75,56,0.5)] ring-1 ring-slate-900/5 md:grid-cols-[18rem_1fr] lg:grid-cols-[22rem_1fr] xl:grid-cols-[24rem_1fr]">
        <div
          className={`${activeThreadId ? 'hidden md:flex' : 'flex'} min-h-0 flex-col md:border-r md:border-slate-100`}
        >
          <ConversationList
            threads={threads}
            loading={loading}
            error={error}
            reload={reload}
            activeThreadId={activeThreadId}
          />
        </div>
        <div className={`${activeThreadId ? 'flex' : 'hidden md:flex'} min-h-0 flex-col`}>
          {activeThreadId ? (
            <ConversationPane
              key={activeThreadId}
              threadId={activeThreadId}
              summary={active}
              onSent={reload}
            />
          ) : (
            <NoConversationOpen />
          )}
        </div>
      </div>
    </section>
  )
}

function ConversationList({
  threads,
  loading,
  error,
  reload,
  activeThreadId,
}: {
  threads: MessageThreadSummary[]
  loading: boolean
  error: string | null
  reload: () => void
  activeThreadId: string | null
}) {
  const { user } = useAuth()
  const [query, setQuery] = useState('')

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return threads
    return threads.filter(({ thread, otherParticipants, latestMessage }) =>
      [
        ...otherParticipants.flatMap((person) => [person.firstName, person.lastName, person.email]),
        thread.ideaTitle,
        thread.subject,
        latestMessage?.body ?? '',
      ].some((text) => text.toLowerCase().includes(needle)),
    )
  }, [threads, query])

  // The open conversation was just read, whatever the list loaded with.
  const unreadOf = (entry: MessageThreadSummary) =>
    entry.thread.id === activeThreadId ? 0 : entry.unreadCount
  const unreadTotal = threads.filter((entry) => unreadOf(entry) > 0).length

  return (
    <>
      <div className={`relative px-5 pt-5 pb-11 ${messengerBandClasses}`}>
        <div className="flex items-center justify-between gap-3">
          <h1 id="messages-heading" className="text-2xl font-bold tracking-tight">
            Messages
          </h1>
          <Avatar
            user={user}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white ring-2 ring-white/70"
          />
        </div>
        <label className="sr-only" htmlFor="conversation-search">
          Search conversations
        </label>
        <div className="relative mt-4">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            id="conversation-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            className="h-11 w-full rounded-xl border border-white/60 bg-white pr-3 pl-10 text-sm text-gray-900 shadow-lg shadow-brand-900/20 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white/70"
          />
        </div>
        <MessengerWave edge="bottom" />
      </div>

      <div className="flex items-baseline justify-between px-5 pt-1 pb-2">
        <h2 className="text-base font-bold text-gray-900">Recent</h2>
        {unreadTotal > 0 && (
          <span className="text-xs font-semibold text-brand-700">{unreadTotal} unread</span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {loading && threads.length === 0 ? (
          <p className="px-2 py-4 text-sm text-gray-600">Loading your conversations…</p>
        ) : error ? (
          <div className="m-2 rounded-2xl border border-red-200 bg-red-50 p-4" role="alert">
            <p className="text-sm font-semibold text-red-800">Conversations unavailable</p>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <button
              type="button"
              onClick={reload}
              className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
            >
              Try again
            </button>
          </div>
        ) : threads.length === 0 ? (
          <div className="px-2 py-6 text-center">
            <p className="text-sm text-gray-600">You are not in any conversations yet.</p>
            <p className="mt-1 text-xs text-gray-500">
              Message somebody from an idea and the conversation will appear here.
            </p>
          </div>
        ) : shown.length === 0 ? (
          <p className="px-2 py-4 text-sm text-gray-600">
            No conversations match “{query.trim()}”.
          </p>
        ) : (
          <ul className="space-y-1" aria-label="Conversations">
            {shown.map((entry) => (
              <ConversationRow
                key={entry.thread.id}
                entry={entry}
                unread={unreadOf(entry)}
                active={entry.thread.id === activeThreadId}
                viewerId={user?.id ?? null}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

function ConversationRow({
  entry,
  unread,
  active,
  viewerId,
}: {
  entry: MessageThreadSummary
  unread: number
  active: boolean
  viewerId: string | null
}) {
  const { thread, otherParticipants, latestMessage } = entry
  const mine = latestMessage !== null && latestMessage.senderId === viewerId

  return (
    <li>
      <Link
        to={`/app/messages/${thread.id}`}
        aria-current={active ? 'page' : undefined}
        className={`flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${
          active ? 'bg-brand-50 ring-1 ring-brand-100' : 'hover:bg-slate-50'
        }`}
      >
        <ParticipantAvatar people={otherParticipants} highlight={unread > 0} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span
              className={`truncate text-sm ${unread > 0 ? 'font-bold' : 'font-semibold'} text-gray-900`}
            >
              {participantSummary(otherParticipants)}
            </span>
            <time
              dateTime={thread.latestMessageAt}
              className={`shrink-0 text-xs ${unread > 0 ? 'font-semibold text-brand-700' : 'text-gray-500'}`}
            >
              {listTime(thread.latestMessageAt)}
            </time>
          </span>
          <span className="mt-0.5 flex items-center justify-between gap-2">
            <span
              className={`truncate text-sm ${unread > 0 ? 'font-medium text-gray-800' : 'text-gray-500'}`}
            >
              {latestMessage ? (
                <>
                  {mine && <span className="text-gray-400">You: </span>}
                  {latestMessage.body}
                </>
              ) : (
                'No messages yet.'
              )}
            </span>
            {unread > 0 && (
              <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
                <span aria-hidden="true">{unread}</span>
                <span className="sr-only">{unread} new</span>
              </span>
            )}
          </span>
          {thread.ideaTitle ? (
            <span className="mt-1 block truncate text-xs text-brand-700">
              About: {thread.ideaTitle}
            </span>
          ) : null}
        </span>
      </Link>
    </li>
  )
}

/** The right-hand pane before a conversation is picked (wide screens only). */
function NoConversationOpen() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_40%,var(--color-brand-50),white_60%)] px-8 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-linear-to-br from-brand-500 to-teal-500 text-white shadow-[0_16px_32px_-14px_rgba(20,99,73,0.7)]">
        <ChatIcon className="h-8 w-8" />
      </span>
      <h2 className="mt-5 text-lg font-bold text-gray-900">Select a conversation</h2>
      <p className="mt-1 max-w-sm text-sm leading-6 text-gray-600">
        Pick someone from the list to read and reply. Only the people in a conversation can read it.
      </p>
    </div>
  )
}
