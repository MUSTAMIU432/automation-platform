import type { ComponentType } from 'react'
import { Link } from 'react-router-dom'

import {
  ArrowRightIcon,
  BulbIcon,
  ChatIcon,
  GridIcon,
  HelpIcon,
  StoreIcon,
  UsersIcon,
} from '../components/AppIcons'
import { collectionCardClasses } from '../components/glassStyles'

const JOURNEY: Array<{
  step: string
  title: string
  text: string
  to: string
  action: string
  Icon: ComponentType<{ className?: string }>
}> = [
  {
    step: '1',
    title: 'Start',
    text: 'Your dashboard shows where your work stands and what needs you next.',
    to: '/app',
    action: 'Open the dashboard',
    Icon: GridIcon,
  },
  {
    step: '2',
    title: 'Your people',
    text: 'Create or join an organization or a team - the people an idea is put forward with.',
    to: '/app/organizations',
    action: 'Go to organizations',
    Icon: UsersIcon,
  },
  {
    step: '3',
    title: 'Idea to solution',
    text: 'Share a problem, save it as a draft, and submit it. It is reviewed, turned into an automation and built.',
    to: '/app/ideas',
    action: 'Share a problem',
    Icon: BulbIcon,
  },
  {
    step: '4',
    title: 'Market',
    text: 'Unlock the documentation behind ideas the platform has published, ready to build.',
    to: '/app/marketplace',
    action: 'Visit the marketplace',
    Icon: StoreIcon,
  },
]

const QUESTIONS: Array<[string, string]> = [
  [
    'How do I share a problem?',
    'Open Ideas and choose to put a problem forward. Only its name is needed to save a draft, so you can stop at any step and come back later. Submit it when it is ready to be looked at.',
  ],
  [
    'Why can I not submit my idea?',
    'Submitting needs a category and a full description. The form says what is missing and opens the step it is on. A draft can always be saved.',
  ],
  [
    'What happens after I submit?',
    'A reviewer reads it. You get a notification when it is approved or when changes are asked for, and you can answer them and submit again.',
  ],
  [
    'Should I use an organization or a team?',
    'An organization is shared work with its own reviewers. A team is simply the people who write an idea with you, and needs no organization.',
  ],
]

/**
 * Help & Support at `/app/help`: how the platform's journey goes, the questions
 * people ask first, and a way to reach the team. Everything links to the real
 * place it describes, and the contact goes through the website's contact form.
 */
export function HelpPage() {
  return (
    <>
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          Help & Support
        </h1>
        <p className="mt-3 text-base leading-7 text-gray-600">
          How MUSTANET works, the questions people ask first, and how to reach us.
        </p>
      </div>

      <section aria-labelledby="journey-heading" className="mt-8">
        <h2 id="journey-heading" className="text-lg font-bold text-gray-900">
          How it works
        </h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {JOURNEY.map(({ step, title, text, to, action, Icon }) => (
            <li key={step} className={`${collectionCardClasses} flex flex-col`}>
              <span className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-brand-500 to-teal-500 text-white shadow-sm">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-xs font-semibold tracking-[0.16em] text-brand-700 uppercase">
                  Step {step}
                </span>
              </span>
              <span className="mt-4 text-base font-bold text-gray-900">{title}</span>
              <span className="mt-1 flex-1 text-sm leading-6 text-gray-600">{text}</span>
              <Link
                to={to}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800"
              >
                {action}
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section aria-labelledby="questions-heading" className={collectionCardClasses}>
          <h2 id="questions-heading" className="text-lg font-bold text-gray-900">
            Common questions
          </h2>
          <div className="mt-3 divide-y divide-slate-100">
            {QUESTIONS.map(([question, answer]) => (
              <details key={question} className="group py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
                  {question}
                  <span
                    aria-hidden="true"
                    className="text-lg leading-none text-brand-600 group-open:rotate-45 motion-safe:transition-transform"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-2 text-sm leading-6 text-gray-600">{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section aria-labelledby="contact-heading" className={collectionCardClasses}>
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
            <ChatIcon className="h-6 w-6" />
          </span>
          <h2 id="contact-heading" className="mt-4 text-lg font-bold text-gray-900">
            Still need help?
          </h2>
          <p className="mt-1 text-sm leading-6 text-gray-600">
            Send the team a message and we will get back to you by email.
          </p>
          <a
            href="/#contact"
            className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-brand-700 to-brand-600 px-5 text-sm font-semibold text-white shadow-[0_12px_26px_-12px_rgba(20,99,73,0.85)] hover:from-brand-800 hover:to-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
          >
            <HelpIcon className="h-4 w-4" />
            Contact support
          </a>
        </section>
      </div>
    </>
  )
}
