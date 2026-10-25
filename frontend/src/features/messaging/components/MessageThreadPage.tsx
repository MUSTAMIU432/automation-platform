import { useParams } from 'react-router-dom'

import { Messenger } from './Messenger'

/** One conversation at `/app/messages/:threadId`, beside the list; see `Messenger`. */
export function MessageThreadPage() {
  const { threadId = '' } = useParams()
  return <Messenger activeThreadId={threadId || null} />
}
