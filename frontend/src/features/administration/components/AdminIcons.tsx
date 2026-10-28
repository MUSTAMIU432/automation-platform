/**
 * The console's icon set, in one place.
 *
 * Every glyph here is drawn on the same frame - a 24-unit box, a 1.75 stroke, round
 * caps and joins - because that is what makes a row of them read as one row. An
 * icon file per page is how a dashboard ends up with four marks that are four
 * slightly different weights, and the eye reads the inconsistency before it reads
 * any of the numbers they sit above.
 *
 * `size` is a named step rather than a class a caller appends, deliberately: two
 * Tailwind size utilities in one `class` string do not compose - whichever the
 * build emits last wins - so a caller asking for a smaller icon would get the
 * default and never know why.
 *
 * All of them are `aria-hidden`. They sit beside the word they illustrate, never
 * instead of it, so a screen reader announcing them would only add noise.
 */
import type { ReactNode } from 'react'

export type AdminIconSize = 'sm' | 'md' | 'lg'

function Icon({ size = 'md', children }: { size?: AdminIconSize; children: ReactNode }) {
  const box = size === 'lg' ? 'h-9 w-9' : size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${box}`}
    >
      {children}
    </svg>
  )
}

/** The marketplace: a shop front with an awning. */
export function MarketIcon({ size }: { size?: AdminIconSize }) {
  return (
    <Icon size={size}>
      <path d="M3 9.5 4.5 4h15L21 9.5" />
      <path d="M3 9.5a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />
      <path d="M5 12.3V20h14v-7.7" />
      <path d="M10 20v-5h4v5" />
    </Icon>
  )
}

/** Payments: a card with its stripe. */
export function PaymentIcon({ size }: { size?: AdminIconSize }) {
  return (
    <Icon size={size}>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M2.5 10h19" />
      <path d="M6.5 15h4" />
    </Icon>
  )
}

/** Accounts. Two figures, so it is not read as a single person. */
export function UsersIcon({ size }: { size?: AdminIconSize }) {
  return (
    <Icon size={size}>
      <path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" />
      <circle cx="9" cy="7" r="3.25" />
      <path d="M22 20v-1.5a4 4 0 0 0-3-3.87" />
      <path d="M16 4.13a4 4 0 0 1 0 5.74" />
    </Icon>
  )
}

/** Organizations: a building, which is what a tenant is to somebody reading it. */
export function OrganizationIcon({ size }: { size?: AdminIconSize }) {
  return (
    <Icon size={size}>
      <path d="M3 21h18" />
      <path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16" />
      <path d="M15 9h2a2 2 0 0 1 2 2v10" />
      <path d="M9 7h2M9 11h2M9 15h2" />
    </Icon>
  )
}

/** Ideas: a bulb. The one glyph on the platform that means "not built yet". */
export function IdeaIcon({ size }: { size?: AdminIconSize }) {
  return (
    <Icon size={size}>
      <path d="M9 18h6" />
      <path d="M10 21.5h4" />
      <path d="M12 2.5a6.5 6.5 0 0 0-4 11.6c.6.5 1 1.2 1 2h6c0-.8.4-1.5 1-2a6.5 6.5 0 0 0-4-11.6Z" />
    </Icon>
  )
}

/** Reviews: a clipboard with a tick - what happened to an idea, not its text. */
export function ReviewIcon({ size }: { size?: AdminIconSize }) {
  return (
    <Icon size={size}>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect width="8" height="4" x="8" y="2" rx="1" />
      <path d="m9 14 2 2 4-4" />
    </Icon>
  )
}

/** Awaiting review: an inbox with something sitting in it. */
export function InboxIcon({ size }: { size?: AdminIconSize }) {
  return (
    <Icon size={size}>
      <path d="M3 13h4l1.5 3h7L17 13h4" />
      <path d="M5.5 5h13l2.5 8v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6Z" />
    </Icon>
  )
}

/** Approved: a tick in a ring. */
export function ApprovedIcon({ size }: { size?: AdminIconSize }) {
  return (
    <Icon size={size}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </Icon>
  )
}

/** Changes requested: a pencil over a sheet - the idea goes back to be edited. */
export function ChangesIcon({ size }: { size?: AdminIconSize }) {
  return (
    <Icon size={size}>
      <path d="M12 20h8" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
    </Icon>
  )
}

/** Rejected: a cross in a ring. */
export function RejectedIcon({ size }: { size?: AdminIconSize }) {
  return (
    <Icon size={size}>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </Icon>
  )
}

/** Dashboard: tiles of unequal size, the overview at a glance. */
export function DashboardIcon({ size }: { size?: AdminIconSize }) {
  return (
    <Icon size={size}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </Icon>
  )
}

/** Teams: three figures - a group, which two (accounts) does not say. */
export function TeamIcon({ size }: { size?: AdminIconSize }) {
  return (
    <Icon size={size}>
      <circle cx="12" cy="7.5" r="3" />
      <path d="M6.5 20v-1a5.5 5.5 0 0 1 11 0v1" />
      <circle cx="4.75" cy="10" r="2" />
      <path d="M1.75 19v-.5a3.5 3.5 0 0 1 3-3.46" />
      <circle cx="19.25" cy="10" r="2" />
      <path d="M22.25 19v-.5a3.5 3.5 0 0 0-3-3.46" />
    </Icon>
  )
}

/** Decisions: a gavel - the outcome, once it is final. */
export function DecisionIcon({ size }: { size?: AdminIconSize }) {
  return (
    <Icon size={size}>
      <path d="m14.5 12.5-8 8a2.12 2.12 0 1 1-3-3l8-8" />
      <path d="m16 16 6-6" />
      <path d="m8 8 6-6" />
      <path d="m9 7 8 8" />
      <path d="m21 11-8-8" />
    </Icon>
  )
}

/** Reviewers: a person with a tick - somebody trusted to judge. */
export function ReviewerIcon({ size }: { size?: AdminIconSize }) {
  return (
    <Icon size={size}>
      <circle cx="9" cy="7" r="3.5" />
      <path d="M15 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20" />
      <path d="m16 11 2 2 4-4" />
    </Icon>
  )
}

/** Platform roles: a shield with a figure - who may do what. */
export function RoleIcon({ size }: { size?: AdminIconSize }) {
  return (
    <Icon size={size}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1Z" />
      <circle cx="12" cy="10" r="2" />
      <path d="M8.75 16a3.25 3.25 0 0 1 6.5 0" />
    </Icon>
  )
}

/** Courses: an open book. */
export function CourseIcon({ size }: { size?: AdminIconSize }) {
  return (
    <Icon size={size}>
      <path d="M2 5.5A1.5 1.5 0 0 1 3.5 4H9a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5h-6A1.5 1.5 0 0 1 2 16Z" />
      <path d="M22 5.5A1.5 1.5 0 0 0 20.5 4H15a3 3 0 0 0-3 3v13a2.5 2.5 0 0 1 2.5-2.5h6A1.5 1.5 0 0 0 22 16Z" />
    </Icon>
  )
}

/** Proposals: a written document. */
export function ProposalIcon({ size }: { size?: AdminIconSize }) {
  return (
    <Icon size={size}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8M16 17H8M10 9H8" />
    </Icon>
  )
}

/** Automation: two steps joined - a workflow. */
export function AutomationIcon({ size }: { size?: AdminIconSize }) {
  return (
    <Icon size={size}>
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <path d="M7 11v4a2 2 0 0 0 2 2h4" />
      <rect x="13" y="13" width="8" height="8" rx="2" />
    </Icon>
  )
}

/** Invitations: an envelope with a plus - somebody asked to join. */
export function InvitationIcon({ size }: { size?: AdminIconSize }) {
  return (
    <Icon size={size}>
      <path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      <path d="M19 16v6M16 19h6" />
    </Icon>
  )
}

/** Messages: a speech bubble with lines of text. */
export function MessageIcon({ size }: { size?: AdminIconSize }) {
  return (
    <Icon size={size}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
      <path d="M8 9h8M8 13h5" />
    </Icon>
  )
}

/** Notifications: a bell. */
export function BellIcon({ size }: { size?: AdminIconSize }) {
  return (
    <Icon size={size}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </Icon>
  )
}

/** Categories: a label tag. */
export function TagIcon({ size }: { size?: AdminIconSize }) {
  return (
    <Icon size={size}>
      <path d="M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.42l8.7 8.7a2.43 2.43 0 0 0 3.42 0l6.58-6.58a2.43 2.43 0 0 0 0-3.42Z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </Icon>
  )
}

/** Collapse the side navigation: a panel with an arrow pointing into it. */
export function PanelCollapseIcon({ size }: { size?: AdminIconSize }) {
  return (
    <Icon size={size}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
      <path d="m16 15-3-3 3-3" />
    </Icon>
  )
}

/** Expand the side navigation: the same panel, the arrow pointing out. */
export function PanelExpandIcon({ size }: { size?: AdminIconSize }) {
  return (
    <Icon size={size}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
      <path d="m14 9 3 3-3 3" />
    </Icon>
  )
}

/** Open a menu: three lines. */
export function MenuIcon({ size }: { size?: AdminIconSize }) {
  return (
    <Icon size={size}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </Icon>
  )
}

/** Close: a cross. */
export function CloseIcon({ size }: { size?: AdminIconSize }) {
  return (
    <Icon size={size}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Icon>
  )
}

/** Back: an arrow pointing left. */
export function ArrowLeftIcon({ size }: { size?: AdminIconSize }) {
  return (
    <Icon size={size}>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </Icon>
  )
}
