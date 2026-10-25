import { useId, useState, type FormEvent } from 'react'

import { UsersGlyph } from '../../../components/glyphs'
import { GlassBackdropBlobs, GlassFormHeader } from '../../../components/GlassForm'
import {
  glassButtonClasses,
  glassCardClasses,
  glassInputClasses,
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
export function CreateTeamForm() {
  const { reload } = useTeams()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [field, setField] = useState<string | null>(null)
  const [created, setCreated] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const nameId = useId()
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

      <div className="mt-5 space-y-4">
        <div>
          <label className={labelClasses} htmlFor={nameId}>
            Team name
          </label>
          <input
            id={nameId}
            className={glassInputClasses(field === 'name')}
            maxLength={200}
            placeholder="Registrar"
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-describedby={message ? messageId : undefined}
            aria-invalid={field === 'name'}
          />
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

      <button
        type="submit"
        className={glassButtonClasses}
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Creating…' : 'Create team'}
      </button>

      {created ? <output className="sr-only">{created}</output> : null}
    </form>
  )
}
