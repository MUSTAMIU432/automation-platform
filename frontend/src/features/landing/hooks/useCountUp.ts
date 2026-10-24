import { useEffect, useRef, useState } from 'react'

import { useReducedMotion } from './useReducedMotion'

const DURATION_MS = 1600

/**
 * Counts from 0 up to `target` once, the first time the returned element is
 * on screen - or shows `target` straight away for reduced motion, or without
 * IntersectionObserver. Null stays null (nothing to count yet).
 */
export function useCountUp<T extends HTMLElement>(target: number | null) {
  const ref = useRef<T>(null)
  const reduced = useReducedMotion()
  const [value, setValue] = useState(0)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setStarted(true)
        observer.disconnect()
      }
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (target === null || !started || reduced) return
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / DURATION_MS)
      // Ease out: fast at first, settling on the real figure.
      setValue(Math.round(target * (1 - (1 - progress) ** 3)))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, started, reduced])

  // Animating means starting from 0 and waiting to be seen; otherwise the figure is shown as is.
  const animates = !reduced && typeof IntersectionObserver !== 'undefined'
  return [ref, target === null ? null : animates ? value : target] as const
}
