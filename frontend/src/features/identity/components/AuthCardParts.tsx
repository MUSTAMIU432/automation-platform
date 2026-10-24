/** A form's centred title, with its line of quiet, widely spaced capitals under it. */
export function AuthHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="text-center">
      <h1 className="text-[26px] font-bold tracking-tight text-ink sm:text-[28px]">{title}</h1>
      <p className="mt-1.5 text-xs font-semibold uppercase tracking-[0.28em] text-sage">
        {subtitle}
      </p>
    </div>
  )
}
