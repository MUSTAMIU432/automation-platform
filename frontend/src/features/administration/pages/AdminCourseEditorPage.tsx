import { useRef, useState, type DragEvent, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import {
  CapIcon,
  ChecklistIcon,
  ClockIcon,
  CodeIcon,
  DocumentIcon,
  LinkIcon,
  PaperclipIcon,
  PencilIcon,
  PlusIcon,
} from '../../../components/AppIcons'
import {
  adminCourseRequest,
  archiveCourseRequest,
  createLessonRequest,
  createModuleRequest,
  deleteCourseRequest,
  deleteExerciseRequest,
  deleteLessonRequest,
  deleteModuleRequest,
  moveLessonRequest,
  moveModuleRequest,
  publishCourseRequest,
  reorderExercisesRequest,
  reorderLessonsRequest,
  reorderModulesRequest,
  unpublishCourseRequest,
  updateCourseRequest,
  updateModuleRequest,
  type AdminCourse,
  type AdminModule,
  type AuthoringResult,
} from '../api/courseAuthoringApi'
import { CourseIcon } from '../components/AdminIcons'
import { EmptyState, ErrorState, LoadingState, Notice, glassSurface } from '../components/AdminUi'
import { BackLink } from '../components/BackLink'
import { ConfirmDialog } from '../components/ConfirmDialog'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  EyeIcon,
  Field,
  FormSection,
  GripIcon,
  IconButton,
  ListEditor,
  StatusPill,
  Tabs,
  TrashIcon,
  brandButton,
  dangerButton,
  inputClasses,
  quietButton,
} from '../components/CourseEditorUi'
import { useAdminQuery } from '../hooks/useAdminQuery'

const LEVELS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'all_levels', label: 'Beginner to advanced' },
]
const levelLabel = (value: string) => LEVELS.find((level) => level.value === value)?.label ?? value

const DIFFICULTY: Record<string, string> = {
  easy: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  medium: 'bg-amber-50 text-amber-800 ring-amber-200',
  hard: 'bg-rose-50 text-rose-700 ring-rose-200',
}

