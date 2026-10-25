import type { ComponentType } from 'react'

import { sphereStyle } from '../../../components/sphereStyle'
import type { PlatformStats } from '../api/statsApi'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { BulbGlyph, CheckGlyph, DocumentGlyph, GearGlyph } from '../../../components/glyphs'

const NAV = ['Dashboard', 'Ideas', 'Reviews', 'Projects', 'Users', 'Organizations', 'Teams']

const TILES: Array<{
  label: string
  Glyph: ComponentType<{ className?: string }>
  position: string
  tilt: number
  delay: string
}> = [
  { label: 'Idea', Glyph: BulbGlyph, position: 'left-[8%] top-[4%]', tilt: -8, delay: '0s' },
  { label: 'Develop', Glyph: GearGlyph, position: 'right-[4%] top-0', tilt: 8, delay: '-2s' },
  {
    label: 'Requirements',
    Glyph: DocumentGlyph,
    position: 'left-0 top-[44%]',
    tilt: -6,
    delay: '-4s',
  },
  {
    label: 'Implement',
    Glyph: CheckGlyph,
    position: '-right-[2%] top-[52%]',
    tilt: 10,
    delay: '-6s',
  },
]

/* Glossy bubbles round the laptop: [left %, top %, size px, float seconds]. */
const BUBBLES: Array<[number, number, number, number]> = [
  [36, 6, 38, 8],
  [56, 14, 26, 10],
  [30, 30, 22, 9],
  [93, 30, 30, 11],
  [24, 64, 34, 10],
  [90, 46, 22, 8],
  [62, 4, 16, 7],
  [86, 76, 18, 9],
]

function figure(value: number | undefined) {
  return value === undefined ? '—' : value.toLocaleString()
}

