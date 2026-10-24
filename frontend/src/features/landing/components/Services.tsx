import type { ComponentType, CSSProperties } from 'react'
import { Link } from 'react-router-dom'

import { useReveal } from '../hooks/useReveal'
import { ArrowRightIcon, BulbIcon, LayersIcon, SparkIcon, UsersIcon } from './icons'
import { SectionHeading } from './SectionHeading'

interface Service {
  title: string
  description: string
  Icon: ComponentType<{ className?: string }>
  /** Only where a real page exists; app pages ask a visitor to sign in first. */
  link?: { to: string; label: string }
}

/* Each description is what the platform does today - see docs/ for the detail. */
const SERVICES: Service[] = [
  {
    title: 'Idea Management',
    description:
      'Describe a problem, submit it as an idea with the story behind it, and organize ideas by category, team or organization.',
    Icon: BulbIcon,
    link: { to: '/app/ideas/new', label: 'Submit an idea' },
  },
  {
    title: 'Collaborative Review',
    description:
      'Review teams assess each idea, ask the owner what they need to know, and record their decision in a letter the owner can read.',
    Icon: UsersIcon,
  },
  {
    title: 'Project Support',
    description:
      'Approved ideas become projects with a written proposal, an implementation plan, staged milestones and tasks, each approved in turn.',
    Icon: LayersIcon,
  },
  {
    title: 'AI Assistance',
    description:
      "AI drafts proposal sections from the idea's own story. Reviewers edit every draft, so only the words they choose are kept.",
    Icon: SparkIcon,
  },
]

function ServiceCard({ service, index }: { service: Service; index: number }) {
  const ref = useReveal<HTMLLIElement>()
  const { Icon } = service

  return (
    <li
      ref={ref}
      style={{ '--reveal-delay': `${index * 90}ms` } as CSSProperties}
      className="group flex flex-col rounded-2xl border border-jade/10 bg-white p-6 shadow-[0_1px_2px_rgba(20,45,37,0.04),0_8px_24px_-12px_rgba(20,45,37,0.12)] hover:-translate-y-1 hover:border-jade/30 hover:shadow-[0_18px_40px_-18px_rgba(11,143,101,0.45)] motion-safe:transition-[transform,box-shadow,border-color] motion-safe:duration-300"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-mist text-jade ring-1 ring-jade/10 group-hover:bg-jade group-hover:text-white motion-safe:transition-colors">
        <Icon className="h-6 w-6" />
      </span>
      <h3 className="mt-5 text-lg font-semibold text-ink">{service.title}</h3>
      <p className="mt-2 flex-1 text-[15px] leading-relaxed text-sage">{service.description}</p>
      {service.link && (
        <Link
          to={service.link.to}
          className="mt-5 inline-flex items-center gap-1.5 self-start rounded text-sm font-semibold text-jade hover:text-pine focus:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
        >
          {service.link.label}
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      )}
    </li>
  )
}

export function Services() {
  return (
    <section
      id="services"
      aria-labelledby="services-heading"
      className="scroll-mt-24 bg-white py-20 sm:py-28"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id="services-heading"
          eyebrow="Services"
          title="Everything an idea needs on its way to becoming software"
          description="One place for the people who have the problem, the people who assess it, and the people who build the answer."
        />
        <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((service, index) => (
            <ServiceCard key={service.title} service={service} index={index} />
          ))}
        </ul>
      </div>
    </section>
  )
}
