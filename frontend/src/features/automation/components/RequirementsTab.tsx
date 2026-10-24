import { useState } from 'react'

import { ChecklistIcon, PlusIcon } from '../../../components/AppIcons'

import {
  createRequirement,
  requirementsRequest,
  updateRequirement,
  type Opportunity,
  type Requirement,
} from '../api/automationApi'
import { formatDate, label, REQUIREMENT_TYPES } from '../utils/labels'
import { useLoad } from '../utils/useLoad'
import { useOutcome } from '../utils/useOutcome'
import {
  Badge,
  cardClass,
  Empty,
  Field,
  inputClass,
  Loading,
  LoadFailed,
  NoticeBanner,
  primaryButton,
  secondaryButton,
} from './ui'

const PRIORITIES = ['high', 'medium', 'low']
const STATUSES = ['open', 'in_progress', 'satisfied', 'rejected']

function Row({
  requirement,
  editable,
  onChanged,
}: {
  requirement: Requirement
  editable: boolean
  onChanged: () => void
}) {
  const update = useOutcome()
  const change = (input: Record<string, string>) =>
    void update.run(() => updateRequirement({ id: requirement.id, input }), onChanged)

  return (
    <li className={cardClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-ink">{requirement.title}</p>
          <p className="mt-0.5 text-xs text-sage">
            {label(requirement.type)} · Updated {formatDate(requirement.updatedAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge value={requirement.priority} text={`${label(requirement.priority)} priority`} />
          <Badge value={requirement.status} />
        </div>
      </div>
      {requirement.description && (
        <p className="mt-3 text-sm leading-6 whitespace-pre-line text-ink/80">
          {requirement.description}
        </p>
      )}
      {requirement.acceptanceCriteria && (
        <div className="mt-3 rounded-2xl bg-mist/60 p-3.5 ring-1 ring-inset ring-jade/10">
          <p className="text-xs font-semibold tracking-wide text-jade uppercase">
            Acceptance criteria
          </p>
          <p className="mt-1 text-sm leading-6 whitespace-pre-line text-ink/80">
            {requirement.acceptanceCriteria}
          </p>
        </div>
      )}
      {editable && (
        <div className="mt-4 flex flex-wrap gap-3 border-t border-gray-100 pt-3">
          <label className="text-xs font-semibold text-sage">
            Priority
            <select
              aria-label={`Priority of ${requirement.title}`}
              className={`${inputClass} mt-1`}
              value={requirement.priority}
              disabled={update.busy}
              onChange={(event) => change({ priority: event.target.value })}
            >
              {PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {label(value)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-sage">
            Status
            <select
              aria-label={`Status of ${requirement.title}`}
              className={`${inputClass} mt-1`}
              value={requirement.status}
              disabled={update.busy}
              onChange={(event) => change({ status: event.target.value })}
            >
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {label(value)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <NoticeBanner notice={update.notice} />
    </li>
  )
}

export function RequirementsTab({
  opportunity,
  onChanged,
}: {
  opportunity: Opportunity
  onChanged: () => void
}) {
  const list = useLoad(() => requirementsRequest(opportunity.id), `req:${opportunity.id}`)
  const add = useOutcome()
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'functional',
    priority: 'medium',
    acceptanceCriteria: '',
  })
  const editable =
    opportunity.capabilities.canManageRequirements &&
    !['cancelled', 'completed'].includes(opportunity.status)
  const set = (field: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [field]: value }))
  const fieldError = (name: string) => (add.notice?.field === name ? add.notice.text : null)

  return (
    <section aria-labelledby="req-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="req-heading" className="text-lg font-bold text-ink">
            Requirements
          </h3>
          <p className="mt-0.5 text-sm text-sage">
            What the automation must do, each with how to tell it is done.
          </p>
        </div>
        {editable && !adding && (
          <button type="button" className={primaryButton} onClick={() => setAdding(true)}>
            <PlusIcon className="h-4 w-4" />
            Add requirement
          </button>
        )}
      </div>

      {adding && editable && (
        <form
          aria-label="Add requirement"
          className="overflow-hidden rounded-3xl border border-white bg-white/90 shadow-[0_16px_40px_-30px_rgba(8,75,56,0.5)]"
          onSubmit={(event) => {
            event.preventDefault()
            void add.run(
              () =>
                createRequirement({
                  opportunityId: opportunity.id,
                  input: form,
                }),
              () => {
                setForm({
                  ...form,
                  title: '',
                  description: '',
                  acceptanceCriteria: '',
                })
                setAdding(false)
                list.reload()
                onChanged()
              },
            )
          }}
        >
          <div className="flex items-start gap-3 border-b border-gray-100 bg-gradient-to-br from-mint/25 to-white px-5 py-4 sm:px-6">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-jade shadow-sm ring-1 ring-jade/10"
            >
              <ChecklistIcon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-base font-bold text-ink">New requirement</p>
              <p className="mt-0.5 text-sm text-sage">
                Describe one thing the automation must do. Keep it to one requirement per entry.
              </p>
            </div>
          </div>
          <div className="space-y-5 px-5 py-5 sm:px-6">
            <NoticeBanner notice={add.notice && !add.notice.field ? add.notice : null} />
            <Field id="req-title" label="Title" error={fieldError('title')}>
              <input
                id="req-title"
                className={inputClass}
                placeholder="e.g. Send a receipt by email after every payment"
                value={form.title}
                onChange={(event) => set('title', event.target.value)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="req-type" label="Type" error={fieldError('type')}>
                <select
                  id="req-type"
                  className={inputClass}
                  value={form.type}
                  onChange={(event) => set('type', event.target.value)}
                >
                  {REQUIREMENT_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {label(value)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="req-priority" label="Priority" error={fieldError('priority')}>
                <select
                  id="req-priority"
                  className={inputClass}
                  value={form.priority}
                  onChange={(event) => set('priority', event.target.value)}
                >
                  {PRIORITIES.map((value) => (
                    <option key={value} value={value}>
                      {label(value)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field
              id="req-description"
              label="Description"
              optional
              hint="Who needs it, and what happens today without it."
            >
              <textarea
                id="req-description"
                rows={3}
                className={`${inputClass} resize-y`}
                placeholder="e.g. Taxpayers pay at the counter and wait days for a paper receipt."
                value={form.description}
                onChange={(event) => set('description', event.target.value)}
              />
            </Field>
            <Field
              id="req-criteria"
              label="Acceptance criteria"
              optional
              hint="How will you know it is met? One check per line works well."
            >
              <textarea
                id="req-criteria"
                rows={3}
                className={`${inputClass} resize-y`}
                placeholder="Given a payment is recorded, when it is saved, then the taxpayer receives a receipt by email within a minute."
                value={form.acceptanceCriteria}
                onChange={(event) => set('acceptanceCriteria', event.target.value)}
              />
            </Field>
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-gray-100 bg-gray-50/60 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <button
              type="button"
              className={secondaryButton}
              onClick={() => {
                add.clear()
                setAdding(false)
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={add.busy || !form.title.trim()}
              className={primaryButton}
            >
              {add.busy ? 'Adding…' : 'Add requirement'}
            </button>
          </div>
        </form>
      )}

      {list.loading ? (
        <Loading what="requirements" />
      ) : list.failed ? (
        <LoadFailed what="the requirements" onRetry={list.reload} />
      ) : list.data && list.data.length > 0 ? (
        <ul className="space-y-3">
          {list.data.map((requirement) => (
            <Row
              key={requirement.id}
              requirement={requirement}
              editable={editable}
              onChanged={list.reload}
            />
          ))}
        </ul>
      ) : (
        <Empty title="No requirements yet.">Define what this automation needs to accomplish.</Empty>
      )}
    </section>
  )
}
