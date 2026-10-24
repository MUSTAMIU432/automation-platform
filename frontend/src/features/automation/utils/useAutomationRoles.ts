import { useOutletContext } from 'react-router-dom'

import type { AutomationRoles } from '../api/automationApi'

export const NO_ROLES: AutomationRoles = {
  isDeveloper: false,
  isDeliveryManager: false,
  isReviewer: false,
}

/**
 * Which hat the person is wearing in Automation. Someone who is both developer and
 * reviewer switches between the two, so each screen shows one job at a time; anyone
 * else has the one mode their roles give them.
 */
export type AutomationMode = 'developer' | 'reviewer' | 'browse'

export interface AutomationView {
  roles: AutomationRoles
  mode: AutomationMode
}

const MODE_KEY = 'automation-mode'

/** The mode chosen last time on this browser; storage may be unavailable, which is fine. */
export function readChosenMode(): AutomationMode | null {
  try {
    const value = window.localStorage.getItem(MODE_KEY)
    return value === 'developer' || value === 'reviewer' ? value : null
  } catch {
    return null
  }
}

export function rememberMode(mode: AutomationMode): void {
  try {
    window.localStorage.setItem(MODE_KEY, mode)
  } catch {
    // A private window or blocked storage: the switch still works for this visit.
  }
}

/** The mode the roles allow, honouring the person's choice when they hold both. */
export function modeFor(roles: AutomationRoles, chosen: AutomationMode | null): AutomationMode {
  if (roles.isDeveloper && roles.isReviewer) return chosen ?? 'developer'
  if (roles.isDeveloper) return 'developer'
  if (roles.isReviewer) return 'reviewer'
  return 'browse'
}

/** The page each mode opens on. */
export const MODE_HOME: Record<AutomationMode, string> = {
  developer: 'workspace',
  reviewer: 'review-queue',
  browse: 'opportunities',
}

/** The roles and mode the Automation pages were opened with (from `AutomationLayout`). */
export function useAutomationView(): AutomationView {
  return useOutletContext<AutomationView | undefined>() ?? { roles: NO_ROLES, mode: 'browse' }
}
