import type { AdminCourseListItem } from '../api/courseAuthoringApi'
import { Badge } from './AdminUi'

const TONES = { draft: 'warn', published: 'good', archived: 'neutral' } as const

/** Draft, Published or Archived, in the console's badge colours. */
export function CourseStatusBadge({ status }: { status: AdminCourseListItem['status'] }) {
  return <Badge tone={TONES[status]}>{status[0].toUpperCase() + status.slice(1)}</Badge>
}
