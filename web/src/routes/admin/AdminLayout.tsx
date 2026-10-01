import { NavLink, Outlet } from 'react-router-dom'
import { PageHeader } from '../../components/ui'

const tabs = [
  { to: '/admin', label: 'Stats', end: true },
  { to: '/admin/courts', label: 'Courts' },
  { to: '/admin/games', label: 'Games' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/reports', label: 'Reports' },
  { to: '/admin/settings', label: 'Settings' },
]

export function AdminLayout() {
  return (
    <div className="pb-10">
      <PageHeader title="Admin" />
      <nav className="flex gap-1 overflow-x-auto border-b border-line px-3">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `shrink-0 border-b-2 px-3 py-2.5 text-sm font-semibold ${isActive ? 'border-brand text-brand' : 'border-transparent text-ink-2 hover:text-ink'}`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      <div className="mx-auto max-w-5xl p-4">
        <Outlet />
      </div>
    </div>
  )
}
