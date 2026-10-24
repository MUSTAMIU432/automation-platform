import { useState } from 'react'

const PREFIX = 'collapse:'

function read(key: string, defaultOpen: boolean): boolean {
  try {
    const saved = window.localStorage.getItem(PREFIX + key)
    return saved === null ? defaultOpen : saved === 'open'
  } catch {
    return defaultOpen
  }
}

/**
 * Whether a collapsible section is open, remembered on this device under `key`
 * - so a reader who hides the comments on one idea finds them hidden on the
 * next. Without storage the choice lasts the visit.
 */
export function useCollapsed(key: string, defaultOpen = true): [boolean, () => void] {
  const [open, setOpen] = useState(() => read(key, defaultOpen))

  function toggle() {
    setOpen((current) => {
      const next = !current
      try {
        window.localStorage.setItem(PREFIX + key, next ? 'open' : 'closed')
      } catch {
        // Storage unavailable: the choice lasts this visit.
      }
      return next
    })
  }

  return [open, toggle]
}
