import type { CSSProperties } from 'react'

/** A glass sphere: a bright highlight, a translucent mint body, a dark rim. */
export const sphereStyle: CSSProperties = {
  background:
    'radial-gradient(circle at 30% 24%, rgba(255,255,255,0.95) 0, rgba(255,255,255,0.35) 9%, transparent 22%), radial-gradient(circle at 50% 60%, rgba(85,230,176,0.35), rgba(11,143,101,0.55) 55%, rgba(4,40,30,0.9) 100%)',
  boxShadow:
    'inset -6px -10px 18px rgba(0,0,0,0.35), inset 4px 6px 12px rgba(255,255,255,0.18), 0 0 26px rgba(85,230,176,0.45)',
}
