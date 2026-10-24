import { IdeasWorkspace } from '../features/ideas/components/IdeasWorkspace'

/**
 * The Ideas area at `/app/ideas`.
 *
 * Rendered inside `AppLayout`, so it inherits `RequireAuth` and the shared
 * `OrganizationProvider` - which is what supplies the active organization the
 * ideas belong to. There is deliberately no organization picker on this page:
 * the switcher in the layout header is the one the whole authenticated app
 * shares, so a second one here could point the screen at an organization the
 * user is not in, and the server would refuse every write anyway.
 */
export function IdeasPage() {
  // The heading, the introduction and "File a new idea" are the workspace's own
  // (`IdeasHero`), because the button opens the workspace's dialog.
  return <IdeasWorkspace />
}
