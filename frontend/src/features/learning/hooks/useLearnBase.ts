import { useLocation } from 'react-router-dom'

/** Where administrators take courses: inside the console, under its sidebar. */
export const CONSOLE_LEARN_BASE = '/app/admin/learn'
export const LEARN_BASE = '/app/learn'

/**
 * The learning area's base path for this page. The same pages serve members at
 * `/app/learn` and administrators inside the console at `/app/admin/learn`, so
 * every link they build starts from here and keeps the reader where they are.
 */
export function useLearnBase(): string {
  const { pathname } = useLocation()
  return pathname.startsWith(CONSOLE_LEARN_BASE) ? CONSOLE_LEARN_BASE : LEARN_BASE
}
