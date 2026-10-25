import { useId, useState, type FormEvent } from 'react'

import { BuildingGlyph } from '../../../components/glyphs'
import { GlassBackdropBlobs, GlassFormHeader } from '../../../components/GlassForm'
import {
  glassButtonClasses,
  glassCardClasses,
  glassInputClasses,
} from '../../../components/glassStyles'
import { labelClasses, fieldErrorClasses } from '../../identity/components/fieldStyles'
import { useOrganization } from '../context/useOrganization'

export function CreateOrganizationForm() {
  const { createOrganization } = useOrganization()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [field, setField] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const nameId = useId()
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

      <div className="mt-5 space-y-4">
        <div>
          <label className={labelClasses} htmlFor={nameId}>
            Organization name
          </label>
          <input
            id={nameId}
            className={glassInputClasses(field === 'name')}
            maxLength={200}
            placeholder="Organization name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-describedby={message ? messageId : undefined}
            aria-invalid={field === 'name'}
          />
        </div>

        <div>
          <label className={labelClasses} htmlFor={slugId}>
            Slug <span className="font-normal text-gray-500">(optional)</span>
          </label>
          <input
            id={slugId}
            className={glassInputClasses(field === 'slug')}
            maxLength={100}
            placeholder="organization-name"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            aria-invalid={field === 'slug'}
          />
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

      <button
        type="submit"
        className={glassButtonClasses}
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Creating…' : 'Create organization'}
      </button>
    </form>
  )
}
