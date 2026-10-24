import type { ComponentType } from 'react'

import { ApprovedIcon, DecisionIcon, ReviewIcon, type AdminIconSize } from './AdminIcons'

export interface AdminTab {
  to: string
  label: string
  icon: ComponentType<{ size?: AdminIconSize }>
}

/*
  Console sections that share one sidebar entry. Each tab is still its own page
  at its own address, so links, bookmarks and the back button keep working; the
  tabs only put the related pages side by side. The sidebar reads these lists
  to know which entry is "current" on any of their pages.
*/
export const REVIEW_TABS: AdminTab[] = [
  { to: '/app/admin/reviews', label: 'Reviews', icon: ReviewIcon },
  { to: '/app/admin/approvals', label: 'Approvals', icon: ApprovedIcon },
  { to: '/app/admin/decisions', label: 'Decisions', icon: DecisionIcon },
]
