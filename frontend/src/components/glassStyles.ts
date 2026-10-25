/**
 * The frosted-glass look shared by the workspace's create forms (organization,
 * team): a translucent card over soft colour, translucent fields that firm up on
 * focus, and a glowing primary button. One place, so the forms stay one product.
 */

export const glassCardClasses =
  "relative isolate overflow-hidden rounded-3xl border border-white/80 bg-white/50 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_24px_60px_-32px_rgba(8,75,56,0.5)] ring-1 ring-slate-900/5 backdrop-blur-xl sm:p-7";

/** The dashed "nothing here yet" box beside a glass form. */
export const glassEmptyClasses =
  "rounded-3xl border border-dashed border-brand-200 bg-white/50 p-5 ring-1 ring-slate-900/5 backdrop-blur-xl";

export const glassButtonClasses =
  "mt-6 h-11 w-full rounded-xl border border-white/30 bg-linear-to-r from-brand-600 to-brand-500 px-4 text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_12px_28px_-12px_rgba(20,99,73,0.8)] hover:from-brand-700 hover:to-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 motion-safe:transition-colors";

/** A frosted field: translucent white that firms up on focus. */
export function glassInputClasses(
  hasError: boolean,
  { multiline = false } = {},
): string {
  return [
    `block w-full rounded-xl border bg-white/60 px-3.5 text-sm text-gray-900 shadow-[inset_0_1px_2px_rgba(15,74,55,0.08)] backdrop-blur-sm`,
    multiline ? "resize-y py-2.5" : "h-11",
    "placeholder:text-gray-400 focus:bg-white/90 focus:outline-none focus:ring-2",
    "motion-safe:transition-[background-color,border-color,box-shadow] motion-safe:duration-150",
    hasError
      ? "border-red-300 focus:border-red-400 focus:ring-red-200"
      : "border-white/90 hover:border-brand-200 focus:border-brand-300 focus:ring-brand-200/70",
  ].join(" ");
}