const smallQuiet = `${quietButton} px-3 py-1.5 text-xs`
const chip =
  'inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-slate-600'

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`

/** What can be dragged: a module within its course, a lesson anywhere in it, an exercise within its module. */
type DragKind = 'module' | 'lesson' | 'exercise'
interface DragItem {
  kind: DragKind
  id: string
  moduleId: string
}
/** Where a dragged item would land: just before `beforeId`, or at the end when it is null. */
interface DropSpot {
  kind: DragKind
  moduleId: string
  beforeId: string | null
}
interface CurriculumDrag {
  item: DragItem | null
  spot: DropSpot | null
  enabled: boolean
  start: (item: DragItem, event: DragEvent<HTMLElement>) => void
  /** Whether `spot` can take the dragged item; if so, it is marked as the drop spot. */
  over: (spot: DropSpot, event: DragEvent<HTMLElement>) => boolean
  /** Put `item` at `spot` now - a drop, or a ↑/↓ button. */
  place: (item: DragItem, spot: DropSpot) => void
  drop: (event: DragEvent<HTMLElement>) => void
  end: () => void
}

/** `ids` with `id` moved to just before `beforeId` (or to the end), added if it was not there. */
function placeBefore(ids: string[], id: string, beforeId: string | null): string[] {
  if (beforeId === id) return ids
  const rest = ids.filter((other) => other !== id)
  const at = beforeId === null ? -1 : rest.indexOf(beforeId)
  rest.splice(at < 0 ? rest.length : at, 0, id)
  return rest
}

/** The spot a pointer over row `index` of `ids` means: before the row, or after it past its middle. */
function rowSpot(
  event: DragEvent<HTMLElement>,
  kind: DragKind,
  moduleId: string,
  ids: string[],
  index: number,
): DropSpot {
  const box = event.currentTarget.getBoundingClientRect()
  const after = event.clientY > box.top + box.height / 2
  return { kind, moduleId, beforeId: after ? (ids[index + 1] ?? null) : ids[index] }
}

const sameSpot = (a: DropSpot | null, b: DropSpot) =>
  a?.kind === b.kind && a.moduleId === b.moduleId && a.beforeId === b.beforeId

/** One action at a time, with the server's own words for the result. */
function useRun(onDone: () => void) {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  async function run(action: () => Promise<AuthoringResult>, then?: (r: AuthoringResult) => void) {
    setBusy(true)
    setResult(null)
    try {
      const outcome = await action()
      setResult({ tone: outcome.success ? 'success' : 'error', text: outcome.message })
      if (outcome.success) {
        onDone()
        then?.(outcome)
      }
      return outcome
    } catch {
      setResult({ tone: 'error', text: 'We could not reach the server. Please try again.' })
      return null
    } finally {
      setBusy(false)
    }
  }
  return { busy, result, run }
}

/** The line that shows where a dragged item will be dropped. */
function DropLine({ as: Tag = 'div' }: { as?: 'div' | 'li' }) {
  return (
    <Tag
      aria-hidden="true"
      className="mx-2 h-0.5 rounded-full bg-brand-500 shadow-[0_0_0_3px_rgba(28,138,99,0.15)]"
      data-testid="drop-line"
    />
  )
}

// --- course details and capstone: one form across two tabs ---------------------------

interface CourseForm {
  title: string
  subtitle: string
  description: string
  level: string
  estimatedHours: string
  audience: string[]
  outcomes: string[]
  capstoneBrief: string
  capstoneRequirements: string[]
  capstoneOptions: Array<{ title: string; summary: string }>
}

function formFrom(course: AdminCourse | null): CourseForm {
  return {
    title: course?.title ?? '',
    subtitle: course?.subtitle ?? '',
    description: course?.description ?? '',
    level: course?.level ?? 'beginner',
    estimatedHours: String(course?.estimatedHours ?? 0),
    audience: course?.audience ?? [],
    outcomes: course?.outcomes ?? [],
    capstoneBrief: course?.capstoneBrief ?? '',
    capstoneRequirements: course?.capstoneRequirements ?? [],
    capstoneOptions: (course?.capstoneOptions ?? []).map(({ title, summary }) => ({
      title,
      summary,
    })),
  }
}

const sameForm = (a: CourseForm, b: CourseForm) => JSON.stringify(a) === JSON.stringify(b)
const filled = (items: string[]) => items.map((item) => item.trim()).filter(Boolean)

/**
 * The details and capstone being edited. Fresh course data (after any change on the
 * page) replaces the form only when it has no unsaved edits - or was just saved - so
 * reordering a lesson never throws away a half-written description.
 */
function useCourseForm(course: AdminCourse | null, reload: () => void) {
  const [state, setState] = useState({ course, form: formFrom(course), saved: false })
  if (state.course !== course) {
    const clean = sameForm(state.form, formFrom(state.course))
    setState(
      clean || state.saved
        ? { course, form: formFrom(course), saved: false }
        : { ...state, course },
    )
  }
  const save = useRun(() => {
    setState((current) => ({ ...current, saved: true }))
    reload()
  })
  const form = state.form
  const dirty = !sameForm(form, formFrom(course))

  function update(change: Partial<CourseForm>) {
    setState((current) => ({ ...current, form: { ...current.form, ...change } }))
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!course) return
    void save.run(() =>
      updateCourseRequest(course.id, {
        title: form.title,
        subtitle: form.subtitle,
        description: form.description,
        level: form.level,
        estimatedHours: Number(form.estimatedHours) || 0,
        audience: filled(form.audience),
        outcomes: filled(form.outcomes),
        capstoneBrief: form.capstoneBrief,
        capstoneRequirements: filled(form.capstoneRequirements),
        capstoneOptions: form.capstoneOptions
          .map(({ title, summary }) => ({ title: title.trim(), summary: summary.trim() }))
          .filter((option) => option.title),
      }),
    )
  }

  return {
    form,
    dirty,
    update,
    submit,
    discard: () => setState({ course, form: formFrom(course), saved: false }),
    busy: save.busy,
    result: save.result,
  }
}

type CourseFormApi = ReturnType<typeof useCourseForm>

/** How the course will look in the catalog, as it is being written. */
function CatalogPreview({ form, course }: { form: CourseForm; course: AdminCourse }) {
  const lessons = course.modules.reduce((sum, module) => sum + module.lessons.length, 0)
  return (
    <aside aria-label="Catalog preview" className="space-y-3 xl:sticky xl:top-24">
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">In the catalog</p>
      <div className={`rounded-2xl p-5 ${glassSurface}`}>
        <div className="flex items-start gap-3.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
            <CapIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold break-words text-slate-900">
              {form.title.trim() || 'Untitled course'}
            </p>
            <p className="mt-0.5 text-sm break-words text-slate-600">
              {form.subtitle.trim() || (
                <span className="text-slate-400 italic">A one-line promise goes here</span>
              )}
            </p>
          </div>
        </div>
        <p className="mt-4 flex flex-wrap gap-1.5">
          <span className={chip}>{levelLabel(form.level)}</span>
          <span className={chip}>{plural(course.modules.length, 'module')}</span>
          <span className={chip}>{plural(lessons, 'lesson')}</span>
          <span className={chip}>
            <ClockIcon className="h-3 w-3" /> {Number(form.estimatedHours) || 0} h
          </span>
        </p>
      </div>
      <p className="text-xs leading-relaxed text-slate-500">
        Learners see this card in the catalog and on My learning. The title and the one-line
        subtitle carry most of it.
      </p>
    </aside>
  )
}

function DetailsPanel({ api, course }: { api: CourseFormApi; course: AdminCourse }) {
  const { form, update } = api
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className={`rounded-3xl p-6 sm:p-8 ${glassSurface}`}>
        <FormSection
          title="Basics"
          description="What the course is called and who it suits. The title also forms its web address when it is created."
        >
          <Field label="Title">
            {(id) => (
              <input
                id={id}
                value={form.title}
                onChange={(event) => update({ title: event.target.value })}
                className={inputClasses}
              />
            )}
          </Field>
          <Field
            label="Subtitle"
            hint="One line under the title, in the catalog and the course page."
          >
            {(id) => (
              <input
                id={id}
                value={form.subtitle}
                onChange={(event) => update({ subtitle: event.target.value })}
                placeholder="From your first script to building APIs"
                className={inputClasses}
              />
            )}
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Level">
              {(id) => (
                <select
                  id={id}
                  value={form.level}
                  onChange={(event) => update({ level: event.target.value })}
                  className={inputClasses}
                >
                  {LEVELS.map((level) => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Estimated hours">
              {(id) => (
                <input
                  id={id}
                  type="number"
                  min={0}
                  value={form.estimatedHours}
                  onChange={(event) => update({ estimatedHours: event.target.value })}
                  className={inputClasses}
                />
              )}
            </Field>
          </div>
        </FormSection>

        <FormSection
          title="Description"
          description="The introduction on the course page: what it covers and how it is taught."
        >
          <Field label="Description">
            {(id) => (
              <textarea
                id={id}
                rows={6}
                value={form.description}
                onChange={(event) => update({ description: event.target.value })}
                placeholder="What learners will build, how the course is organised, and what they need before starting."
                className={`${inputClasses} resize-y leading-relaxed`}
              />
            )}
          </Field>
        </FormSection>

        <FormSection
          title="Audience and outcomes"
          description="Who it is for, and what a learner can do by the end. Each shows as a short list on the course page."
        >
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-800">Who it is for</p>
            <ListEditor
              label="Audience"
              items={form.audience}
              onChange={(audience) => update({ audience })}
              placeholder="Complete beginners who want to automate their work"
              addLabel="Add an audience"
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-800">Learning outcomes</p>
            <ListEditor
              label="Outcome"
              items={form.outcomes}
              onChange={(outcomes) => update({ outcomes })}
              placeholder="Write and test a small program on your own"
              addLabel="Add an outcome"
            />
          </div>
        </FormSection>
      </div>
      <CatalogPreview form={form} course={course} />
    </div>
  )
}

function CapstonePanel({ api }: { api: CourseFormApi }) {
  const { form, update } = api
  const setOption = (index: number, change: Partial<CourseForm['capstoneOptions'][number]>) =>
    update({
      capstoneOptions: form.capstoneOptions.map((option, at) =>
        at === index ? { ...option, ...change } : option,
      ),
    })
  return (
    <div className={`rounded-3xl p-6 sm:p-8 ${glassSurface}`}>
      <FormSection
        title="The brief"
        description="The final project that completes the course. Learners submit a repository, how to run it, and their design decisions."
      >
        <Field label="Capstone brief">
          {(id) => (
            <textarea
              id={id}
              rows={5}
              value={form.capstoneBrief}
              onChange={(event) => update({ capstoneBrief: event.target.value })}
              placeholder="Build a small, complete application that brings the course together."
              className={`${inputClasses} resize-y leading-relaxed`}
            />
          )}
        </Field>
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-800">Requirements</p>
          <ListEditor
            label="Requirement"
            items={form.capstoneRequirements}
            onChange={(capstoneRequirements) => update({ capstoneRequirements })}
            placeholder="Has automated tests that pass"
            addLabel="Add a requirement"
          />
        </div>
      </FormSection>

      <FormSection
        title="Project options"
        description="Ideas a learner can choose from. Each needs a title; the summary says what it involves."
      >
        <div className="space-y-3">
          {form.capstoneOptions.map((option, index) => (
            <div
              key={index}
              className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1 space-y-2">
                  <input
                    value={option.title}
                    onChange={(event) => setOption(index, { title: event.target.value })}
                    placeholder="Project title"
                    aria-label={`Project ${index + 1} title`}
                    className={`${inputClasses} font-semibold`}
                  />
                  <textarea
                    rows={2}
                    value={option.summary}
                    onChange={(event) => setOption(index, { summary: event.target.value })}
                    placeholder="What the learner builds"
                    aria-label={`Project ${index + 1} summary`}
                    className={`${inputClasses} resize-y`}
                  />
                </div>
                <IconButton
                  label={`Remove project ${index + 1}`}
                  tone="danger"
                  onClick={() =>
                    update({
                      capstoneOptions: form.capstoneOptions.filter((_, at) => at !== index),
                    })
                  }
                >
                  <TrashIcon />
                </IconButton>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              update({ capstoneOptions: [...form.capstoneOptions, { title: '', summary: '' }] })
            }
            className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-sm font-semibold text-brand-700 hover:border-brand-300 hover:bg-brand-50/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
          >
            <PlusIcon className="h-4 w-4" /> Add a project option
          </button>
        </div>
      </FormSection>
    </div>
  )
}

/** Saves the details and capstone; shown only while there is something to say. */
function SaveBar({ api }: { api: CourseFormApi }) {
  if (!api.dirty && !api.busy && !api.result) return null
  return (
    <div className="sticky bottom-4 z-10 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 px-5 py-3 shadow-[0_18px_40px_-20px_rgba(15,23,42,0.45)] backdrop-blur">
      <div className="text-sm">
        {api.dirty ? (
          <span className="inline-flex items-center gap-2 font-medium text-slate-700">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-amber-500" />
            Unsaved changes
          </span>
        ) : (
          api.result && <Notice tone={api.result.tone}>{api.result.text}</Notice>
        )}
      </div>
      {api.dirty && (
        <div className="flex gap-2">
          <button type="button" onClick={api.discard} disabled={api.busy} className={quietButton}>
            Discard
          </button>
          <button type="submit" disabled={api.busy} className={brandButton}>
            {api.busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      )}
    </div>
  )
}

// --- the curriculum ----------------------------------------------------------------

function ModuleEditor({
  courseId,
  module,
  number,
  first,
  last,
  nextModuleId,
  drag,
  onChanged,
}: {
  courseId: string
  module: AdminModule
  number: number
  first: boolean
  last: boolean
  nextModuleId: string | null
  drag: CurriculumDrag
  onChanged: () => void
}) {
  const navigate = useNavigate()
  const action = useRun(onChanged)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    title: module.title,
    summary: module.summary,
    objectives: module.objectives,
    project: module.project,
  })
  const [newLesson, setNewLesson] = useState('')
  const [confirm, setConfirm] = useState<null | {
    label: string
    act: () => Promise<AuthoringResult>
  }>(null)
  const base = `/app/admin/courses/${courseId}/modules/${module.id}`
  const card = useRef<HTMLDivElement>(null)
  const lessonIds = module.lessons.map((lesson) => lesson.id)
  const exerciseIds = module.exercises.map((exercise) => exercise.id)
  const lineAt = (kind: 'lesson' | 'exercise', beforeId: string | null) =>
    drag.spot?.kind === kind && drag.spot.moduleId === module.id && drag.spot.beforeId === beforeId
  const dragging = (kind: 'lesson' | 'exercise', id: string) =>
    drag.item?.kind === kind && drag.item.id === id
  const rowClasses = (faded: boolean) =>
    `group flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-slate-50 motion-safe:transition-colors ${
      faded ? 'opacity-40' : ''
    }`
  const rowTools = 'flex items-center opacity-70 group-hover:opacity-100 focus-within:opacity-100'

  return (
    <div
      ref={card}
      data-testid={`module-${module.id}`}
      className={drag.item?.kind === 'module' && drag.item.id === module.id ? 'opacity-40' : ''}
      onDragOver={(event) => {
        // A module lands before or after this one; a lesson dropped on the card joins its end.
        if (drag.item?.kind === 'lesson') {
          drag.over({ kind: 'lesson', moduleId: module.id, beforeId: null }, event)
        } else {
          const box = event.currentTarget.getBoundingClientRect()
          drag.over(
            {
              kind: 'module',
              moduleId: '',
              beforeId: event.clientY > box.top + box.height / 2 ? nextModuleId : module.id,
            },
            event,
          )
        }
      }}
      onDrop={drag.drop}
    >
      <article className={`overflow-hidden rounded-2xl ${glassSurface}`}>
        <header className="flex flex-wrap items-center gap-3 border-b border-slate-200/70 px-4 py-3.5 sm:px-5">
          <span
            draggable={drag.enabled}
            onDragStart={(event) => {
              if (card.current) event.dataTransfer?.setDragImage(card.current, 24, 24)
              drag.start({ kind: 'module', id: module.id, moduleId: module.id }, event)
            }}
            onDragEnd={drag.end}
            data-testid={`drag-module-${module.id}`}
            title={`Drag to move ${module.title}`}
            className="cursor-grab rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing"
          >
            <GripIcon />
          </span>
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-linear-to-b from-brand-50 to-brand-100/70 text-sm font-bold text-brand-700 ring-1 ring-brand-200/70"
          >
            {number}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold tracking-tight text-slate-900">
              <span className="sr-only">{number}.</span> {module.title}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {plural(module.lessons.length, 'lesson')} ·{' '}
              {plural(module.exercises.length, 'exercise')} ·{' '}
              {module.quiz ? `quiz of ${plural(module.quiz.questionCount, 'question')}` : 'no quiz'}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <IconButton
              label={`Move ${module.title} up`}
              disabled={first || action.busy}
              onClick={() => void action.run(() => moveModuleRequest(module.id, -1))}
            >
              <ArrowUpIcon />
            </IconButton>
            <IconButton
              label={`Move ${module.title} down`}
              disabled={last || action.busy}
              onClick={() => void action.run(() => moveModuleRequest(module.id, 1))}
            >
              <ArrowDownIcon />
            </IconButton>
            <button
              type="button"
              aria-expanded={editing}
              className={`${smallQuiet} ml-1`}
              onClick={() => setEditing((open) => !open)}
            >
              <PencilIcon className="h-3.5 w-3.5" />
              {editing ? 'Close' : 'Edit module'}
            </button>
          </div>
        </header>

        {editing && (
          <form
            className="space-y-4 border-b border-slate-200/70 bg-slate-50/70 px-4 py-5 sm:px-5"
            onSubmit={(event) => {
              event.preventDefault()
              void action.run(
                () =>
                  updateModuleRequest(module.id, {
                    title: form.title,
                    summary: form.summary,
                    objectives: filled(form.objectives),
                    project: form.project,
                  }),
                () => setEditing(false),
              )
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Title">
                {(id) => (
                  <input
                    id={id}
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className={inputClasses}
                  />
                )}
              </Field>
              <Field label="Summary">
                {(id) => (
                  <input
                    id={id}
                    value={form.summary}
                    onChange={(e) => setForm({ ...form, summary: e.target.value })}
                    placeholder="What this module covers, in a sentence"
                    className={inputClasses}
                  />
                )}
              </Field>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-800">Objectives</p>
              <ListEditor
                label="Objective"
                items={form.objectives}
                onChange={(objectives) => setForm({ ...form, objectives })}
                placeholder="Use loops to repeat work"
                addLabel="Add an objective"
              />
            </div>
            <Field label="Practical project" hint="A small build that closes the module.">
              {(id) => (
                <textarea
                  id={id}
                  rows={2}
                  value={form.project}
                  onChange={(e) => setForm({ ...form, project: e.target.value })}
                  className={`${inputClasses} resize-y`}
                />
              )}
            </Field>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                className={`${dangerButton} px-3 py-1.5 text-xs`}
                onClick={() =>
                  setConfirm({ label: 'Delete module', act: () => deleteModuleRequest(module.id) })
                }
              >
                <TrashIcon className="h-3.5 w-3.5" /> Delete module
              </button>
              <div className="flex gap-2">
                <button type="button" className={smallQuiet} onClick={() => setEditing(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={action.busy}
                  className={`${brandButton} px-3 py-1.5 text-xs`}
                >
                  Save module
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="grid gap-6 px-4 py-4 sm:px-5 sm:py-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div>
            <h3 className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase">
              Lessons
            </h3>
            <ul
              aria-label={`Lessons in ${module.title}`}
              className="space-y-0.5 rounded-xl border border-slate-200/80 bg-white/80 p-1.5"
            >
              {module.lessons.map((lesson, index) => [
                lineAt('lesson', lesson.id) && <DropLine as="li" key={`line-${lesson.id}`} />,
                // Rows are dragged with the pointer; the ↑/↓ buttons in them do the same by keyboard.
                // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
                <li
                  key={lesson.id}
                  draggable={drag.enabled}
                  data-testid={`lesson-${lesson.id}`}
                  onDragStart={(event) =>
                    drag.start({ kind: 'lesson', id: lesson.id, moduleId: module.id }, event)
                  }
                  onDragEnd={drag.end}
                  onDragOver={(event) => {
                    // Only a lesson stops here; a dragged module passes on to the card.
                    if (drag.over(rowSpot(event, 'lesson', module.id, lessonIds, index), event)) {
                      event.stopPropagation()
                    }
                  }}
                  className={rowClasses(dragging('lesson', lesson.id))}
                >
                  <span
                    title={`Drag to move ${lesson.title}`}
                    className="cursor-grab text-slate-300 group-hover:text-slate-400"
                  >
                    <GripIcon />
                  </span>
                  <DocumentIcon className="h-4 w-4 shrink-0 text-slate-400" />
                  <Link
                    to={`/app/admin/courses/${courseId}/lessons/${lesson.id}`}
                    className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 hover:text-brand-700 focus:outline-none focus-visible:underline"
                  >
                    {lesson.title}
                  </Link>
                  <span className={`${chip} hidden sm:inline-flex`}>
                    <ClockIcon className="h-3 w-3" />
                    {lesson.estimatedMinutes} min
                  </span>
                  {lesson.materialCount > 0 && (
                    <span className={`${chip} hidden sm:inline-flex`}>
                      <PaperclipIcon className="h-3 w-3" />
                      {lesson.materialCount}
                    </span>
                  )}
                  <span className={rowTools}>
                    <IconButton
                      label={`Move ${lesson.title} up`}
                      disabled={index === 0 || action.busy}
                      onClick={() => void action.run(() => moveLessonRequest(lesson.id, -1))}
                    >
                      <ArrowUpIcon className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton
                      label={`Move ${lesson.title} down`}
                      disabled={index === module.lessons.length - 1 || action.busy}
                      onClick={() => void action.run(() => moveLessonRequest(lesson.id, 1))}
                    >
                      <ArrowDownIcon className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton
                      label={`Delete ${lesson.title}`}
                      tone="danger"
                      onClick={() =>
                        setConfirm({
                          label: `Delete “${lesson.title}”`,
                          act: () => deleteLessonRequest(lesson.id),
                        })
                      }
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </IconButton>
                  </span>
                </li>,
              ])}
              {lineAt('lesson', null) && <DropLine as="li" />}
              {module.lessons.length === 0 && (
                <li className="px-3 py-4 text-center text-sm text-slate-500">
                  No lessons yet. Add one below, or drag one here from another module.
                </li>
              )}
            </ul>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                void action.run(
                  () =>
                    createLessonRequest(module.id, {
                      title: newLesson,
                      summary: '',
                      objectives: [],
                      estimatedMinutes: 15,
                      body: 'Write the notes for this lesson here.',
                    }),
                  (result) => navigate(`/app/admin/courses/${courseId}/lessons/${result.id}`),
                )
              }}
            >
              <input
                value={newLesson}
                onChange={(event) => setNewLesson(event.target.value)}
                placeholder="New lesson title"
                aria-label={`New lesson in ${module.title}`}
                className={`${inputClasses} py-2`}
              />
              <button
                type="submit"
                disabled={!newLesson.trim() || action.busy}
                className={`${quietButton} shrink-0 py-2`}
              >
                <PlusIcon className="h-4 w-4" /> Add lesson
              </button>
            </form>
          </div>

          <div>
            <h3 className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase">
              Practice
            </h3>
            <ul
              aria-label={`Exercises in ${module.title}`}
              className="space-y-0.5 rounded-xl border border-slate-200/80 bg-white/80 p-1.5"
            >
              {module.exercises.map((exercise, index) => [
                lineAt('exercise', exercise.id) && <DropLine as="li" key={`line-${exercise.id}`} />,
                // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
                <li
                  key={exercise.id}
                  draggable={drag.enabled}
                  data-testid={`exercise-${exercise.id}`}
                  onDragStart={(event) =>
                    drag.start({ kind: 'exercise', id: exercise.id, moduleId: module.id }, event)
                  }
                  onDragEnd={drag.end}
                  onDragOver={(event) => {
                    if (
                      drag.over(rowSpot(event, 'exercise', module.id, exerciseIds, index), event)
                    ) {
                      event.stopPropagation()
                    }
                  }}
                  className={rowClasses(dragging('exercise', exercise.id))}
                >
                  <span
                    title={`Drag to move ${exercise.title}`}
                    className="cursor-grab text-slate-300 group-hover:text-slate-400"
                  >
                    <GripIcon />
                  </span>
                  <CodeIcon className="h-4 w-4 shrink-0 text-brand-600" />
                  <Link
                    to={`${base}/exercises/${exercise.id}`}
                    title={`${exercise.testCount} tests, ${exercise.hiddenTestCount} hidden`}
                    className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 hover:text-brand-700 focus:outline-none focus-visible:underline"
                  >
                    {exercise.title}
                  </Link>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ring-1 ${
                      DIFFICULTY[exercise.difficulty] ?? DIFFICULTY.easy
                    }`}
                  >
                    {exercise.difficulty}
                  </span>
                  <span className={rowTools}>
                    <IconButton
                      label={`Move ${exercise.title} up`}
                      disabled={index === 0 || !drag.enabled}
                      onClick={() =>
                        drag.place(
                          { kind: 'exercise', id: exercise.id, moduleId: module.id },
                          {
                            kind: 'exercise',
                            moduleId: module.id,
                            beforeId: exerciseIds[index - 1],
                          },
                        )
                      }
                    >
                      <ArrowUpIcon className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton
                      label={`Move ${exercise.title} down`}
                      disabled={index === exerciseIds.length - 1 || !drag.enabled}
                      onClick={() =>
                        drag.place(
                          { kind: 'exercise', id: exercise.id, moduleId: module.id },
                          {
                            kind: 'exercise',
                            moduleId: module.id,
                            beforeId: exerciseIds[index + 2] ?? null,
                          },
                        )
                      }
                    >
                      <ArrowDownIcon className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton
                      label={`Delete ${exercise.title}`}
                      tone="danger"
                      onClick={() =>
                        setConfirm({
                          label: `Delete “${exercise.title}”`,
                          act: () => deleteExerciseRequest(exercise.id),
                        })
                      }
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </IconButton>
                  </span>
                </li>,
              ])}
              {lineAt('exercise', null) && <DropLine as="li" />}
              {module.exercises.length === 0 && (
                <li className="px-3 py-4 text-center text-sm text-slate-500">No exercises yet.</li>
              )}
            </ul>

            <Link
              to={`${base}/quiz`}
              className="mt-2 flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white/80 px-3.5 py-2.5 hover:border-brand-200 hover:bg-brand-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
            >
              <ChecklistIcon className="h-4 w-4 shrink-0 text-brand-600" />
              <span className="min-w-0 flex-1 text-sm">
                <span className="font-medium text-slate-800">
                  {module.quiz ? 'Module quiz' : 'Add a quiz'}
                </span>
                <span className="block text-xs text-slate-500">
                  {module.quiz
                    ? `${plural(module.quiz.questionCount, 'question')} · pass at ${module.quiz.passPercentage}%`
                    : 'Check what the module taught'}
                </span>
              </span>
              <span className="text-xs font-semibold text-brand-700">
                {module.quiz ? 'Edit quiz' : 'Add'}
              </span>
            </Link>
            <Link to={`${base}/exercises/new`} className={`${smallQuiet} mt-2`}>
              <PlusIcon className="h-3.5 w-3.5" /> Add exercise
            </Link>
          </div>
        </div>

        {action.result && (
          <div className="border-t border-slate-200/70 px-4 py-3 sm:px-5">
            <Notice tone={action.result.tone}>{action.result.text}</Notice>
          </div>
        )}
        {confirm && (
          <ConfirmDialog
            title={confirm.label}
            confirmLabel="Delete"
            danger
            busy={action.busy}
            onCancel={() => setConfirm(null)}
            onConfirm={() => void action.run(confirm.act).then(() => setConfirm(null))}
          >
            This cannot be undone. Learner progress on what is deleted is removed too.
          </ConfirmDialog>
        )}
      </article>
    </div>
  )
}

