import { NavLink, Outlet } from 'react-router-dom'
import { PageHeader } from '../../components/ui'
import { useLocale } from '../../i18n/LocaleProvider'

const tabs: { to: string; key: 'stats' | 'courts' | 'games' | 'users' | 'reports' | 'settings'; end?: boolean }[] = [
  { to: '/admin', key: 'stats', end: true },
  { to: '/admin/courts', key: 'courts' },
  { to: '/admin/games', key: 'games' },
  { to: '/admin/users', key: 'users' },
  { to: '/admin/reports', key: 'reports' },
  { to: '/admin/settings', key: 'settings' },
]

export function AdminLayout() {
  const { t: m } = useLocale()
  return (
    <div className="pb-10">
      <PageHeader title={m.admin.title} />
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
            {m.admin.tabs[t.key]}
          </NavLink>
        ))}
      </nav>
      <div className="mx-auto max-w-5xl p-4">
        <Outlet />
      </div>
    </div>
  )
}
