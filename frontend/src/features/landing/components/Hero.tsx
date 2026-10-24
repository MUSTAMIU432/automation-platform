import type { ComponentType } from 'react'
import { Link } from 'react-router-dom'

import { GlassBackdrop } from '../../../components/GlassScene'
import { useAuth } from '../../identity/auth/AuthContext'
import type { PlatformStats } from '../api/statsApi'
import { useCountUp } from '../hooks/useCountUp'
import { useParallax } from '../hooks/useParallax'
import { usePlatformStats } from '../hooks/usePlatformStats'
import { useReveal } from '../hooks/useReveal'
import { SIGN_UP_PATH } from '../sections'
import {
  BuildingGlyph,
  BulbGlyph,
  LayersGlyph,
  RisingBars,
  UsersGlyph,
} from '../../../components/glyphs'
import { HeroVisual } from './HeroVisual'
import { ArrowRightIcon } from './icons'

const STATS: Array<{
  label: string
  key: keyof PlatformStats
  Glyph: ComponentType<{ className?: string }>
}> = [
  { label: 'Ideas Submitted', key: 'ideasSubmitted', Glyph: BulbGlyph },
  { label: 'Organizations', key: 'organizations', Glyph: BuildingGlyph },
  { label: 'Projects', key: 'projects', Glyph: LayersGlyph },
  { label: 'Active Users', key: 'activeUsers', Glyph: UsersGlyph },
]

function Stat({
  label,
  value,
  Glyph,
  index,
}: {
  label: string
  value: number | null
  Glyph: ComponentType<{ className?: string }>
  index: number
}) {
  const [countRef, count] = useCountUp<HTMLSpanElement>(value)

  return (
    <li className="flex items-center gap-3 px-4 py-4 sm:gap-4 sm:px-6 sm:py-5">
      <span
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/30 bg-[linear-gradient(145deg,rgba(255,255,255,0.22),rgba(85,230,176,0.12))] text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)] motion-safe:animate-[pulse-glow_3.5s_ease-in-out_infinite] sm:h-14 sm:w-14"
        style={{ animationDelay: `${index * 0.7}s` }}
      >
        <Glyph className="h-6 w-6 drop-shadow-[0_0_8px_rgba(85,230,176,0.9)] sm:h-7 sm:w-7" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-medium text-white/75 sm:text-sm">{label}</span>
        <span
          ref={countRef}
          className="block text-2xl font-bold tabular-nums text-white sm:text-3xl"
        >
          {count === null ? '—' : count.toLocaleString()}
        </span>
      </span>
      <RisingBars className="ml-auto hidden h-7 w-11 shrink-0 text-mint xl:block" />
    </li>
  )
}

/** The platform's real figures, counted up the first time they come into view. */
function StatsBar({ stats }: { stats: PlatformStats | null }) {
  const ref = useReveal<HTMLDivElement>()

  return (
    <div ref={ref}>
      <h2 className="sr-only">MUSTANET in numbers</h2>
      <ul className="grid grid-cols-2 divide-white/10 overflow-hidden rounded-[1.6rem] border border-white/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.04))] shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_30px_60px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl lg:grid-cols-4 lg:divide-x [&>li:nth-child(-n+2)]:border-b [&>li:nth-child(-n+2)]:border-white/10 lg:[&>li:nth-child(-n+2)]:border-b-0">
        {STATS.map((stat, index) => (
          <Stat
            key={stat.key}
            label={stat.label}
            value={stats ? stats[stat.key] : null}
            Glyph={stat.Glyph}
            index={index}
          />
        ))}
      </ul>
    </div>
  )
}

/** The first screen: what MUSTANET is, the two ways forward, and the platform in numbers. */
export function Hero() {
  const { status } = useAuth()
  const getStartedPath = status === 'authenticated' ? '/app' : SIGN_UP_PATH
  const ref = useParallax<HTMLElement>()
  const stats = usePlatformStats()

  return (
    <section
      ref={ref}
      id="home"
      aria-labelledby="hero-heading"
      className="relative -mt-[84px] scroll-mt-24 overflow-hidden bg-[#03140f] px-2 pb-24 pt-2 text-white sm:px-4 sm:pb-36 sm:pt-3 lg:px-6"
    >
      <GlassBackdrop />

      {/* The glass frame the header and the hero sit in. */}
      <div className="relative mx-auto max-w-[92rem] rounded-[2rem] border border-white/15 bg-[linear-gradient(180deg,rgba(6,47,37,0.55),rgba(4,32,25,0.45)_45%,rgba(6,47,37,0.55))] shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_40px_80px_-40px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
        <div className="mx-auto max-w-7xl px-4 pb-6 pt-[104px] sm:px-8 sm:pb-8 lg:px-10">
          <div className="grid items-center gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-4">
            <div className="max-w-2xl py-4 lg:py-10">
              <p className="inline-flex items-center rounded-full border border-mint/50 bg-mint/[0.07] px-4 py-1.5 text-sm font-medium text-white/90 shadow-[0_0_20px_-6px_rgba(85,230,176,0.6)] motion-safe:animate-[rise_600ms_ease-out_both]">
                Turning Ideas into Real Solutions
              </p>
              <h1
                id="hero-heading"
                className="mt-6 text-[2.5rem] font-bold leading-[1.1] tracking-tight sm:text-6xl lg:text-[2.75rem] xl:text-[3.6rem] motion-safe:animate-[rise_700ms_ease-out_80ms_both]"
              >
                From Real Problems <br className="hidden sm:block" />
                to Real{' '}
                <span className="bg-gradient-to-r from-mint to-[#8ff5cf] bg-clip-text text-transparent [text-shadow:0_0_40px_rgba(85,230,176,0.35)]">
                  Solutions
                </span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg motion-safe:animate-[rise_700ms_ease-out_180ms_both]">
                MUSTANET is an AI-assisted platform that helps individuals, businesses, institutions
                and students transform real-world problems into software requirements and support
                their implementation.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <Link
                  to={getStartedPath}
                  className="group inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-white/40 bg-gradient-to-b from-[#7af0c3] to-mint px-8 text-base font-semibold text-forest shadow-[0_0_0_4px_rgba(85,230,176,0.18),0_0_40px_-4px_rgba(85,230,176,0.9)] hover:-translate-y-0.5 hover:shadow-[0_0_0_6px_rgba(85,230,176,0.25),0_0_56px_0_rgba(85,230,176,1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-forest motion-safe:animate-[rise_600ms_ease-out_300ms_both] motion-safe:transition-[transform,box-shadow]"
                >
                  Get Started
                  <ArrowRightIcon className="h-5 w-5 group-hover:translate-x-0.5 motion-safe:transition-transform" />
                </Link>
                <a
                  href="#services"
                  className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-white/30 bg-white/[0.06] px-8 text-base font-semibold text-white backdrop-blur hover:border-white/60 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-2 focus-visible:ring-offset-forest motion-safe:animate-[rise_600ms_ease-out_400ms_both] motion-safe:transition-colors"
                >
                  Explore Services
                </a>
              </div>
            </div>

            <div className="motion-safe:animate-[rise_900ms_ease-out_250ms_both]">
              <HeroVisual stats={stats} />
            </div>
          </div>

          <div className="mt-6 lg:mt-2">
            <StatsBar stats={stats} />
          </div>
        </div>
      </div>
    </section>
  )
}
