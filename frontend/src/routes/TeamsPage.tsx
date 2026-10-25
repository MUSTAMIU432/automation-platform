import { PeopleArt } from '../components/WorkspaceArt'
import { CollectionHero } from '../components/WorkspaceCollection'
import { CreateTeamForm } from '../features/teams/components/CreateTeamForm'
import { TeamList } from '../features/teams/components/TeamList'
import { TeamsProvider } from '../features/teams/context/TeamsProvider'

/**
 * The caller's teams at `/app/teams`, and the form that creates one.
 *
 * A team is a collaboration boundary rather than a tenant, so this is a page
 * under `/app` like any other and not a mode the header switches into — see
 * `TeamList` for why there is no "active team".
 *
 * It is deliberately reachable with **no organization at all**, which is the
 * case the whole Teams domain exists for: somebody with no tenant can still
 * create a team, put a team idea forward and take it to the platform.
 */
const NAME_INPUT_ID = 'create-team-name'

/** Takes the reader from the empty state to the form's first field. */
function focusCreateForm() {
  const input = document.getElementById(NAME_INPUT_ID)
  input?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
  input?.focus({ preventScroll: true })
}

export function TeamsPage() {
  return (
    <>
      <CollectionHero
        title="Your teams"
        description="A team is a group of people who put an idea forward together. It is not an organization: an organization is shared work with its own reviewers, while a team is simply who writes the idea with you."
        art={<PeopleArt className="h-auto w-full" />}
      />

      <section aria-labelledby="teams-heading" className="mt-8">
        <h2 id="teams-heading" className="sr-only">
          Teams you are in
        </h2>
        {/* One load for both halves: the list draws the caller's teams and the
            form refreshes them, so a provider here is the difference between one
            request on this page and two. */}
        <TeamsProvider>
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <TeamList onCreate={focusCreateForm} />
            <CreateTeamForm nameInputId={NAME_INPUT_ID} />
          </div>
        </TeamsProvider>
      </section>
    </>
  )
}
