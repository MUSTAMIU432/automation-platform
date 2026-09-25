import { CreateOrganizationForm } from './CreateOrganizationForm'
import { OrganizationList } from './OrganizationList'

export function OrganizationWorkspace() {
  return (
    <section aria-labelledby="organizations-heading" className="mt-8">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
            Workspace
          </p>
          <h2
            id="organizations-heading"
            className="mt-1 text-2xl font-semibold tracking-tight text-gray-900"
          >
            Your organizations
          </h2>
        </div>
        <p className="max-w-md text-sm leading-6 text-gray-600">
          Choose an organization for shared work, or create a new one when you are ready.
        </p>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
        <OrganizationList />
        <CreateOrganizationForm />
      </div>
    </section>
  )
}
