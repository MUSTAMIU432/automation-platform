import { NavLink, Outlet } from 'react-router-dom'

import { REVIEW_TABS, type AdminTab } from './sectionTabs'

/** A row of in-page tabs, one per related console page. */
export function AdminSectionTabs({ label, tabs }: { label: string; tabs: AdminTab[] }) {
  return (
    <nav aria-label={label} className="mb-6 overflow-x-auto border-b border-slate-200">
      <ul className="-mb-px flex gap-1">
        {tabs.map(({ to, label: tabLabel, icon: TabIcon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end
              className={({ isActive }) =>
                `flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors focus:outline-none focus-visible:rounded-t-lg focus-visible:ring-2 focus-visible:ring-brand-300 ${
                  isActive
                    ? 'border-brand-600 text-slate-900'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={isActive ? 'text-brand-600' : 'text-slate-400'}>
                    <TabIcon size="sm" />
                  </span>
                  {tabLabel}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** The layout route for Reviews, Approvals and Decisions: one review, three outcomes views. */
export function ReviewTabsLayout() {
  return (
    <>
      <AdminSectionTabs label="Reviews" tabs={REVIEW_TABS} />
      <Outlet />
    </>
  )
}
