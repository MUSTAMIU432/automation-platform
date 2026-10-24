import { useEffect, useRef } from 'react'

/**
 * Writes the page's scroll offset to `--scroll` on the returned element, once
 * per frame, so its decorative layers can move at their own speeds with
 * `calc(var(--scroll) * <factor>)`. Off entirely for a reduced-motion
 * preference: the variable then stays unset and every layer stays put.
 */
export function useParallax<T extends HTMLElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    const node = ref.current
    if (!node || !window.matchMedia?.('(prefers-reduced-motion: no-preference)').matches) return

    let frame = 0
    const update = () => {
      frame = 0
      node.style.setProperty('--scroll', String(window.scrollY))
    }
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  return ref
}
