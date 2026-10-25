import type { CSSProperties } from 'react'

/** A glass sphere: a bright highlight, a translucent mint body, a dark rim. */
export const sphereStyle: CSSProperties = {
  background:
    'radial-gradient(circle at 30% 24%, rgba(255,255,255,0.95) 0, rgba(255,255,255,0.35) 9%, transparent 22%), radial-gradient(circle at 50% 60%, rgb(var(--lp-mint)/0.35), rgb(var(--lp-jade)/0.55) 55%, rgb(var(--lp-deep)/0.9) 100%)',
  boxShadow:
    'inset -6px -10px 18px rgba(0,0,0,0.35), inset 4px 6px 12px rgba(255,255,255,0.18), 0 0 26px rgb(var(--lp-mint)/0.45)',
}