/**
 * Drag-and-drop for the curriculum, with the browser's own drag events. The new
 * order shows at once and is sent whole, so the server either takes all of it or
 * none (and the page goes back to what it holds). The ↑/↓ buttons stay for the
 * keyboard and for touch screens.
 */
function useCurriculumDrag(
  course: AdminCourse | null,
  reload: () => void,
): CurriculumDrag & { modules: AdminModule[]; result: ReturnType<typeof useRun>['result'] } {
  const [item, setItem] = useState<DragItem | null>(null)
  const [spot, setSpot] = useState<DropSpot | null>(null)
  // The order shown while the server catches up; dropped when fresh course data arrives.
  const [pending, setPending] = useState<{ base: AdminCourse; modules: AdminModule[] } | null>(null)
  const save = useRun(reload)
  const enabled = !save.busy
  const modules = pending && pending.base === course ? pending.modules : (course?.modules ?? [])

  function accepts(target: DropSpot) {
    if (!enabled) return false
    if (!item || item.kind !== target.kind) return false
    return item.kind !== 'exercise' || item.moduleId === target.moduleId
  }

  function end() {
    setItem(null)
    setSpot(null)
  }

  function place(dragged: DragItem, target: DropSpot): void {
    if (!course) return
    let next: AdminModule[]
    let send: () => Promise<AuthoringResult>
    if (dragged.kind === 'module') {
      const ids = modules.map((module) => module.id)
      const order = placeBefore(ids, dragged.id, target.beforeId)
      if (order.join() === ids.join()) return
      next = order.map((id) => modules.find((module) => module.id === id)!)
      send = () => reorderModulesRequest(course.id, order)
    } else if (dragged.kind === 'lesson') {
      const source = modules.find((module) => module.id === dragged.moduleId)
      const destination = modules.find((module) => module.id === target.moduleId)
      const lesson = source?.lessons.find((one) => one.id === dragged.id)
      if (!source || !destination || !lesson) return
      const ids = destination.lessons.map((one) => one.id)
      const order = placeBefore(ids, dragged.id, target.beforeId)
      if (source === destination && order.join() === ids.join()) return
      const lessons = new Map([...destination.lessons, lesson].map((one) => [one.id, one] as const))
      next = modules.map((module) => {
        if (module === destination) {
          return { ...module, lessons: order.map((id) => lessons.get(id)!) }
        }
        if (module === source) {
          return { ...module, lessons: module.lessons.filter((one) => one.id !== dragged.id) }
        }
        return module
      })
      send = () => reorderLessonsRequest(destination.id, order)
    } else {
      const owner = modules.find((module) => module.id === dragged.moduleId)
      if (!owner) return
      const ids = owner.exercises.map((one) => one.id)
      const order = placeBefore(ids, dragged.id, target.beforeId)
      if (order.join() === ids.join()) return
      next = modules.map((module) =>
        module === owner
          ? {
              ...module,
              exercises: order.map((id) => owner.exercises.find((one) => one.id === id)!),
            }
          : module,
      )
      send = () => reorderExercisesRequest(owner.id, order)
    }
    setPending({ base: course, modules: next })
    void save.run(send).then((outcome) => {
      if (!outcome?.success) setPending(null)
    })
  }

  return {
    modules,
    result: save.result,
    item,
    spot,
    enabled,
    start(dragged, event) {
      event.stopPropagation()
      // Firefox starts a drag only with some data set.
      event.dataTransfer?.setData('text/plain', dragged.id)
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
      setItem(dragged)
    },
    over(target, event) {
      if (!accepts(target)) return false
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
      if (!sameSpot(spot, target)) setSpot(target)
      return true
    },
    place,
    drop(event) {
      event.preventDefault()
      event.stopPropagation()
      if (item && spot && accepts(spot)) place(item, spot)
      end()
    },
    end,
  }
}

