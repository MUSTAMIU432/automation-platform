import { useLayoutEffect, useRef } from 'react'

/**
 * Fades an element in the first time it scrolls into view, once (see the
 * `[data-reveal]` rules in index.css). The attribute is written straight to
 * the node rather than through state: it is presentation only, and a
 * re-render per section would buy nothing.
 *
 * Without IntersectionObserver the attribute is never set, so the content is
 * simply visible - nothing depends on the observer to be readable.
 */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null)

  useLayoutEffect(() => {
    const node = ref.current
    if (!node || typeof IntersectionObserver === 'undefined') return

    node.dataset.reveal = 'pending'
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          node.dataset.reveal = 'shown'
          observer.disconnect()
        }
      },
      { threshold: 0.15 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return ref
}
