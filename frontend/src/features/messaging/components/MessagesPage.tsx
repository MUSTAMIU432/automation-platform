import { Messenger } from './Messenger'

/** The caller's conversations at `/app/messages`; see `Messenger`. */
export function MessagesPage() {
  return <Messenger activeThreadId={null} />
}
