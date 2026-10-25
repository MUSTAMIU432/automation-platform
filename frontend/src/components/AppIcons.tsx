/**
 * Line icons for the signed-in app's shell and dashboard. Decorative: every
 * one sits next to text that names what it stands for.
 */

import type { ReactNode } from 'react'

interface IconProps {
  className?: string
}

function Icon({ className = 'h-5 w-5', children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  )
}

export function GridIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </Icon>
  )
}

export function BulbIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2V16h5v-.2c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 3Z" />
    </Icon>
  )
}

export function StoreIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 9.5 5.5 4h13L20 9.5" />
      <path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0" />
      <path d="M5.5 12v8h13v-8M10 20v-4.5h4V20" />
    </Icon>
  )
}

export function FlowIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="6.5" cy="6.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
      <path d="M9 6.5h4.5a3 3 0 0 1 3 3v5.5" />
      <path d="M15 17.5h-4.5a3 3 0 0 1-3-3V9" />
    </Icon>
  )
}

export function BuildingIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20h16M6 20V9l6-4 6 4v11" />
      <path d="M9.5 12v5M14.5 12v5" />
    </Icon>
  )
}

export function UsersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20a6 6 0 0 1 12 0M16 4.5a3.2 3.2 0 0 1 0 6.3M21 20a6 6 0 0 0-3.5-5.4" />
    </Icon>
  )
}

export function ChatIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 5h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 3.5V15H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
      <path d="M19 9h1a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1v2.5L16 18" />
    </Icon>
  )
}

export function ChecklistIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="5" y="3.5" width="14" height="17" rx="2" />
      <path d="m8.5 10 2 2 4-4M8.5 16h7" />
    </Icon>
  )
}

export function CodeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m8 7-5 5 5 5M16 7l5 5-5 5M13.5 4l-3 16" />
    </Icon>
  )
}

export function DocumentIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </Icon>
  )
}

export function ClockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Icon>
  )
}

export function CheckCircleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </Icon>
  )
}

export function ShareNodesIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6" />
    </Icon>
  )
}

export function ChartIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20h16M7 16v-4M12 16V8M17 16v-7" />
    </Icon>
  )
}

export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </Icon>
  )
}

export function MenuIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Icon>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Icon>
  )
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m9.5 6 6 6-6 6" />
    </Icon>
  )
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Icon>
  )
}

export function BankIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 9.5 12 4l9 5.5M4.5 9.5h15M4 20h16M6 12v5.5M10 12v5.5M14 12v5.5M18 12v5.5" />
    </Icon>
  )
}

export function LeafIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14Z" />
      <path d="M5 19c3-4 6-7 10-9" />
    </Icon>
  )
}

export function CapIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m2.5 9 9.5-4.5L21.5 9 12 13.5 2.5 9Z" />
      <path d="M6.5 11v4.5c1.5 1.5 3.5 2.2 5.5 2.2s4-.7 5.5-2.2V11M21.5 9v5" />
    </Icon>
  )
}

export function HeartIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z" />
    </Icon>
  )
}

export function TruckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 6.5h11v9.5H3zM14 10h4l3 3v3h-7" />
      <circle cx="7" cy="17.5" r="1.8" />
      <circle cx="17.5" cy="17.5" r="1.8" />
    </Icon>
  )
}

export function DotsVerticalIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="5.5" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="18.5" r="1" />
    </Icon>
  )
}

export function SlidersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </Icon>
  )
}

export function ListIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" />
    </Icon>
  )
}

export function TagIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 12.5V4.5h8l9 9-8 8-9-9Z" />
      <circle cx="8" cy="9" r="1.3" />
    </Icon>
  )
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  )
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 9.5 6 6 6-6" />
    </Icon>
  )
}

export function RefreshIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4" />
    </Icon>
  )
}

export function PencilIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
      <path d="m13.5 6.5 4 4" />
    </Icon>
  )
}

export function PaperclipIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m20 11.5-8.2 8.2a5 5 0 0 1-7.1-7.1l8.6-8.6a3.4 3.4 0 0 1 4.8 4.8l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9" />
    </Icon>
  )
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M19 12H5" />
      <path d="m11 6-6 6 6 6" />
    </Icon>
  )
}

export function SendIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M21 3 10 14" />
      <path d="M21 3 14.5 21l-4.5-7-7-4.5L21 3Z" />
    </Icon>
  )
}

/** Collapse a side panel: a panel with an arrow pointing into it. */
export function PanelCollapseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2.5" />
      <path d="M9 3v18" />
      <path d="m16 15-3-3 3-3" />
    </Icon>
  )
}

/** Expand a side panel: the same panel, the arrow pointing out. */
export function PanelExpandIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2.5" />
      <path d="M9 3v18" />
      <path d="m14 9 3 3-3 3" />
    </Icon>
  )
}
