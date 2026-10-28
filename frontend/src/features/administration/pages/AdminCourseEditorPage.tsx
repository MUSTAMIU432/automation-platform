import { useRef, useState, type DragEvent, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

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
import {
  AdminCard,
  AdminPageHeader,
  EmptyState,
  ErrorState,
  LoadingState,
  Notice,
  controlClasses,
  dangerButtonClasses,
  primaryButtonClasses,
  secondaryButtonClasses,
} from '../components/AdminUi'
import { BackLink } from '../components/BackLink'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { CourseStatusBadge } from '../components/CourseStatusBadge'
import { useAdminQuery } from '../hooks/useAdminQuery'

const LEVELS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'all_levels', label: 'Beginner to advanced' },
]

/** Text areas hold lists one item per line - the simplest editor for a list of sentences. */
const toLines = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

const iconButton =
  'rounded-md px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:opacity-40'

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

function DragHandle({ label, onBand = false }: { label: string; onBand?: boolean }) {
  return (
    <span
      title={label}
      aria-hidden="true"
      className={`cursor-grab px-1 text-base leading-none select-none active:cursor-grabbing ${
        onBand ? 'text-white' : 'text-slate-400'
      }`}
    >
      ⠿
    </span>
  )
}

/** The line that shows where a dragged item will be dropped. */
function DropLine({ as: Tag = 'div' }: { as?: 'div' | 'li' }) {
  return (
    <Tag aria-hidden="true" className="h-0.5 rounded-full bg-sky-500" data-testid="drop-line" />
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <div className="mt-1 font-normal">{children}</div>
    </label>
  )
}

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

