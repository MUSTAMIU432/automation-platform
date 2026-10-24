/** The white card every opportunity and project is drawn on, the whole card a link. */
export const deliveryCardClass =
  'group block rounded-3xl border border-white bg-white/90 p-5 shadow-[0_16px_40px_-30px_rgba(8,75,56,0.5)] transition-shadow hover:shadow-[0_22px_50px_-28px_rgba(8,75,56,0.6)] focus:outline-none focus-visible:ring-2 focus-visible:ring-jade/40'

/** Which of the three steps an opportunity or project is on (0-based); -1 when cancelled. */
export function deliveryStep(status: string): number {
  if (status === 'cancelled') return -1
  if (status === 'completed') return 2
  if (
    status === 'project_created' ||
    [
      'planning',
      'active',
      'in_development',
      'testing',
      'ready_for_uat',
      'uat',
      'deployment',
      'deployed',
      'impact',
      'on_hold',
    ].includes(status)
  ) {
    return 1
  }
  return 0
}
