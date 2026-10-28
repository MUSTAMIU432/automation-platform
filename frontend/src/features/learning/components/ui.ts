/**
 * The learning area's surfaces, in the app's glass style: translucent white over
 * the shell's soft colour, quiet borders, one strong colour for the main action.
 */

export const glassPanel =
  'rounded-3xl border border-white/80 bg-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_20px_50px_-36px_rgba(8,75,56,0.5)] ring-1 ring-slate-900/[0.04] backdrop-blur-xl'

export const primaryButton =
  'inline-flex items-center justify-center gap-2 rounded-full bg-linear-to-r from-brand-600 to-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_10px_22px_-12px_rgba(20,99,73,0.8)] hover:from-brand-700 hover:to-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-500 disabled:shadow-none motion-safe:transition-colors'

export const secondaryButton =
  'inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white/85 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-brand-300 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 disabled:cursor-not-allowed disabled:opacity-50 motion-safe:transition-colors'

export const fieldClasses =
  'block w-full rounded-xl border border-slate-300 bg-white/85 px-3.5 py-2.5 text-sm text-slate-900 shadow-[inset_0_1px_2px_rgba(15,74,55,0.08)] placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-200 focus:outline-none'

export const DIFFICULTY_CLASSES: Record<string, string> = {
  easy: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  medium: 'bg-amber-50 text-amber-800 ring-amber-200',
  hard: 'bg-rose-50 text-rose-700 ring-rose-200',
}
