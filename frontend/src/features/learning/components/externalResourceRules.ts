/**
 * The rules an external lesson resource is shown by - shared by the lesson page
 * and the console's preview (`ExternalResource.tsx`).
 */

/** How long a page may take to load before the lesson offers it in a new tab instead. */
export const EMBED_TIMEOUT_MS = 20_000

export const FALLBACK_MESSAGE =
  'This learning resource cannot be displayed directly inside MUSTANET. You can open the original resource in a new tab to continue learning.'

/*
  What the framed page may do. It runs its own scripts, forms and pop-ups (so a
  tutorial works as on its site), and keeps its own origin - which is not
  MUSTANET's, so it can read none of MUSTANET's tokens, storage or pages. Left
  out on purpose: top-level navigation, so the page can never take MUSTANET
  away from the learner.
*/
export const SANDBOX =
  'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation'

/** Only an http(s) address is ever put in a frame or a link (the server checks it as well). */
export function isWebAddress(url: string): boolean {
  try {
    const { protocol } = new URL(url)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}
