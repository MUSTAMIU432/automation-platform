import { useReveal } from '../hooks/useReveal'

interface SectionHeadingProps {
  id: string
  eyebrow: string
  title: string
  description?: string
  /** `dark` for a section on the forest background. */
  tone?: 'light' | 'dark'
  align?: 'center' | 'start'
}

/** The eyebrow, heading and lead paragraph every homepage section opens with. */
export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  tone = 'light',
  align = 'center',
}: SectionHeadingProps) {
  const ref = useReveal<HTMLDivElement>()
  const dark = tone === 'dark'

  return (
    <div ref={ref} className={align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-xl'}>
      <p
        className={`text-sm font-semibold uppercase tracking-[0.14em] ${dark ? 'text-mint' : 'text-jade'}`}
      >
        {eyebrow}
      </p>
      <h2
        id={id}
        className={`mt-3 text-3xl font-bold tracking-tight sm:text-4xl ${dark ? 'text-white' : 'text-ink'}`}
      >
        {title}
      </h2>
      {description && (
        <p
          className={`mt-4 text-base leading-relaxed sm:text-lg ${dark ? 'text-white/75' : 'text-sage'}`}
        >
          {description}
        </p>
      )}
    </div>
  )
}
