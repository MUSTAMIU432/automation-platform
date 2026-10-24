import { Link } from 'react-router-dom'

import { projectsRequest, type Project } from '../api/automationApi'
import { CONTEXT_LABEL } from '../utils/labels'
import { ArrowRightIcon, CodeIcon } from '../../../components/AppIcons'
import { deliveryCardClass } from '../utils/deliverySteps'
import { useLoad } from '../utils/useLoad'
import { DeliveryTracker } from './DeliverySteps'
import { Badge, Empty, Loading, LoadFailed } from './ui'

function ProjectCard({ project }: { project: Project }) {
  const percent = project.progress.taskCompletionPercent
  return (
    <li>
      <Link to={`/app/automation/projects/${project.id}`} className={deliveryCardClass}>
        <span className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-200/80 to-violet-50 text-violet-600"
          >
            <CodeIcon className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-start justify-between gap-2">
              <span className="min-w-0">
                <span className="block text-base font-bold text-ink">{project.title}</span>
                <span className="mt-0.5 block text-xs text-sage">
                  {CONTEXT_LABEL[project.submissionContext]}
                  {project.tenantName ? ` · ${project.tenantName}` : ''} · Delivered by{' '}
                  {project.assignedName}
                </span>
              </span>
              <Badge value={project.status} />
            </span>
            <span className="mt-3 block">
              <span className="flex items-center justify-between text-xs text-sage">
                <span>
                  {percent === null
                    ? 'No tasks yet'
                    : `${project.progress.tasksDone} of ${project.progress.tasksTotal} tasks done`}
                </span>
                {percent !== null && <span className="font-semibold text-ink">{percent}%</span>}
              </span>
              <span
                aria-hidden="true"
                className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-jade/10"
              >
                <span
                  className="block h-full rounded-full bg-jade"
                  style={{ width: `${percent ?? 0}%` }}
                />
              </span>
            </span>
            <span className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3">
              <DeliveryTracker status={project.status} />
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-jade">
                View
                <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </span>
          </span>
        </span>
      </Link>
    </li>
  )
}

/** Every project the reader may see. */
export function ProjectsPage() {
  const projects = useLoad(() => projectsRequest(), 'projects')

  return (
    <section aria-labelledby="projects-heading" className="mt-6">
      <div className="flex items-center gap-3">
        <h2 id="projects-heading" className="text-xl font-bold text-ink">
          Projects
        </h2>
        {projects.data && (
          <span className="rounded-full bg-mist px-3 py-1 text-sm font-semibold text-jade ring-1 ring-inset ring-jade/15">
            {projects.data.length}
          </span>
        )}
      </div>
      {projects.loading ? (
        <Loading what="projects" />
      ) : projects.failed ? (
        <LoadFailed what="the projects" onRetry={projects.reload} />
      ) : projects.data && projects.data.length > 0 ? (
        <ul className="mt-4 space-y-4">
          {projects.data.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </ul>
      ) : (
        <div className="mt-4">
          <Empty title="No projects yet.">
            A project is created once an opportunity has an accepted proposal and a developer.
          </Empty>
        </div>
      )}
    </section>
  )
}
