import type { Project } from '../api/automationApi'
import { StagesPanel } from './StagesPanel'

/**
 * The project's work: its stages, each with the tasks that make it up, the developer's
 * report and the delivery manager's decision.
 */
export function WorkTab({ project, onChanged }: { project: Project; onChanged: () => void }) {
  return (
    <section aria-labelledby="stages-heading" className="space-y-3">
      <h3 id="stages-heading" className="text-lg font-bold text-gray-900">
        Stages
      </h3>
      <StagesPanel project={project} onChanged={onChanged} />
    </section>
  )
}
