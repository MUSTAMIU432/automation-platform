import { useId, useState, type FormEvent } from 'react'

import { ArrowRightIcon, UsersIcon } from '../../../components/AppIcons'
import { UsersGlyph } from '../../../components/glyphs'
import { IconField, OwnerNote } from '../../../components/WorkspaceCollection'
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
  const [description, setDescription] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [field, setField] = useState<string | null>(null)
  const [created, setCreated] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const generatedNameId = useId()
  const nameId = nameInputId ?? generatedNameId
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
      })
      if (!result.success) {
        setMessage(result.message)
        setField(result.field)
        return
      }
      setName('')
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
        A team is a group of people who put an idea forward together. You will be its first member
        and its owner, and it does not need an organization.
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
              placeholder="e.g. Registrar"
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-required="true"
              aria-describedby={message ? messageId : undefined}
              aria-invalid={field === 'name'}
            />
          </IconField>
          <p className="mt-1.5 text-xs text-gray-500">
            Use a name the people in the team will recognize.
          </p>
        </div>

        <div>
          <label className={labelClasses} htmlFor={descriptionId}>
            What is this team for? <span className="font-normal text-gray-500">(optional)</span>
          </label>
          <textarea
            id={descriptionId}
            className={glassInputClasses(field === 'description', { multiline: true })}
            rows={3}
            maxLength={1000}
            placeholder="The people who allocate rooms to students."
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            aria-invalid={field === 'description'}
          />
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
        {isSubmitting ? 'Creating…' : 'Create team'}
        {!isSubmitting && <ArrowRightIcon className="h-4 w-4" />}
      </button>

      <OwnerNote title="You will become the owner">
        As the owner, you can invite people, manage the team, and put ideas forward together.
      </OwnerNote>

      {created ? <output className="sr-only">{created}</output> : null}
    </form>
  )
}
