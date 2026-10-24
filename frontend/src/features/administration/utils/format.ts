import type { AdminAuditAction, AdminAuditEntry, AdminIdeaHome } from '../api/administrationApi'

/** Presentation only: labels for what the server returned. */

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDay(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** Whose idea it is: its organization, its team, or "Individual". */
export function ideaHomeLabel(idea: AdminIdeaHome): string {
  if (idea.submissionContext === 'ORGANIZATION' && idea.organization) return idea.organization.name
  if (idea.submissionContext === 'TEAM' && idea.teamName) return `Team: ${idea.teamName}`
  if (idea.submissionContext === 'TEAM') return 'Team'
  return 'Individual'
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function fullName(user: { firstName: string; lastName: string; email: string }): string {
  return `${user.firstName} ${user.lastName}`.trim() || user.email
}

export const AUDIT_ACTION_LABELS: Record<AdminAuditAction, string> = {
  USER_ACTIVATED: 'Account activated',
  USER_DEACTIVATED: 'Account deactivated',
  MEMBERSHIP_ROLE_ASSIGNED: 'Organization role assigned',
  MEMBERSHIP_ROLE_REMOVED: 'Organization role removed',
  CATEGORY_CREATED: 'Category created',
  CATEGORY_UPDATED: 'Category updated',
  CATEGORY_ACTIVATED: 'Category reactivated',
  CATEGORY_DEACTIVATED: 'Category retired',
  ATTACHMENT_DOWNLOADED: 'Evidence downloaded',
  PLATFORM_ADMIN_GRANTED: 'Platform administration granted',
  PLATFORM_ADMIN_REVOKED: 'Platform administration revoked',
  PLATFORM_REVIEWER_ASSIGNED: 'Platform reviewer assigned',
  PLATFORM_REVIEWER_UNASSIGNED: 'Platform reviewer unassigned',
  PLATFORM_SUBMISSION_LOCKED: 'Submission locked for review',
  PLATFORM_REVIEW_APPROVED: 'Platform review approved',
  PLATFORM_REVIEW_CHANGES_REQUESTED: 'Platform review asked for changes',
  PLATFORM_REVIEW_REJECTED: 'Platform review rejected',
  REPORT_GENERATED: 'Review report generated',
  IDEA_OWNER_GO_AHEAD: 'Owner gave the go-ahead',
  REVIEWER_GRANTED: 'Reviewer added',
  REVIEWER_REVOKED: 'Reviewer removed',
  REVIEW_TEAM_CREATED: 'Review team created',
  REVIEW_TEAM_UPDATED: 'Review team updated',
  REVIEW_TEAM_ASSIGNED: 'Idea assigned to a review team',
  PROPOSAL_SUBMITTED: 'Proposal submitted',
  PROPOSAL_CHANGES_REQUESTED: 'Proposal sent back for changes',
  PROPOSAL_RELEASED: 'Proposal released to the owner',
  PROPOSAL_DECLINED: 'Proposal declined',
  PLATFORM_ROLE_GRANTED: 'Platform role given',
  PLATFORM_ROLE_REVOKED: 'Platform role removed',
  DECISION_LETTER_SENT: 'Decision letter sent',
  PROPOSAL_DOWNLOADED: 'Proposal downloaded as a PDF',
  MARKETPLACE_IDEA_PUBLISHED: 'Idea published to the marketplace',
  MARKETPLACE_IDEA_UNPUBLISHED: 'Idea withdrawn from the marketplace',
  MARKETPLACE_PAYMENT_CONFIRMED: 'Marketplace payment confirmed',
  MARKETPLACE_PAYMENT_REJECTED: 'Marketplace payment rejected',
}

/**
 * The console page an audit entry's target lives on, or null when there is none to open.
 *
 * A membership has no page of its own, so it opens its organization; a downloaded
 * attachment is a record of a read, not something to act on, so it opens nothing.
 */
export function auditTargetPath(entry: AdminAuditEntry): string | null {
  switch (entry.targetType) {
    case 'user':
      return `/app/admin/users/${entry.targetId}`
    case 'idea':
      return `/app/admin/ideas/${entry.targetId}`
    case 'review_team':
      return '/app/admin/reviewers'
    case 'category':
      return '/app/admin/categories'
    case 'membership':
      return entry.organizationId ? `/app/admin/organizations/${entry.organizationId}` : null
    default:
      return null
  }
}

export function auditActionLabel(action: AdminAuditAction): string {
  return AUDIT_ACTION_LABELS[action] ?? action
}

/** Shown wherever the server withheld content the administrator may not read. */
export const RESTRICTED_TITLE = 'Restricted idea'
