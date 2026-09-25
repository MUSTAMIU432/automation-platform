import { useOrganization } from '../context/useOrganization'

export function OrganizationSwitcher() {
  const { status, memberships, activeOrganization, setActiveOrganization } = useOrganization()

  if (memberships.length === 0) return null

  return (
    <label className="flex items-center gap-2 text-sm text-gray-600">
      <span className="hidden font-medium sm:inline">Working in</span>
      <select
        aria-label="Active organization"
        className="h-10 min-w-40 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={status === 'loading'}
        value={activeOrganization?.id ?? ''}
        onChange={(event) => setActiveOrganization(event.target.value)}
      >
        {memberships.map(({ organization }) => (
          <option key={organization.id} value={organization.id}>
            {organization.name}
          </option>
        ))}
      </select>
    </label>
  )
}
