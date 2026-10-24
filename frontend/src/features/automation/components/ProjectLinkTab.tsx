import { Link } from 'react-router-dom'

import { ArrowRightIcon, CodeIcon } from '../../../components/AppIcons'
import { projectForOpportunityRequest, type Opportunity } from '../api/automationApi'
import { useLoad } from '../utils/useLoad'
import { Badge, Empty, Loading, LoadFailed } from './ui'

/** The way from an opportunity to the project that delivers it. */
export function ProjectLinkTab({ opportunity }: { opportunity: Opportunity }) {
  const loaded = useLoad(
    () => projectForOpportunityRequest(opportunity.id),
    `oppproj:${opportunity.id}:${opportunity.status}`,
  )
  if (loaded.loading) return <Loading what="the project" />
  if (loaded.failed) return <LoadFailed what="the project" onRetry={loaded.reload} />
  if (!loaded.data) {
    return (
      <Empty title="No project yet.">
        A project is created once the opportunity is assigned to a developer or team.
      </Empty>
    )
  }
  const project = loaded.data
  const percent = project.progress.taskCompletionPercent
  return (
    <section
      aria-label="Project"
      className="rounded-3xl border border-white bg-white/90 p-5 shadow-[0_16px_40px_-30px_rgba(8,75,56,0.5)] sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-4">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-200/80 to-violet-50 text-violet-600"
          >
            <CodeIcon className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <p className="text-base font-bold text-ink">{project.title}</p>
            <p className="mt-0.5 text-xs text-sage">Delivered by {project.assignedName}</p>
          </div>
        </div>
        <Badge value={project.status} />
      </div>
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-sage">
          <span>
            {percent === null
              ? 'No tasks yet'
              : `${project.progress.tasksDone} of ${project.progress.tasksTotal} tasks done`}
          </span>
          {percent !== null && <span className="font-semibold text-ink">{percent}%</span>}
        </div>
        <div aria-hidden="true" className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-jade/10">
          <div className="h-full rounded-full bg-jade" style={{ width: `${percent ?? 0}%` }} />
        </div>
      </div>
      <Link
        to={`/app/automation/projects/${project.id}`}
        className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-forest px-4 text-sm font-semibold text-white hover:bg-pine focus:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
      >
        View project
        <ArrowRightIcon className="h-4 w-4" />
      </Link>
    </section>
  )
}
