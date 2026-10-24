import { BulbIcon, PlusIcon } from '../../../components/AppIcons'
import { sphereStyle } from '../../../components/sphereStyle'

/**
 * The top of the Ideas page: what it is for, and the one way to start a new
 * idea - which asks where the idea belongs before anything else (see
 * `IdeasWorkspace`).
 */
export function IdeasHero({ onNewIdea }: { onNewIdea: () => void }) {
  return (
    <div className="relative">
      {/* A glass tile holding a light bulb, and two beads of light. Decorative. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-56 top-[-0.5rem] hidden h-40 w-72 xl:block"
      >
        <span className="absolute left-10 top-2 flex h-32 w-32 rotate-6 items-center justify-center rounded-[2rem] border border-white bg-gradient-to-br from-mint/70 via-jade/60 to-pine/70 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.8),0_24px_40px_-18px_rgba(8,75,56,0.7),0_0_40px_rgba(85,230,176,0.45)] motion-safe:animate-[float_9s_ease-in-out_infinite]">
          <BulbIcon className="h-14 w-14 drop-shadow-[0_0_12px_rgba(255,255,255,0.8)]" />
        </span>
        <span className="absolute left-0 top-24 h-14 w-20 -rotate-12 rounded-2xl border border-white bg-gradient-to-br from-white/80 to-mint/30 shadow-[0_16px_30px_-14px_rgba(8,75,56,0.4)]" />
        <span className="absolute right-6 top-0 h-10 w-10 rounded-full" style={sphereStyle} />
        <span className="absolute right-0 top-24 h-12 w-12 rounded-full" style={sphereStyle} />
      </div>

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Put a problem{' '}
            <span className="bg-gradient-to-r from-jade to-[#2fbf8a] bg-clip-text text-transparent">
              forward.
            </span>
          </h1>
          <p className="mt-3 text-base leading-7 text-sage">
            Describe something that should be automated. Save it as a draft while you think it
            through, then submit it when it is ready to be looked at.
          </p>
        </div>
        {/*
          The global entry point, and the only place a reader is asked where an
          idea belongs. It opens a dialog rather than navigating straight to the
          form, because an idea filed for the wrong owner is hard to notice
          afterwards - nothing breaks, it simply never reaches the queue its
          owner can see.
        */}
        <button
          type="button"
          onClick={onNewIdea}
          className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-forest px-6 text-sm font-semibold text-white shadow-[0_14px_30px_-12px_rgba(6,47,37,0.8)] hover:bg-pine focus:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
        >
          <PlusIcon className="h-5 w-5" />
          File a new idea
        </button>
      </div>
    </div>
  )
}
