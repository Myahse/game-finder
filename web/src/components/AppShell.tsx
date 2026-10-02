import { useCallback, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Bell, BasketballIcon, CalendarDays, MapPin, User, Wrench } from './icons'
import { useAuth } from '../lib/auth'
import { useRealtime } from '../lib/realtime'
import { useNotifications } from '../lib/queries'
import { EngagementPrompts } from './EngagementPrompts'
import { PresenceWatcher } from './PresenceWatcher'
import type { RealtimeEvent } from '../lib/types'
import { useLocale } from '../i18n/LocaleProvider'
type Tab = { to: string; labelKey: 'map' | 'play' | 'myGames' | 'alerts' | 'profile'; end?: boolean; navIcon: ReactNode }

const tabs: Tab[] = [
  { to: '/', labelKey: 'map', end: true, navIcon: <MapPin className="size-6 md:size-5" aria-hidden /> },
  { to: '/play', labelKey: 'play', navIcon: <BasketballIcon className="size-6 md:size-5" /> },
  { to: '/my-games', labelKey: 'myGames', navIcon: <CalendarDays className="size-6 md:size-5" aria-hidden /> },
  { to: '/notifications', labelKey: 'alerts', navIcon: <Bell className="size-6 md:size-5" aria-hidden /> },
  { to: '/profile', labelKey: 'profile', navIcon: <User className="size-6 md:size-5" aria-hidden /> },
]

export function AppShell() {
  const { t } = useLocale()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const isMap = pathname === '/'
  const { data: notes } = useNotifications(!!user)

  const onNotification = useCallback(
    (ev: Extract<RealtimeEvent, { type: 'notification' }>) => {
      const link = ev.data.game_id
        ? `/games/${ev.data.game_id}`
        : ev.data.court_id
          ? `/?court=${ev.data.court_id}`
          : undefined
      toast(ev.title, {
        id: ev.id,
        description: ev.body,
        duration: 6000,
        action: link
          ? {
              label: t.common.open,
              onClick: () => navigate(link),
            }
          : undefined,
      })
      if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        const n = new Notification(ev.title, { body: ev.body, tag: ev.id, icon: '/favicon.svg' })
        n.onclick = () => {
          window.focus()
          if (link) navigate(link)
        }
      }
    },
    [navigate, t.common.open],
  )
  useRealtime(user?.id ?? null, onNotification)

  return (
    <div className="flex h-full flex-col md:flex-row">
      <nav
        className="fixed inset-x-4 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-30 flex shrink-0 rounded-2xl border border-line bg-surface shadow-[0_8px_28px_rgba(0,0,0,0.14)] md:static md:inset-auto md:bottom-auto md:z-auto md:w-56 md:flex-col md:rounded-none md:border-r md:border-t-0 md:p-3 md:shadow-none"
      >
        <div className="display hidden px-3 pb-6 pt-2 text-3xl font-extrabold md:block">
          Find the <span className="text-brand">Game</span>
        </div>
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold md:flex-none md:flex-row md:gap-3 md:rounded-xl md:px-3 md:py-2.5 md:text-sm ${
                isActive ? 'text-brand md:bg-brand/10' : 'text-ink-2 hover:text-ink'
              }`
            }
          >
            <span className="text-xl md:text-lg" aria-hidden>
              {tab.navIcon}
            </span>
            {t.nav[tab.labelKey]}
            {tab.to === '/notifications' && !!notes?.unread && (
              <span className="absolute right-[calc(50%-22px)] top-1 rounded-full bg-brand px-1.5 text-[10px] font-bold text-white md:static md:ml-auto">
                {notes.unread}
              </span>
            )}
          </NavLink>
        ))}
        {user?.role === 'admin' && (
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              `hidden items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold md:flex ${
                isActive ? 'bg-brand/10 text-brand' : 'text-ink-2 hover:text-ink'
              }`
            }
          >
            <Wrench className="size-5 shrink-0" aria-hidden /> {t.nav.admin}
          </NavLink>
        )}
      </nav>

      <main
        className={`relative min-h-0 flex-1 overflow-y-auto md:pb-0 ${
          isMap ? 'pb-0' : 'pb-[calc(5rem+env(safe-area-inset-bottom))]'
        }`}
      >
        <Outlet />
      </main>

      <PresenceWatcher />
      <EngagementPrompts enabled={!!user} />
    </div>
  )
}
