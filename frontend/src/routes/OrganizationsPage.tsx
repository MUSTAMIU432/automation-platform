import { Link } from 'react-router-dom'

import {
  ArrowRightIcon,
  BuildingIcon,
  ChartIcon,
  LockIcon,
  UsersIcon,
} from '../components/AppIcons'
import { collectionCardClasses } from '../components/glassStyles'
import { CityArt } from '../components/WorkspaceArt'
import { CollectionHero, EmptyCollection } from '../components/WorkspaceCollection'
import { CreateOrganizationForm } from '../features/organizations/components/CreateOrganizationForm'
import { useOrganization } from '../features/organizations/context/useOrganization'

const NAME_INPUT_ID = 'create-organization-name'

/** Takes the reader from the empty state to the form's first field. */
function focusCreateForm() {
  const input = document.getElementById(NAME_INPUT_ID)
  input?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
  input?.focus({ preventScroll: true })
}

/**
 * The caller's organizations at `/app/organizations`.
 *
 * Opening one is how a person chooses where they are working: its page shows the
 * ideas it has put forward and, for a reviewer, the review queue. There is no
 * header switcher any more - the list is the way in, like Teams.
 */
export function OrganizationsPage() {
  const { status, memberships, error, reload } = useOrganization()

  return (
    <>
      <CollectionHero
        title="Your organizations"
        description="Open an organization to see its ideas, its members and, if you review for it, the queue of ideas its people have sent in - or create one to start working together."
        art={<CityArt className="h-auto w-full" />}
      />

      <section aria-labelledby="organizations-heading" className="mt-8">
        <h2 id="organizations-heading" className="sr-only">
          Organizations you are in
        </h2>
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <div>
            {status === 'loading' && memberships.length === 0 ? (
              <output className="block text-sm text-gray-600">Loading organizations…</output>
            ) : status === 'error' ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-5" role="alert">
                <p className="text-sm text-red-700">{error}</p>
                <button
                  type="button"
                  onClick={() => void reload()}
                  className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-100"
                >
                  Try again
                </button>
              </div>
            ) : memberships.length === 0 ? (
              <EmptyCollection
                Icon={BuildingIcon}
                title="No organizations yet"
                actionLabel="Create your first organization"
                onAction={focusCreateForm}
                benefits={[
                  [UsersIcon, 'Work together', 'Invite members and collaborate'],
                  [LockIcon, 'Manage access', 'Control roles and permissions'],
                  [ChartIcon, 'Stay organized', 'Ideas and reviews in one place'],
                ]}
              >
                Create one to give your work a shared home. You can invite members, review ideas and
                follow them through to delivery together.
              </EmptyCollection>
            ) : (
              <div className={collectionCardClasses}>
                <p className="text-lg font-bold text-gray-900">Organizations you are in</p>
                <ul className="mt-4 space-y-3" aria-label="Your organizations">
                  {memberships.map(({ organization, membership }) => (
                    <li key={organization.id}>
                      <Link
                        to={`/app/organizations/${organization.id}`}
                        className="flex items-center gap-4 rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm ring-1 ring-slate-900/5 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 motion-reduce:hover:translate-y-0"
                      >
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                          <BuildingIcon className="h-5 w-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-base font-bold text-gray-900">
                            {organization.name}
                          </span>
                          <span className="mt-0.5 block text-sm text-gray-500">
                            /{organization.slug}
                          </span>
                          {membership.roles.length > 0 && (
                            <span className="mt-2 flex flex-wrap gap-1.5">
                              {membership.roles.map((role) => (
                                <span
                                  key={role.id}
                                  className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800"
                                >
                                  {role.name}
                                </span>
                              ))}
                            </span>
                          )}
                        </span>
                        <ArrowRightIcon className="h-4 w-4 shrink-0 text-brand-600" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <CreateOrganizationForm nameInputId={NAME_INPUT_ID} />
        </div>
      </section>
    </>
  )
}
