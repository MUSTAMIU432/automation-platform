import { useLocation } from 'react-router-dom'

/**
 * "Where to go back to", carried in navigation state when a link takes the reader away
 * from what they were doing - from a project in their workspace to the idea behind it,
 * say. The page it opens shows a back control to `path`, labelled with `label`, instead of
 * the generic way home. `state` is the state the origin itself was opened with, so going
 * back restores *its* way back too, and a chain of detours unwinds one step at a time.
 */
export interface ReturnTo {
  path: string
  label: string
  state?: unknown
}

/**
 * The return point in `state`, if it is one this app made. Only same-app paths are
 * accepted: navigation state can be written by anything that can push history, and a
 * back control must never lead off the platform.
 */
export function readReturnTo(state: unknown): ReturnTo | null {
  if (typeof state !== 'object' || state === null || !('returnTo' in state)) return null
  const value = (state as { returnTo: unknown }).returnTo
  if (typeof value !== 'object' || value === null) return null
  const { path, label } = value as { path?: unknown; label?: unknown }
  if (typeof path !== 'string' || typeof label !== 'string') return null
  if (!path.startsWith('/app') || path.startsWith('//')) return null
  return { path, label, state: (value as { state?: unknown }).state }
}

/**
 * Navigation state that sends the reader back here: link with `state={returnHere(...)}`.
 * `path` defaults to the current address; pass one to come back somewhere more precise
 * (the same project, but on its Overview tab).
 */
export function useReturnHere(): (label: string, path?: string) => { returnTo: ReturnTo } {
  const location = useLocation()
  return (label, path) => ({
    returnTo: {
      path: path ?? `${location.pathname}${location.search}`,
      label,
      state: location.state ?? undefined,
    },
  })
}
