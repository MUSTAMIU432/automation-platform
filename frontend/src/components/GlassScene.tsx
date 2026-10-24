/**
 * The MUSTANET glass scene, shared by the public website's hero and the auth
 * pages so both stand in the same world.
 */

import type { CSSProperties } from 'react'

import { sphereStyle } from './sphereStyle'

/** A background layer that moves at `speed` times the scroll (see `useParallax`). */
function parallax(speed: number): CSSProperties {
  return { transform: `translate3d(0, calc(var(--scroll, 0) * ${speed}px), 0)` }
}

/* Large glass spheres round the frame, at different depths: [classes, parallax speed, blur]. */
const BACKDROP_SPHERES: Array<[string, number, boolean]> = [
  ['-left-10 top-24 h-28 w-28 sm:h-36 sm:w-36', 0.35, false],
  ['left-[1%] top-[48%] hidden h-20 w-20 lg:block', 0.5, false],
  ['-right-8 top-[16%] hidden h-32 w-32 md:block', 0.25, false],
  ['right-[2%] top-[38%] hidden h-20 w-20 lg:block', 0.45, true],
  ['left-[44%] -top-10 hidden h-24 w-24 md:block', 0.15, true],
]

/**
 * The website's scene: lit fields, glass petals, glossy spheres at several
 * depths, light streaks and rocky ground. Fills its positioned parent, behind
 * the content; decorative. The spheres move with the scroll when an ancestor
 * sets `--scroll` (the homepage hero does, through `useParallax`).
 */
export function GlassBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_68%_40%,rgba(11,143,101,0.55),transparent_50%),radial-gradient(ellipse_at_15%_20%,rgba(8,75,56,0.8),transparent_45%),linear-gradient(180deg,#05261d,#03140f_70%,#020c09)]" />

      {/* Glass petals: two large curved translucent forms behind everything. */}
      <div
        className="absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-[45%] border border-white/5 bg-[linear-gradient(135deg,rgba(85,230,176,0.18),rgba(11,143,101,0.04)_60%)] blur-[3px]"
        style={{ ...parallax(0.1), rotate: '-24deg' }}
      />
      <div
        className="absolute -right-48 top-1/4 h-[40rem] w-[30rem] rounded-[48%] border border-white/5 bg-[linear-gradient(200deg,rgba(85,230,176,0.16),rgba(11,143,101,0.03)_60%)] blur-[3px]"
        style={{ ...parallax(0.18), rotate: '18deg' }}
      />

      {BACKDROP_SPHERES.map(([classes, speed, blurred]) => (
        <div key={classes} className={`absolute ${classes}`} style={parallax(speed)}>
          <span
            className={`block h-full w-full rounded-full ${blurred ? 'blur-[2px]' : ''}`}
            style={sphereStyle}
          />
        </div>
      ))}

      {/* Light streaks sweeping in from the left. */}
      <svg
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full opacity-60 blur-[2px]"
        fill="none"
      >
        <defs>
          <linearGradient id="hero-streak" x1="0" x2="1">
            <stop offset="0" stopColor="#55e6b0" stopOpacity="0" />
            <stop offset="0.35" stopColor="#55e6b0" stopOpacity="0.7" />
            <stop offset="1" stopColor="#55e6b0" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 18, 36].map((offset) => (
          <path
            key={offset}
            d={`M-60 ${560 + offset} C 140 ${470 + offset}, 300 ${700 + offset}, 560 ${600 + offset} S 940 ${520 + offset}, 1100 ${610 + offset}`}
            stroke="url(#hero-streak)"
            strokeWidth={offset === 0 ? 2 : 1}
            opacity={offset === 0 ? 0.8 : 0.4}
          />
        ))}
      </svg>

      {/* The rocky ground the frame stands on. */}
      <svg
        viewBox="0 0 1440 260"
        preserveAspectRatio="none"
        className="absolute inset-x-0 bottom-0 h-40 w-full sm:h-56"
      >
        <defs>
          <linearGradient id="rock-far" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0d3a2d" />
            <stop offset="1" stopColor="#03130e" />
          </linearGradient>
          <linearGradient id="rock-near" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0a2c22" />
            <stop offset="1" stopColor="#010806" />
          </linearGradient>
        </defs>
        <path
          d="M0 120 L70 80 L150 110 L230 60 L330 105 L420 85 L520 125 L640 100 L760 130 L880 95 L990 120 L1090 70 L1180 100 L1290 55 L1380 90 L1440 70 V260 H0 Z"
          fill="url(#rock-far)"
        />
        <path
          d="M0 150 L60 110 L120 140 L190 100 L260 150 L340 175 L460 160 L600 190 L760 170 L900 185 L1030 160 L1120 120 L1200 150 L1270 105 L1350 135 L1440 100 V260 H0 Z"
          fill="url(#rock-near)"
        />
        <path
          d="M60 110 L120 140 L190 100 M1120 120 L1200 150 L1270 105 L1350 135"
          stroke="rgba(85,230,176,0.35)"
          strokeWidth="1.5"
          fill="none"
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-[#020c09]" />
    </div>
  )
}