type TabKey = 'curriculum' | 'details' | 'capstone' | 'settings'
const TAB_KEYS: TabKey[] = ['curriculum', 'details', 'capstone', 'settings']

/** The course at a glance: what it is, where it stands, and the one thing to do next. */
function CourseHeader({
  course,
  busy,
  run,
}: {
  course: AdminCourse
  busy: boolean
  run: (action: () => Promise<AuthoringResult>) => void
}) {
  const lessons = course.modules.reduce((sum, module) => sum + module.lessons.length, 0)
  const exercises = course.modules.reduce((sum, module) => sum + module.exercises.length, 0)
  const quizzes = course.modules.filter((module) => module.quiz).length
  const facts = [
    levelLabel(course.level),
    plural(course.modules.length, 'module'),
    plural(lessons, 'lesson'),
    plural(exercises, 'exercise'),
    plural(quizzes, 'quiz', 'quizzes'),
    plural(course.enrollmentCount, 'learner'),
  ]

  return (
    <header className={`relative overflow-hidden rounded-3xl p-6 sm:p-7 ${glassSurface}`}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-16 h-56 w-56 rounded-full bg-mint/20 blur-3xl"
      />
      <div className="relative flex flex-wrap items-start justify-between gap-6">
        <div className="flex min-w-[16rem] flex-1 basis-[28rem] items-start gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-brand-600 to-brand-800 text-white shadow-[0_12px_24px_-12px_rgba(15,74,55,0.9)]">
            <CourseIcon />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight break-words text-slate-900">
                {course.title}
              </h1>
              <StatusPill status={course.status} />
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {course.subtitle || (
                <span className="text-slate-400 italic">No subtitle yet - add one in Details.</span>
              )}
            </p>
            <ul aria-label="Course facts" className="mt-3 flex flex-wrap gap-1.5">
              {facts.map((fact) => (
                <li key={fact} className={chip}>
                  {fact}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2">
          <Link to={`/app/admin/learn/courses/${course.slug}`} className={quietButton}>
            <EyeIcon /> View as learner
          </Link>
          {course.status === 'published' && (
            <button
              type="button"
              disabled={busy}
              className={quietButton}
              onClick={() => run(() => archiveCourseRequest(course.id))}
            >
              Archive
            </button>
          )}
          {course.status !== 'draft' && (
            <button
              type="button"
              disabled={busy}
              className={quietButton}
              onClick={() => run(() => unpublishCourseRequest(course.id))}
            >
              Return to draft
            </button>
          )}
          {course.status !== 'published' && (
            <button
              type="button"
              disabled={busy}
              className={brandButton}
              onClick={() => run(() => publishCourseRequest(course.id))}
            >
              Publish
            </button>
          )}
        </div>
      </div>
      {course.status === 'draft' && (
        <p className="relative mt-5 rounded-xl bg-amber-50/80 px-4 py-2.5 text-sm text-amber-900 ring-1 ring-amber-200/70">
          {lessons === 0
            ? 'Learners cannot see a draft. Add a module and a lesson, then publish.'
            : 'Learners cannot see a draft yet. Publish when the course is ready.'}
        </p>
      )}
      {course.status === 'archived' && (
        <p className="relative mt-5 rounded-xl bg-slate-100/80 px-4 py-2.5 text-sm text-slate-700 ring-1 ring-slate-200">
          Archived: out of the catalog, still open to the learners already enrolled.
        </p>
      )}
    </header>
  )
}

function SettingsPanel({ course, onDelete }: { course: AdminCourse; onDelete: () => void }) {
  return (
    <div className="max-w-3xl space-y-6">
      <section className={`rounded-3xl p-6 sm:p-7 ${glassSurface}`}>
        <h2 className="text-base font-semibold text-slate-900">Course address</h2>
        <p className="mt-1 text-sm text-slate-500">
          Where learners open the course. It is set from the title when the course is created and
          stays the same, so shared links keep working.
        </p>
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5 font-mono text-sm text-slate-700 ring-1 ring-slate-200">
          <LinkIcon className="h-4 w-4 shrink-0 text-slate-400" />
          <span className="truncate">/app/learn/courses/{course.slug}</span>
        </p>
      </section>
      <section className="rounded-3xl border border-red-200/80 bg-red-50/40 p-6 sm:p-7">
        <h2 className="text-base font-semibold text-red-900">Delete this course</h2>
        <p className="mt-1 text-sm text-red-900/80">
          Removes the course, its lessons, files, exercises and quizzes for good. A course with
          enrolled learners cannot be deleted - archive it instead, so they keep access.
        </p>
        <button type="button" className={`${dangerButton} mt-4`} onClick={onDelete}>
          <TrashIcon /> Delete course
        </button>
      </section>
    </div>
  )
}

/** `/app/admin/courses/:courseId`: one course - its curriculum, details, capstone and settings. */
export function AdminCourseEditorPage() {
  const { courseId = '' } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const course = useAdminQuery(
    `admin-course:${courseId}`,
    () => adminCourseRequest(courseId),
    'We could not load this course.',
  )
  const action = useRun(course.reload)
  const drag = useCurriculumDrag(course.data, course.reload)
  const details = useCourseForm(course.data, course.reload)
  const [newModule, setNewModule] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const requested = params.get('tab') as TabKey | null
  const tab: TabKey = requested && TAB_KEYS.includes(requested) ? requested : 'curriculum'

  if (course.error) return <ErrorState message={course.error} onRetry={course.reload} />
  if (course.loading && !course.data) return <LoadingState label="Loading the course…" />
  if (!course.data) return <EmptyState title="This course does not exist." />

  const data = course.data
  const lessons = data.modules.reduce((sum, module) => sum + module.lessons.length, 0)
  const select = (key: TabKey) =>
    setParams(key === 'curriculum' ? {} : { tab: key }, { replace: true })

  return (
    <>
      <div className="mb-4">
        <BackLink to="/app/admin/courses">All courses</BackLink>
      </div>
      <div className="space-y-6">
        <CourseHeader course={data} busy={action.busy} run={(act) => void action.run(act)} />
        {action.result && <Notice tone={action.result.tone}>{action.result.text}</Notice>}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            label="Course editor"
            current={tab}
            onSelect={select}
            tabs={[
              { key: 'curriculum', label: 'Curriculum', count: lessons },
              { key: 'details', label: details.dirty ? 'Details •' : 'Details' },
              { key: 'capstone', label: 'Capstone' },
              { key: 'settings', label: 'Settings' },
            ]}
          />
          {tab === 'curriculum' && drag.modules.length > 1 && (
            <p className="inline-flex items-center gap-1.5 text-xs text-slate-500">
              <GripIcon className="h-3.5 w-3.5" /> Drag to reorder - a lesson can move to another
              module.
            </p>
          )}
        </div>

        {tab === 'curriculum' && (
          // Drops only; the ↑/↓ buttons inside are the keyboard path.
          // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
          <section
            role="tabpanel"
            aria-label="Curriculum"
            className="space-y-4"
            // Between cards: keep the spot the pointer last marked, so a drop there still lands.
            onDragOver={(event) => {
              if (drag.spot) event.preventDefault()
            }}
            onDrop={drag.drop}
          >
            {drag.result && <Notice tone={drag.result.tone}>{drag.result.text}</Notice>}
            {drag.modules.map((module, index) => [
              drag.spot?.kind === 'module' && drag.spot.beforeId === module.id && (
                <DropLine key={`line-${module.id}`} />
              ),
              <ModuleEditor
                key={module.id}
                courseId={data.id}
                module={module}
                number={index + 1}
                first={index === 0}
                last={index === drag.modules.length - 1}
                nextModuleId={drag.modules[index + 1]?.id ?? null}
                drag={drag}
                onChanged={course.reload}
              />,
            ])}
            {drag.spot?.kind === 'module' && drag.spot.beforeId === null && <DropLine />}
            <form
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white/40 p-4 sm:p-5"
              onSubmit={(event) => {
                event.preventDefault()
                void action.run(
                  () =>
                    createModuleRequest(data.id, {
                      title: newModule,
                      summary: '',
                      objectives: [],
                      project: '',
                    }),
                  () => setNewModule(''),
                )
              }}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-brand-600 ring-1 ring-slate-200">
                <PlusIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">
                  {drag.modules.length === 0 ? 'Start with a first module' : 'Add a module'}
                </p>
                <p className="text-xs text-slate-500">
                  A module groups lessons, exercises and a quiz around one topic.
                </p>
              </div>
              <div className="flex w-full gap-2 sm:w-auto">
                <input
                  value={newModule}
                  onChange={(event) => setNewModule(event.target.value)}
                  placeholder="Module title"
                  aria-label="New module title"
                  className={`${inputClasses} py-2 sm:w-72`}
                />
                <button
                  type="submit"
                  disabled={!newModule.trim() || action.busy}
                  className={`${brandButton} shrink-0`}
                >
                  Add module
                </button>
              </div>
            </form>
          </section>
        )}

        {(tab === 'details' || tab === 'capstone') && (
          <form onSubmit={details.submit} aria-label="Course details" role="tabpanel">
            {tab === 'details' ? (
              <DetailsPanel api={details} course={data} />
            ) : (
              <CapstonePanel api={details} />
            )}
            <SaveBar api={details} />
          </form>
        )}

        {tab === 'settings' && (
          <div role="tabpanel" aria-label="Settings">
            <SettingsPanel course={data} onDelete={() => setConfirmDelete(true)} />
          </div>
        )}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete “${data.title}”`}
          confirmLabel="Delete course"
          danger
          busy={action.busy}
          error={action.result?.tone === 'error' ? action.result.text : null}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() =>
            void action.run(
              () => deleteCourseRequest(data.id),
              () => navigate('/app/admin/courses'),
            )
          }
        >
          The course, its lessons, files, exercises and quizzes are deleted. This cannot be undone.
        </ConfirmDialog>
      )}
    </>
  )
}
