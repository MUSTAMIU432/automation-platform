import type { Idea } from '../api/ideasApi'

/*
  The journey's steps, named for a reader, in the order the backend draws them
  (`ideas.states.stages_for`): an individual idea goes straight to the platform; a
  team or organization idea is checked by its own people first. The server says
  how many steps there are and which one the idea is on; these are only the
  names, and they are used only when their count agrees with the server's.
*/
const DIRECT = ['Created', 'Under review', 'Approved', 'Implementation']
const CHECKED_FIRST = [
  'Created',
  'Team or org review',
  'Confirmed',
  'Under review',
  'Approved',
  'Implementation',
]

/** The step names for this idea, or null when they would not match the server's count. */
export function stageLabels(idea: Idea): string[] | null {
  const labels = idea.submissionContext === 'INDIVIDUAL' ? DIRECT : CHECKED_FIRST
  return labels.length === idea.state.stageCount ? labels : null
}
