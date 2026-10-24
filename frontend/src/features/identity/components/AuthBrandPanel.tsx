import { Link } from 'react-router-dom'

import { BulbGlyph, CheckGlyph, GearGlyph, LayersGlyph } from '../../../components/glyphs'
import { Logo } from '../../../components/Logo'

const JOURNEY_STEPS = [
  { title: 'Discover', description: 'Describe a real-world problem.', Glyph: BulbGlyph },
  { title: 'Validate', description: 'Clarify the need and refine the idea.', Glyph: CheckGlyph },
  { title: 'Build', description: 'Organize requirements and tasks.', Glyph: GearGlyph },
  { title: 'Measure', description: 'Review progress and outcomes.', Glyph: LayersGlyph },
]

/**
 * The MUSTANET mark, linking back to the public website at `/` - the way out
 * of the auth system for someone who arrived here by mistake.
 */
export function BrandMark() {
  return (
    <Link
      to="/"
      aria-label="MUSTANET home"
      className="inline-flex rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-2 focus-visible:ring-offset-forest"
    >
      <Logo />
    </Link>
  )
}

/**
 * The brand side of the auth pages, in the website's hero style: the promise,
 * and - on large screens - the four-stage journey as glass tiles.
 */
export function AuthBrandPanel() {
  return (
    <div className="text-center lg:text-left">
      <p className="hidden items-center rounded-full border border-mint/50 bg-mint/[0.07] px-4 py-1.5 text-sm font-medium text-white/90 shadow-[0_0_20px_-6px_rgba(85,230,176,0.6)] sm:inline-flex">
        Turning Ideas into Real Solutions
      </p>
      <h2 className="mt-2 text-2xl font-bold leading-[1.1] tracking-tight text-white sm:mt-6 sm:text-4xl lg:text-[2.6rem] xl:text-[3.25rem]">
        From Real Problems <br className="hidden lg:block" />
        to Real{' '}
        <span className="bg-gradient-to-r from-mint to-[#8ff5cf] bg-clip-text text-transparent">
          Solutions
        </span>
      </h2>
      <p className="mx-auto mt-5 hidden max-w-md text-base leading-relaxed text-white/80 lg:mx-0 lg:block">
        Turn real-world problems into structured requirements, collaborative projects and practical
        digital solutions.
      </p>
      <ul className="mt-10 hidden max-w-xl gap-3 lg:grid xl:grid-cols-2 xl:gap-4">
        {JOURNEY_STEPS.map(({ title, description, Glyph }, index) => (
          <li
            key={title}
            className="flex items-center gap-3 rounded-2xl border border-white/20 bg-[linear-gradient(145deg,rgba(255,255,255,0.14),rgba(255,255,255,0.03))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_20px_40px_-24px_rgba(0,0,0,0.8)] backdrop-blur-md"
          >
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/30 bg-[linear-gradient(145deg,rgba(255,255,255,0.22),rgba(85,230,176,0.12))] text-white motion-safe:animate-[pulse-glow_3.5s_ease-in-out_infinite]"
              style={{ animationDelay: `${index * 0.7}s` }}
            >
              <Glyph className="h-6 w-6 drop-shadow-[0_0_8px_rgba(85,230,176,0.9)]" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-white">{title}</span>
              <span className="mt-0.5 block text-[13px] leading-snug text-white/70">
                {description}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
