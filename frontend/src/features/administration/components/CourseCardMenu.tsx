import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { DotsVerticalIcon } from '../../../components/AppIcons'
import {
  archiveCourseRequest,
  deleteCourseRequest,
  publishCourseRequest,
  unpublishCourseRequest,
  type AdminCourseListItem,
  type AuthoringResult,
} from '../api/courseAuthoringApi'
import { ConfirmDialog } from './ConfirmDialog'

const itemClass =
  'flex w-full items-center px-3.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none'

/**
 * A course card's ⋮ menu in the console: open it to edit or to read as a learner,
 * move it between draft, published and archived, or delete it. Only the status
 * changes that apply are offered, and deleting asks first - the server refuses a
 * course learners are enrolled in, and says so.
 */
export function CourseCardMenu({
  course,
  onDone,
}: {
  course: AdminCourseListItem
  /** After an action: what the server said, so the page can show it and reload. */
  onDone: (result: AuthoringResult) => void
}) {
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function close(event: MouseEvent | KeyboardEvent) {
      if (
        event instanceof KeyboardEvent
          ? event.key === 'Escape'
          : !ref.current?.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  async function run(action: (id: string) => Promise<AuthoringResult>) {
    setOpen(false)
    setBusy(true)
    try {
      onDone(await action(course.id))
    } catch {
      onDone({
        success: false,
        message: 'We could not reach the server. Please try again.',
        field: null,
        id: null,
      })
    } finally {
      setBusy(false)
      setDeleting(false)
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={`More for ${course.title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy}
        onClick={() => setOpen((value) => !value)}
        className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 disabled:opacity-50"
      >
        <DotsVerticalIcon className="h-5 w-5" />
      </button>
      {open && (
        <div
          role="menu"
          aria-label={`Manage ${course.title}`}
          className="absolute top-9 right-0 z-20 w-52 overflow-hidden rounded-xl border border-slate-100 bg-white py-1 shadow-[0_18px_40px_-16px_rgba(15,23,42,0.35)]"
        >
          <Link role="menuitem" to={`/app/admin/courses/${course.id}`} className={itemClass}>
            Edit course
          </Link>
          <Link
            role="menuitem"
            to={`/app/admin/learn/courses/${course.slug}`}
            className={itemClass}
          >
            View as learner
          </Link>
          <div className="my-1 border-t border-slate-100" />
          {course.status !== 'published' && (
            <button
              role="menuitem"
              type="button"
              className={itemClass}
              onClick={() => void run(publishCourseRequest)}
            >
              Publish
            </button>
          )}
          {course.status !== 'draft' && (
            <button
              role="menuitem"
              type="button"
              className={itemClass}
              onClick={() => void run(unpublishCourseRequest)}
            >
              Return to draft
            </button>
          )}
          {course.status === 'published' && (
            <button
              role="menuitem"
              type="button"
              className={itemClass}
              onClick={() => void run(archiveCourseRequest)}
            >
              Archive
            </button>
          )}
          <div className="my-1 border-t border-slate-100" />
          <button
            role="menuitem"
            type="button"
            className={`${itemClass} text-red-700 hover:bg-red-50 focus:bg-red-50`}
            onClick={() => {
              setOpen(false)
              setDeleting(true)
            }}
          >
            Delete course
          </button>
        </div>
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this course"
          confirmLabel="Delete course"
          danger
          busy={busy}
          onCancel={() => setDeleting(false)}
          onConfirm={() => void run(deleteCourseRequest)}
        >
          &quot;{course.title}&quot; and all its modules, lessons, files and resources will be
          deleted. This cannot be undone. A course learners are enrolled in cannot be deleted -
          archive it instead.
        </ConfirmDialog>
      )}
    </div>
  )
}
