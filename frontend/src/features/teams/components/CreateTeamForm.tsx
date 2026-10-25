import { useId, useState, type FormEvent } from 'react'

import { ArrowRightIcon, DocumentIcon, LinkIcon, UsersIcon } from '../../../components/AppIcons'
import { UsersGlyph } from '../../../components/glyphs'
import { IconField } from '../../../components/WorkspaceCollection'
import { GlassBackdropBlobs, GlassFormHeader } from '../../../components/GlassForm'
import {
  glassButtonClasses,
  glassCardClasses,
  glassInputClasses,
  requiredMarkClasses,
} from '../../../components/glassStyles'
import { fieldErrorClasses, labelClasses } from '../../identity/components/fieldStyles'
import { createTeamRequest } from '../api/teamsApi'
import { useTeams } from '../context/useTeams'

/**
 * Create a team, which makes the caller its Owner and first member.
 *
 * Needs no organization, and that is the whole point of the form being here
 * rather than inside an organization's member list: somebody with no tenant can
 * still put an idea forward with a group of people.
 *
 * A refusal is the backend's own message, placed next to the input it names
 * where it named one — the same handling `CreateOrganizationForm` uses, so the
 * two look like one product.
 *
 * `reload` comes from the page's `TeamsProvider`, which is also what `TeamList`
 * reads: a team just created is now one of the caller's teams, and the list
 * beside this form has to say so without asking the server a second time for
 * work this page already knows it started.
 */
export function CreateTeamForm({ nameInputId }: { nameInputId?: string } = {}) {
  const { reload } = useTeams()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [field, setField] = useState<string | null>(null)
  const [created, setCreated] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const generatedNameId = useId()
  const nameId = nameInputId ?? generatedNameId
  const slugId = useId()
  const descriptionId = useId()
  const messageId = useId()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    setField(null)
    setCreated(null)

    if (!name.trim()) {
      setMessage('Give the team a name.')
      setField('name')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await createTeamRequest({
        name: name.trim(),
        description: description.trim(),
        slug: slug.trim() || undefined,
      })
      if (!result.success) {
        setMessage(result.message)
        setField(result.field)
        return
      }
      setName('')
      setSlug('')
      setDescription('')
      setCreated(result.message)
      // The list beside this form is the caller's own teams, and a team just
      // created is now one of them.
      reload()
    } catch {
      // The request never reached a decision; it did not create anything.
      setMessage('We could not reach the server. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className={glassCardClasses} onSubmit={handleSubmit} noValidate>
      <GlassBackdropBlobs />
      <GlassFormHeader Glyph={UsersGlyph} title="Create a team">
        Set up a team workspace for your collaborators. You will be the first member and owner, and
        it needs no organization.
      </GlassFormHeader>

      <div className="mt-6 space-y-5">
        <div>
          <label className={`${labelClasses} ${requiredMarkClasses}`} htmlFor={nameId}>
            Team name
          </label>
          <IconField Icon={UsersIcon}>
            <input
              id={nameId}
              className={`${glassInputClasses(field === 'name')} pl-10`}
              maxLength={200}
              placeholder="e.g. Research and Development Team"
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-required="true"
              aria-describedby={message ? messageId : undefined}
              aria-invalid={field === 'name'}
            />
          </IconField>
          <p className="mt-1.5 text-xs text-gray-500">
            Use a clear and recognizable name for your team.
          </p>
        </div>

        <div>
          <label className={labelClasses} htmlFor={slugId}>
            Team URL <span className="font-normal text-gray-500">(optional)</span>
          </label>
          <IconField Icon={LinkIcon}>
            <input
              id={slugId}
              className={`${glassInputClasses(field === 'slug')} pl-10`}
              maxLength={100}
              placeholder="research-and-development"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              aria-invalid={field === 'slug'}
            />
          </IconField>
          <p className="mt-1.5 text-xs text-gray-500">
            A URL-friendly name, made from the team name if left blank.
          </p>
        </div>

        <div>
          <label className={labelClasses} htmlFor={descriptionId}>
            Description <span className="font-normal text-gray-500">(optional)</span>
          </label>
          <IconField Icon={DocumentIcon} top>
            <textarea
              id={descriptionId}
              className={`${glassInputClasses(field === 'description', { multiline: true })} pl-10`}
              rows={3}
              maxLength={1000}
              placeholder="Briefly describe the purpose of this team…"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              aria-invalid={field === 'description'}
            />
          </IconField>
          <p className="mt-1.5 text-xs text-gray-500">
            This helps other members understand the team's goals.
          </p>
        </div>
      </div>

      {message ? (
        <p
          className={`mt-4 text-sm ${field ? fieldErrorClasses : 'text-gray-600'}`}
          id={messageId}
          role={field ? 'alert' : 'status'}
        >
          {message}
        </p>
      ) : null}

      <button type="submit" className={glassButtonClasses} disabled={isSubmitting}>
        {!isSubmitting && <UsersIcon className="h-4 w-4" />}
        {isSubmitting ? 'Creating…' : 'Create team'}
        {!isSubmitting && <ArrowRightIcon className="h-4 w-4" />}
      </button>

      {created ? <output className="sr-only">{created}</output> : null}
    </form>
  )
}
