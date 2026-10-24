import { useEffect, useState } from 'react'

/**
 * The id of the page section currently in the middle of the viewport, for the
 * header's active link. Starts at the first id, which is also what it stays at
 * without IntersectionObserver.
 */
export function useActiveSection(ids: readonly string[]): string {
  const [active, setActive] = useState(ids[0])

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id)
        }
      },
      // A thin band across the middle of the screen: one section at a time.
      { rootMargin: '-45% 0px -50% 0px' },
    )
    for (const id of ids) {
      const section = document.getElementById(id)
      if (section) observer.observe(section)
    }
    return () => observer.disconnect()
  }, [ids])

  return active
}
