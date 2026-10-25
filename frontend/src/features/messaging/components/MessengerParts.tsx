import { Avatar } from '../../identity/components/Avatar'
import type { MessageAuthor } from '../api/messagingApi'

/**
 * The soft wave where a teal band meets the white body. `edge="bottom"` sits at
 * the foot of a header, `edge="top"` at the head of the composer.
 */
export function MessengerWave({ edge }: { edge: 'top' | 'bottom' }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 400 40"
      preserveAspectRatio="none"
      className={`pointer-events-none absolute inset-x-0 h-8 w-full fill-white ${
        edge === 'bottom' ? '-bottom-px' : '-top-px rotate-180'
      }`}
    >
      <path d="M0 40V24C70 4 130 0 205 16S335 36 400 10V40Z" />
    </svg>
  )
}

/**
 * Who a conversation is with, as a face: the other person's photo or initials,
 * and a "+N" chip when there is more than one of them. `highlight` rings it, the
 * way the list marks a conversation with unread messages.
 */
export function ParticipantAvatar({
  people,
  size = 'md',
  highlight = false,
}: {
  people: MessageAuthor[]
  size?: 'md' | 'lg'
  highlight?: boolean
}) {
  const first = people[0] ?? null
  const extra = people.length - 1
  const dimensions = size === 'lg' ? 'h-12 w-12 text-sm' : 'h-11 w-11 text-sm'

  return (
    <span className="relative shrink-0">
      <Avatar
        user={first}
        className={`flex ${dimensions} items-center justify-center rounded-full bg-linear-to-br from-brand-500 to-teal-600 font-bold text-white ${
          highlight ? 'ring-2 ring-teal-400 ring-offset-2 ring-offset-white' : 'ring-2 ring-white'
        }`}
      />
      {extra > 0 && (
        <span className="absolute -right-1 -bottom-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-brand-700 shadow ring-1 ring-brand-100">
          +{extra}
        </span>
      )}
    </span>
  )
}