function DetailsForm({ course, onSaved }: { course: AdminCourse; onSaved: () => void }) {
  const save = useRun(onSaved)
  const [form, setForm] = useState({
    title: course.title,
    subtitle: course.subtitle,
    description: course.description,
    level: course.level,
    estimatedHours: String(course.estimatedHours),
    audience: course.audience.join('\n'),
    outcomes: course.outcomes.join('\n'),
    capstoneBrief: course.capstoneBrief,
    capstoneRequirements: course.capstoneRequirements.join('\n'),
    capstoneOptions: course.capstoneOptions.map((o) => `${o.title} | ${o.summary}`).join('\n'),
  })
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }))

  function submit(event: FormEvent) {
    event.preventDefault()
    void save.run(() =>
      updateCourseRequest(course.id, {
        title: form.title,
        subtitle: form.subtitle,
        description: form.description,
        level: form.level,
        estimatedHours: Number(form.estimatedHours) || 0,
        audience: toLines(form.audience),
        outcomes: toLines(form.outcomes),
        capstoneBrief: form.capstoneBrief,
        capstoneRequirements: toLines(form.capstoneRequirements),
        capstoneOptions: toLines(form.capstoneOptions).map((line) => {
          const [title, ...summary] = line.split('|')
          return { title: title.trim(), summary: summary.join('|').trim() }
        }),
      }),
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4" aria-label="Course details">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Title">
          <input
            value={form.title}
            onChange={set('title')}
            className={`${controlClasses} w-full`}
          />
        </Field>
        <Field label="Subtitle">
          <input
            value={form.subtitle}
            onChange={set('subtitle')}
            className={`${controlClasses} w-full`}
          />
        </Field>
        <Field label="Level">
          <select value={form.level} onChange={set('level')} className={`${controlClasses} w-full`}>
            {LEVELS.map((level) => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Estimated hours">
          <input
            type="number"
            min={0}
            value={form.estimatedHours}
            onChange={set('estimatedHours')}
            className={`${controlClasses} w-full`}
          />
        </Field>
      </div>
      <Field label="Description">
        <textarea
          rows={4}
          value={form.description}
          onChange={set('description')}
          className={`${controlClasses} w-full`}
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Who it is for (one per line)">
          <textarea
            rows={4}
            value={form.audience}
            onChange={set('audience')}
            className={`${controlClasses} w-full`}
          />
        </Field>
        <Field label="Learning outcomes (one per line)">
          <textarea
            rows={4}
            value={form.outcomes}
            onChange={set('outcomes')}
            className={`${controlClasses} w-full`}
          />
        </Field>
      </div>
      <Field label="Capstone brief">
        <textarea
          rows={3}
          value={form.capstoneBrief}
          onChange={set('capstoneBrief')}
          className={`${controlClasses} w-full`}
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Capstone requirements (one per line)">
          <textarea
            rows={4}
            value={form.capstoneRequirements}
            onChange={set('capstoneRequirements')}
            className={`${controlClasses} w-full`}
          />
        </Field>
        <Field label="Capstone projects (one per line: Title | summary)">
          <textarea
            rows={4}
            value={form.capstoneOptions}
            onChange={set('capstoneOptions')}
            className={`${controlClasses} w-full`}
          />
        </Field>
      </div>
      {save.result && <Notice tone={save.result.tone}>{save.result.text}</Notice>}
      <button type="submit" disabled={save.busy} className={primaryButtonClasses}>
        Save details
      </button>
    </form>
  )
}

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
    objectives: module.objectives.join('\n'),
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
  const lessonLineAt = (beforeId: string | null) =>
    drag.spot?.kind === 'lesson' &&
    drag.spot.moduleId === module.id &&
    drag.spot.beforeId === beforeId
  const exerciseLineAt = (beforeId: string | null) =>
    drag.spot?.kind === 'exercise' &&
    drag.spot.moduleId === module.id &&
    drag.spot.beforeId === beforeId

  return (
    <div
      ref={card}
      data-testid={`module-${module.id}`}
      className={drag.item?.kind === 'module' && drag.item.id === module.id ? 'opacity-50' : ''}
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
      <AdminCard
        title={`${number}. ${module.title}`}
        actions={
          <>
            <span
              draggable={drag.enabled}
              onDragStart={(event) => {
                if (card.current) event.dataTransfer?.setDragImage(card.current, 24, 24)
                drag.start({ kind: 'module', id: module.id, moduleId: module.id }, event)
              }}
              onDragEnd={drag.end}
              data-testid={`drag-module-${module.id}`}
              className="flex items-center rounded-md bg-white/15 px-1.5 py-1"
            >
              <DragHandle label={`Drag to move ${module.title}`} onBand />
            </span>
            <button
              type="button"
              className={secondaryButtonClasses}
              disabled={first || action.busy}
              onClick={() => void action.run(() => moveModuleRequest(module.id, -1))}
              aria-label={`Move ${module.title} up`}
            >
              ↑
            </button>
            <button
              type="button"
              className={secondaryButtonClasses}
              disabled={last || action.busy}
              onClick={() => void action.run(() => moveModuleRequest(module.id, 1))}
              aria-label={`Move ${module.title} down`}
            >
              ↓
            </button>
            <button
              type="button"
              className={secondaryButtonClasses}
              onClick={() => setEditing((open) => !open)}
            >
              {editing ? 'Close' : 'Edit module'}
            </button>
          </>
        }
      >
        {editing && (
          <form
            className="mb-5 space-y-3 rounded-xl bg-slate-50/70 p-4"
            onSubmit={(event) => {
              event.preventDefault()
              void action.run(() =>
                updateModuleRequest(module.id, {
                  title: form.title,
                  summary: form.summary,
                  objectives: toLines(form.objectives),
                  project: form.project,
                }),
              )
            }}
          >
            <Field label="Title">
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className={`${controlClasses} w-full`}
              />
            </Field>
            <Field label="Summary">
              <textarea
                rows={2}
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                className={`${controlClasses} w-full`}
              />
            </Field>
            <Field label="Objectives (one per line)">
              <textarea
                rows={3}
                value={form.objectives}
                onChange={(e) => setForm({ ...form, objectives: e.target.value })}
                className={`${controlClasses} w-full`}
              />
            </Field>
            <Field label="Practical project">
              <textarea
                rows={2}
                value={form.project}
                onChange={(e) => setForm({ ...form, project: e.target.value })}
                className={`${controlClasses} w-full`}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={action.busy} className={primaryButtonClasses}>
                Save module
              </button>
              <button
                type="button"
                className={dangerButtonClasses}
                onClick={() =>
                  setConfirm({ label: 'Delete module', act: () => deleteModuleRequest(module.id) })
                }
              >
                Delete module
              </button>
            </div>
          </form>
        )}

        <h3 className="text-xs font-bold tracking-wide text-slate-500 uppercase">Lessons</h3>
        <ul
          aria-label={`Lessons in ${module.title}`}
          className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white"
        >
          {module.lessons.map((lesson, index) => [
            lessonLineAt(lesson.id) && <DropLine as="li" key={`line-${lesson.id}`} />,
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
              className={`flex flex-wrap items-center gap-2 px-3 py-2 ${
                drag.item?.id === lesson.id && drag.item.kind === 'lesson' ? 'opacity-50' : ''
              }`}
            >
              <DragHandle label={`Drag to move ${lesson.title}`} />
              <Link
                to={`/app/admin/courses/${courseId}/lessons/${lesson.id}`}
                className="min-w-0 flex-1 text-sm font-medium text-slate-900 hover:underline"
              >
                {lesson.title}
              </Link>
              <span className="text-xs text-slate-400">
                {lesson.estimatedMinutes} min
                {lesson.materialCount ? ` · ${lesson.materialCount} files` : ''}
              </span>
              <button
                type="button"
                className={iconButton}
                disabled={index === 0 || action.busy}
                onClick={() => void action.run(() => moveLessonRequest(lesson.id, -1))}
                aria-label={`Move ${lesson.title} up`}
              >
                ↑
              </button>
              <button
                type="button"
                className={iconButton}
                disabled={index === module.lessons.length - 1 || action.busy}
                onClick={() => void action.run(() => moveLessonRequest(lesson.id, 1))}
                aria-label={`Move ${lesson.title} down`}
              >
                ↓
              </button>
              <button
                type="button"
                className={`${iconButton} hover:text-red-700`}
                onClick={() =>
                  setConfirm({
                    label: `Delete “${lesson.title}”`,
                    act: () => deleteLessonRequest(lesson.id),
                  })
                }
              >
                Delete
              </button>
            </li>,
          ])}
          {lessonLineAt(null) && <DropLine as="li" />}
          {module.lessons.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-500">
              No lessons yet. Add one below, or drag one here from another module.
            </li>
          )}
        </ul>
        <form
          className="mt-2 flex flex-wrap gap-2"
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
            className={`${controlClasses} w-72 max-w-full`}
          />
          <button
            type="submit"
            disabled={!newLesson.trim() || action.busy}
            className={secondaryButtonClasses}
          >
            Add lesson
          </button>
        </form>

        <h3 className="mt-5 text-xs font-bold tracking-wide text-slate-500 uppercase">Exercises</h3>
        <ul
          aria-label={`Exercises in ${module.title}`}
          className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white"
        >
          {module.exercises.map((exercise, index) => [
            exerciseLineAt(exercise.id) && <DropLine as="li" key={`line-${exercise.id}`} />,
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
                if (drag.over(rowSpot(event, 'exercise', module.id, exerciseIds, index), event)) {
                  event.stopPropagation()
                }
              }}
              className={`flex flex-wrap items-center gap-2 px-3 py-2 ${
                drag.item?.id === exercise.id && drag.item.kind === 'exercise' ? 'opacity-50' : ''
              }`}
            >
              <DragHandle label={`Drag to move ${exercise.title}`} />
              <Link
                to={`${base}/exercises/${exercise.id}`}
                className="min-w-0 flex-1 text-sm font-medium text-slate-900 hover:underline"
              >
                {exercise.title}
              </Link>
              <span className="text-xs text-slate-400">
                {exercise.difficulty} · {exercise.testCount} tests ({exercise.hiddenTestCount}{' '}
                hidden)
              </span>
              <button
                type="button"
                className={iconButton}
                disabled={index === 0 || !drag.enabled}
                onClick={() =>
                  drag.place(
                    { kind: 'exercise', id: exercise.id, moduleId: module.id },
                    { kind: 'exercise', moduleId: module.id, beforeId: exerciseIds[index - 1] },
                  )
                }
                aria-label={`Move ${exercise.title} up`}
              >
                ↑
              </button>
              <button
                type="button"
                className={iconButton}
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
                aria-label={`Move ${exercise.title} down`}
              >
                ↓
              </button>
              <button
                type="button"
                className={`${iconButton} hover:text-red-700`}
                onClick={() =>
                  setConfirm({
                    label: `Delete “${exercise.title}”`,
                    act: () => deleteExerciseRequest(exercise.id),
                  })
                }
              >
                Delete
              </button>
            </li>,
          ])}
          {exerciseLineAt(null) && <DropLine as="li" />}
          {module.exercises.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-500">No exercises yet.</li>
          )}
        </ul>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link to={`${base}/exercises/new`} className={secondaryButtonClasses}>
            Add exercise
          </Link>
          <Link to={`${base}/quiz`} className={secondaryButtonClasses}>
            {module.quiz ? `Edit quiz (${module.quiz.questionCount} questions)` : 'Add quiz'}
          </Link>
        </div>

        {action.result && (
          <div className="mt-3">
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
      </AdminCard>
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

/** `/app/admin/courses/:courseId`: one course's details, status and curriculum. */
export function AdminCourseEditorPage() {
  const { courseId = '' } = useParams()
  const navigate = useNavigate()
  const course = useAdminQuery(
    `admin-course:${courseId}`,
    () => adminCourseRequest(courseId),
    'We could not load this course.',
  )
  const action = useRun(course.reload)
  const drag = useCurriculumDrag(course.data, course.reload)
  const [newModule, setNewModule] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (course.error) return <ErrorState message={course.error} onRetry={course.reload} />
  if (course.loading && !course.data) return <LoadingState label="Loading the course…" />
  if (!course.data) return <EmptyState title="This course does not exist." />

  const data = course.data
  return (
    <>
      <AdminPageHeader
        back={<BackLink to="/app/admin/courses">All courses</BackLink>}
        title={data.title}
        description={`${data.enrollmentCount} learners enrolled.`}
        actions={
          <>
            <CourseStatusBadge status={data.status} />
            {data.status !== 'published' && (
              <button
                type="button"
                disabled={action.busy}
                className={primaryButtonClasses}
                onClick={() => void action.run(() => publishCourseRequest(data.id))}
              >
                Publish
              </button>
            )}
            {data.status === 'published' && (
              <button
                type="button"
                disabled={action.busy}
                className={secondaryButtonClasses}
                onClick={() => void action.run(() => archiveCourseRequest(data.id))}
              >
                Archive
              </button>
            )}
            {data.status !== 'draft' && (
              <button
                type="button"
                disabled={action.busy}
                className={secondaryButtonClasses}
                onClick={() => void action.run(() => unpublishCourseRequest(data.id))}
              >
                Return to draft
              </button>
            )}
            <Link to={`/app/learn/courses/${data.slug}`} className={secondaryButtonClasses}>
              View as learner
            </Link>
          </>
        }
      />
      <div className="space-y-6">
        {action.result && <Notice tone={action.result.tone}>{action.result.text}</Notice>}
        <AdminCard title="Details">
          <DetailsForm key={data.id} course={data} onSaved={course.reload} />
        </AdminCard>

        {/* Drops only; the ↑/↓ buttons inside are the keyboard path. */}
        {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
        <section
          aria-label="Curriculum"
          className="space-y-4"
          // Between cards: keep the spot the pointer last marked, so a drop there still lands.
          onDragOver={(event) => {
            if (drag.spot) event.preventDefault()
          }}
          onDrop={drag.drop}
        >
          {drag.modules.length > 1 && (
            <p className="text-sm text-slate-500">
              Drag modules by their ⠿ handle, and lessons and exercises by their rows, to put them
              in order. A lesson can be dropped into another module.
            </p>
          )}
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
          <AdminCard title="Add a module">
            <form
              className="flex flex-wrap gap-2"
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
              <input
                value={newModule}
                onChange={(event) => setNewModule(event.target.value)}
                placeholder="Module title"
                aria-label="New module title"
                className={`${controlClasses} w-80 max-w-full`}
              />
              <button
                type="submit"
                disabled={!newModule.trim() || action.busy}
                className={primaryButtonClasses}
              >
                Add module
              </button>
            </form>
          </AdminCard>
        </section>

        <AdminCard title="Danger zone">
          <p className="mb-3 text-sm text-slate-600">
            A course with enrolled learners cannot be deleted - archive it instead, so they keep
            access.
          </p>
          <button
            type="button"
            className={dangerButtonClasses}
            onClick={() => setConfirmDelete(true)}
          >
            Delete course
          </button>
        </AdminCard>
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