/** The light app surface on the laptop's screen, carrying the platform's real figures. */
function Dashboard({ stats }: { stats: PlatformStats | null }) {
  const cards = [
    { label: 'Ideas', value: stats?.ideasSubmitted },
    { label: 'Projects', value: stats?.projects },
    { label: 'Reviews', value: stats?.reviewsCompleted },
  ]

  return (
    <div
      data-landing-keep-colors=""
      className="grid h-full grid-cols-[23%_1fr] bg-[color:var(--lp-screen)] text-ink"
    >
      <div className="flex flex-col gap-[5%] bg-[color:var(--lp-screen-side)] px-[8%] py-[7%]">
        <div className="mb-[6%] flex items-center gap-1">
          <span className="flex h-3 w-3 items-center justify-center rounded-[3px] bg-mint text-[6px] font-black text-forest">
            M
          </span>
          <span className="text-[6px] font-bold tracking-wide text-white sm:text-[7px]">
            MUSTANET
          </span>
        </div>
        {NAV.map((item, index) => (
          <span
            key={item}
            className={`flex items-center gap-1 rounded px-1 py-[3%] text-[5px] sm:text-[6px] ${
              index === 0 ? 'bg-mint/20 text-mint' : 'text-white/60'
            }`}
          >
            <span className={`h-1 w-1 rounded-full ${index === 0 ? 'bg-mint' : 'bg-white/40'}`} />
            {item}
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-[3.5%] p-[4%]">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-[7px] font-bold sm:text-[9px]">
            <span className="h-2 w-2 rounded-full border-2 border-jade" />
            Overview
          </span>
          <span className="flex gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-ink/10" />
            <span className="h-2.5 w-2.5 rounded-full bg-jade/50" />
          </span>
        </div>
        <div className="grid grid-cols-3 gap-[3%]">
          {cards.map((card) => (
            <div key={card.label} className="rounded-md bg-white p-[7%] shadow-sm">
              <p className="text-[5px] font-semibold text-sage sm:text-[6px]">{card.label}</p>
              <div className="mt-[6%] flex items-end justify-between">
                <span className="text-[9px] font-bold sm:text-[12px]">{figure(card.value)}</span>
                <span className="flex h-2.5 w-2.5 items-center justify-center rounded-full bg-mint/30 text-[5px] text-jade">
                  ↗
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-[3%]">
          <div className="rounded-md bg-white p-[7%] shadow-sm">
            <div className="flex h-6 items-end gap-[2px] sm:h-8">
              {[4, 6, 5, 8, 7, 10].map((height, bar) => (
                <span
                  key={bar}
                  className="w-[3px] rounded-sm bg-jade/70"
                  style={{ height: `${height * 10}%` }}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-center rounded-md bg-white shadow-sm">
            <svg viewBox="0 0 36 36" className="h-8 sm:h-10">
              <circle
                cx="18"
                cy="18"
                r="13"
                fill="none"
                style={{ stroke: 'var(--color-mist)' }}
                strokeWidth="5"
              />
              <circle
                cx="18"
                cy="18"
                r="13"
                fill="none"
                style={{ stroke: 'var(--color-jade)' }}
                strokeWidth="5"
                strokeDasharray="50 82"
                transform="rotate(-90 18 18)"
              />
              <circle
                cx="18"
                cy="18"
                r="13"
                fill="none"
                style={{ stroke: 'var(--color-mint)' }}
                strokeWidth="5"
                strokeDasharray="20 82"
                strokeDashoffset="-50"
                transform="rotate(-90 18 18)"
              />
            </svg>
          </div>
          <div className="rounded-md bg-white p-[7%] shadow-sm">
            <p className="text-[5px] font-semibold text-sage sm:text-[6px]">Active Users</p>
            <p className="text-[8px] font-bold sm:text-[10px]">{figure(stats?.activeUsers)}</p>
            <div className="mt-[6%] space-y-[3px]">
              <span className="block h-[3px] w-4/5 rounded-full bg-jade/40" />
              <span className="block h-[3px] w-3/5 rounded-full bg-ink/10" />
            </div>
          </div>
        </div>
        <div className="flex-1 rounded-md bg-white p-[3%] shadow-sm">
          <p className="text-[5px] font-semibold text-sage sm:text-[6px]">Recent Activity</p>
          {[0, 1].map((row) => (
            <div key={row} className="mt-[2.5%] flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-mint/60" />
              <span className="h-[3px] w-1/3 rounded-full bg-ink/10" />
              <span className="ml-auto h-[3px] w-1/5 rounded-full bg-ink/10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** One orbit ring with its travelling node, as half of the scene: behind or in front of the laptop. */
function Orbits({ half, moving }: { half: 'back' | 'front'; moving: boolean }) {
  const clipId = `orbit-clip-${half}`
  const rings = [
    { rx: 330, ry: 112, tilt: -12, dur: '14s', width: 2.5 },
    { rx: 292, ry: 140, tilt: 9, dur: '18s', width: 1.5 },
  ]

  return (
    <svg
      viewBox="0 0 700 630"
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      fill="none"
    >
      <defs>
        <clipPath id={clipId}>
          {/* The half of the ring's own plane that sits behind (or before) the laptop. */}
          <rect x="-200" y={half === 'back' ? -400 : 360} width="1100" height="760" />
        </clipPath>
        <radialGradient id={`orbit-node-${half}`}>
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.35" style={{ stopColor: 'var(--color-mint)' }} />
          <stop offset="1" style={{ stopColor: 'var(--color-mint)', stopOpacity: 0 }} />
        </radialGradient>
      </defs>
      {rings.map((ring, index) => {
        const path = `M ${360 - ring.rx} 360 a ${ring.rx} ${ring.ry} 0 1 0 ${ring.rx * 2} 0 a ${ring.rx} ${ring.ry} 0 1 0 ${-ring.rx * 2} 0`
        return (
          <g key={ring.rx} transform={`rotate(${ring.tilt} 360 360)`}>
            <g clipPath={`url(#${clipId})`}>
              <path
                d={path}
                strokeWidth={ring.width}
                strokeDasharray={index === 1 ? '4 8' : undefined}
                style={{
                  stroke: 'rgb(var(--lp-mint)/0.8)',
                  filter: 'drop-shadow(0 0 6px rgb(var(--lp-mint)/0.8))',
                }}
              />
              {index === 0 && (
                <path
                  d={path}
                  pathLength={1000}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="90 910"
                  className="motion-safe:animate-[orbit-trail_7s_linear_infinite]"
                  style={{
                    stroke: 'var(--lp-mint-pale)',
                    filter: 'drop-shadow(0 0 8px var(--color-mint))',
                  }}
                />
              )}
              {moving && (
                <circle r="9" fill={`url(#orbit-node-${half})`}>
                  <animateMotion dur={ring.dur} repeatCount="indefinite" path={path} />
                </circle>
              )}
            </g>
          </g>
        )
      })}
    </svg>
  )
}

/**
 * The hero's scene: a laptop showing the platform's dashboard, on a lit
 * pedestal, inside two orbit rings that pass behind it and in front of it,
 * with four glass tiles for the journey and glossy bubbles. Decorative, so
 * hidden from assistive technology; small screens keep the laptop, pedestal
 * and rings only.
 */
export function HeroVisual({ stats }: { stats: PlatformStats | null }) {
  const moving = !useReducedMotion()

  return (
    <div
      aria-hidden="true"
      className="relative mx-auto aspect-[10/9] w-full max-w-[46rem] select-none"
    >
      {/* Light pooled behind the laptop. */}
      <div className="absolute inset-[12%] rounded-full bg-[radial-gradient(circle,rgb(var(--lp-mint)/0.35),transparent_65%)] blur-2xl" />

      {/* Pedestal: a dark cylinder with glowing rings on its top face. */}
      <div className="absolute inset-x-[10%] bottom-[8%] h-[20%]">
        <div className="absolute inset-x-0 bottom-0 h-[70%] rounded-b-[50%] bg-gradient-to-b from-[color:var(--lp-plinth-1)] via-[color:var(--lp-plinth-2)] to-[color:var(--lp-plinth-3)] shadow-[0_40px_60px_-20px_rgba(0,0,0,0.9)]" />
        <div className="absolute inset-x-0 top-0 h-[62%] rounded-[50%] border-2 border-mint/70 bg-[radial-gradient(ellipse_at_center,var(--lp-plinth-top-1),var(--lp-plinth-top-2)_70%)] shadow-[0_0_40px_rgb(var(--lp-mint)/0.7),inset_0_0_30px_rgb(var(--lp-mint)/0.45)]" />
        <div className="absolute inset-x-[12%] top-[12%] h-[38%] rounded-[50%] border border-mint/50 shadow-[0_0_18px_rgb(var(--lp-mint)/0.6)]" />
        <div className="absolute inset-x-[26%] top-[20%] h-[22%] rounded-[50%] bg-mint/25 blur-md" />
      </div>

      <Orbits half="back" moving={moving} />

      {/* The laptop, in 3D: the screen stands on the hinge, the deck lies flat towards us. */}
      <div
        className="absolute left-[20%] right-[16%] top-[19%] motion-safe:animate-[float_8s_ease-in-out_infinite]"
        style={{ perspective: '1700px' }}
      >
        <div
          className="relative"
          style={{ transformStyle: 'preserve-3d', transform: 'rotateY(-22deg) rotateX(8deg)' }}
        >
          <div
            className="rounded-t-[0.8rem] border border-white/25 bg-[#0a0f0d] p-[2.2%] pb-[3%] shadow-[0_0_50px_-6px_rgb(var(--lp-mint)/0.55)]"
            style={{ transformOrigin: '50% 100%', transform: 'rotateX(4deg)' }}
          >
            <div className="aspect-[16/10] overflow-hidden rounded-[0.3rem]">
              <Dashboard stats={stats} />
            </div>
          </div>
          <div
            className="relative -mx-[5%] aspect-[16/8.5] rounded-b-[1.4rem] bg-gradient-to-b from-[#c8d4cf] via-[#a8b8b1] to-[#7d8f88]"
            style={{
              transformOrigin: '50% 0',
              transform: 'rotateX(64deg)',
              transformStyle: 'preserve-3d',
            }}
          >
            <div className="absolute inset-x-[9%] top-[7%] h-[48%] rounded-md bg-[repeating-linear-gradient(90deg,#1b2622_0_7%,transparent_7%_7.6%),repeating-linear-gradient(0deg,#1b2622_0_17%,transparent_17%_20%)] opacity-90" />
            <div className="absolute left-1/2 top-[62%] h-[30%] w-[32%] -translate-x-1/2 rounded-md bg-[#b9c7c1] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]" />
          </div>
        </div>
      </div>

      <Orbits half="front" moving={moving} />

      {BUBBLES.map(([left, top, size, seconds], index) => (
        <span
          key={`${left}-${top}`}
          className={`absolute rounded-full motion-safe:animate-[float_ease-in-out_infinite] ${index > 3 ? 'hidden sm:block' : ''}`}
          style={{
            ...sphereStyle,
            left: `${left}%`,
            top: `${top}%`,
            width: size,
            height: size,
            animationDuration: `${seconds}s`,
            animationDelay: `${-index}s`,
          }}
        />
      ))}

      {TILES.map(({ label, Glyph, position, tilt, delay }) => (
        <div
          key={label}
          className={`absolute ${position} hidden w-[21%] max-w-[8.5rem] motion-safe:animate-[float_7s_ease-in-out_infinite] sm:block`}
          style={{ animationDelay: delay }}
        >
          <div
            className="flex aspect-square flex-col items-center justify-center gap-[8%] rounded-[1.4rem] border border-white/45 bg-[linear-gradient(145deg,rgba(255,255,255,0.32),rgba(255,255,255,0.08)_45%,rgb(var(--lp-mint)/0.18))] text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.7),inset_0_-12px_24px_rgb(var(--lp-mint)/0.2),0_24px_50px_-14px_rgba(0,0,0,0.7),0_0_34px_rgb(var(--lp-mint)/0.35)] backdrop-blur-md"
            style={{ transform: `rotate(${tilt}deg)` }}
          >
            <Glyph className="h-[42%] w-[42%] drop-shadow-[0_0_12px_rgb(var(--lp-mint)/0.95)]" />
            <span className="text-[11px] font-bold [text-shadow:0_1px_6px_rgba(0,0,0,0.6)] lg:text-sm">
              {label}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
