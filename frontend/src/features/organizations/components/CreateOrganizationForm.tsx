import { useId, useState, type FormEvent } from 'react'

import { ArrowRightIcon, BuildingIcon, LinkIcon } from '../../../components/AppIcons'
import { BuildingGlyph } from '../../../components/glyphs'
import { IconField, OwnerNote } from '../../../components/WorkspaceCollection'
import { GlassBackdropBlobs, GlassFormHeader } from '../../../components/GlassForm'
import {
  glassButtonClasses,
  glassCardClasses,
  glassInputClasses,
  requiredMarkClasses,
} from '../../../components/glassStyles'
import { labelClasses, fieldErrorClasses } from '../../identity/components/fieldStyles'
import { useOrganization } from '../context/useOrganization'

/**
 * `nameInputId` lets the page beside this form point at its first field - the
 * empty state's "Create your first organization" puts the cursor there.
 */
export function CreateOrganizationForm({ nameInputId }: { nameInputId?: string } = {}) {
  const { createOrganization } = useOrganization()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [field, setField] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const generatedNameId = useId()
  const nameId = nameInputId ?? generatedNameId
  const slugId = useId()
  const messageId = useId()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    setField(null)

    if (!name.trim()) {
      setMessage('Organization name is required.')
      setField('name')
      return
    }

    setIsSubmitting(true)
    const result = await createOrganization(name.trim(), slug.trim() || undefined)
    setIsSubmitting(false)

    if (!result.success) {
      setMessage(result.message)
      setField(result.field)
      return
    }

    setName('')
    setSlug('')
    setMessage(result.message)
  }

  return (
    <form className={glassCardClasses} onSubmit={handleSubmit}>
      <GlassBackdropBlobs />
      <GlassFormHeader Glyph={BuildingGlyph} title="Create an organization">
        Start a shared workspace for your team. You will be its first member and owner.
      </GlassFormHeader>

      <div className="mt-6 space-y-5">
        <div>
          <label className={`${labelClasses} ${requiredMarkClasses}`} htmlFor={nameId}>
            Organization name
          </label>
          <IconField Icon={BuildingIcon}>
            <input
              id={nameId}
              className={`${glassInputClasses(field === 'name')} pl-10`}
              maxLength={200}
              placeholder="e.g. Automation Research Team"
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-required="true"
              aria-describedby={message ? messageId : undefined}
              aria-invalid={field === 'name'}
            />
          </IconField>
          <p className="mt-1.5 text-xs text-gray-500">
            Use a clear and recognizable name for your organization.
          </p>
        </div>

        <div>
          <label className={labelClasses} htmlFor={slugId}>
            Slug <span className="font-normal text-gray-500">(optional)</span>
          </label>
          <IconField Icon={LinkIcon}>
            <input
              id={slugId}
              className={`${glassInputClasses(field === 'slug')} pl-10`}
              maxLength={100}
              placeholder="automation-research-team"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              aria-invalid={field === 'slug'}
            />
          </IconField>
          <p className="mt-1.5 text-xs text-gray-500">
            A stable URL-friendly name, generated from the organization name if left blank.
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
        {isSubmitting ? 'Creating…' : 'Create organization'}
        {!isSubmitting && <ArrowRightIcon className="h-4 w-4" />}
      </button>

      <OwnerNote title="You will become the owner">
        As the owner, you can invite members, manage settings, and control access to your
        organization.
      </OwnerNote>
    </form>
  )
}
