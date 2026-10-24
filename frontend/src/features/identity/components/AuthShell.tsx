import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { GlassBackdrop } from '../../../components/GlassScene'
import { AuthBrandPanel, BrandMark } from './AuthBrandPanel'
import { FieldAppearanceContext } from './fieldAppearance'

interface AuthShellProps {
  children: ReactNode
  /** The Sign In / Sign Up switch, shown at the very top of the card. */
  tabs?: ReactNode
}

/* Opaque in the middle, fading to nothing over the outer stretch of each side. */
const FADE_X = 'linear-gradient(to right, transparent, #000 7%, #000 93%, transparent)'
const FADE_Y = 'linear-gradient(to bottom, transparent, #000 7%, #000 93%, transparent)'
const EDGE_FADE = {
  maskImage: `${FADE_X}, ${FADE_Y}`,
  maskComposite: 'intersect',
  WebkitMaskImage: `${FADE_X}, ${FADE_Y}`,
  WebkitMaskComposite: 'source-in',
} as const

/**
 * Shared shell for every page in the auth system (/auth, /reset-password,
 * /activate-account): the website's glass scene and frame, the brand promise,
 * and the form on a floating neumorphic card - one flat mint-white surface
 * with the fields pressed into it (it switches the identity controls inside
 * it to their `soft` appearance). Pulled out of AuthPage so
 * the emailed-link pages visually belong to the same system without
 * duplicating this markup.
 */
export function AuthShell({ children, tabs }: AuthShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#03140f] px-2 py-2 text-white sm:px-4 sm:py-3 lg:px-6">
      <GlassBackdrop />

      <div className="relative mx-auto flex min-h-[calc(100vh-1rem)] max-w-[92rem] flex-col sm:min-h-[calc(100vh-1.5rem)]">
        {/*
          The frosted panel behind the content, on a layer of its own so it can fade
          out towards every edge: the container melts into the scene instead of
          stopping at an outline, while the content above it stays sharp.
        */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-4 bg-[linear-gradient(180deg,rgba(6,47,37,0.55),rgba(4,32,25,0.45)_45%,rgba(6,47,37,0.55))] backdrop-blur-2xl"
          style={EDGE_FADE}
        />
        <header className="relative flex items-center justify-between gap-4 px-4 py-3 motion-safe:animate-[drop-in_600ms_ease-out] sm:px-8 lg:px-10">
          <BrandMark />
          <Link
            to="/"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/30 bg-white/5 px-4 text-sm font-semibold text-white hover:border-white/60 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-mint motion-safe:transition-colors"
          >
            <span aria-hidden="true">&larr;</span> Back to home
          </Link>
        </header>

        <div className="relative mx-auto grid w-full max-w-7xl flex-1 items-center gap-6 px-3 pb-6 pt-2 sm:gap-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,31rem)] lg:gap-10 lg:px-10 xl:grid-cols-[1fr_minmax(0,33rem)] xl:gap-16">
          <div className="motion-safe:animate-[rise_700ms_ease-out_both]">
            <AuthBrandPanel />
          </div>

          {/*
            min-w-0: without it, a grid item's automatic minimum width is its
            content's intrinsic size — and a plain <input> carries its own
            content-based minimum (from the default 20-character sizing hint)
            that flex-basis/min-w-0 on the input itself doesn't fully cancel out
            for the purposes of an ancestor's auto grid track. That let the phone
            number field force this whole column (and the page) wider than the
            viewport on narrow screens. min-w-0 here caps the track at the
            available width instead.
          */}
          <div className="min-w-0 motion-safe:animate-[rise_700ms_ease-out_150ms_both]">
            {/* Floats while looked at; holds still while used (pointer over it, or a field focused). */}
            <div className="hover:[animation-play-state:paused] focus-within:[animation-play-state:paused] motion-safe:animate-[float-soft_9s_ease-in-out_infinite]">
              <div className="rounded-[2.25rem] border border-white/70 bg-neu px-6 pb-7 pt-8 text-left text-ink shadow-[inset_0_1px_0_#fff,0_50px_90px_-30px_rgba(0,0,0,0.9),0_0_70px_-20px_rgba(85,230,176,0.5)] sm:px-10 sm:pb-8">
                {tabs && <div className="mb-7">{tabs}</div>}
                <div>
                  <FieldAppearanceContext.Provider value="soft">
                    {children}
                  </FieldAppearanceContext.Provider>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
