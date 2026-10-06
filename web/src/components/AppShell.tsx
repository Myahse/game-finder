import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Bell, BaseSportIcon, CalendarDays, MapPin, User, Wrench } from './icons'
import { useAuth } from '../lib/auth'
import { useRealtime } from '../lib/realtime'
import { useNotifications } from '../lib/queries'
import { useLocation as useGeoLocation } from '../lib/location'
import { syncNotifyArea, type NotifyAreaState } from '../lib/notifyArea'
import { notificationLink } from '../lib/notificationLinks'
import { registerWebPush, showSystemNotification } from '../lib/webPush'
import { usePolledNotificationToasts } from '../lib/usePolledNotificationToasts'
import { CourtChangeAlert } from './CourtChangeAlert'
import { EngagementPrompts } from './EngagementPrompts'
import { hasPlayerAvatar } from '../avatar/resolve'
import { PresenceWatcher } from './PresenceWatcher'
import type { RealtimeEvent } from '../lib/types'
import { useLocale } from '../i18n/LocaleProvider'
type Tab = { to: string; labelKey: 'map' | 'play' | 'myGames' | 'alerts' | 'profile'; end?: boolean; navIcon: ReactNode }

const tabs: Tab[] = [
  { to: '/', labelKey: 'map', end: true, navIcon: <MapPin className="size-6 md:size-5" aria-hidden /> },
  { to: '/play', labelKey: 'play', navIcon: <BaseSportIcon className="size-6 md:size-5" /> },
  { to: '/my-games', labelKey: 'myGames', navIcon: <CalendarDays className="size-6 md:size-5" aria-hidden /> },
  { to: '/notifications', labelKey: 'alerts', navIcon: <Bell className="size-6 md:size-5" aria-hidden /> },
  { to: '/profile', labelKey: 'profile', navIcon: <User className="size-6 md:size-5" aria-hidden /> },
]

export function AppShell() {
  const { t } = useLocale()
  const { user, sessionReady } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const isMap = pathname === '/'
  const { coords } = useGeoLocation()
  const notifyState = useRef<NotifyAreaState>({ lastSent: null, lastAttemptMs: 0 })
  useEffect(() => {
    if (!user || !sessionReady) return
    syncNotifyArea(coords, notifyState.current)
      .then((s) => {
        notifyState.current = s
      })
      .catch(() => {})
  }, [user, sessionReady, coords])

  const onNotification = useCallback(
    (ev: Extract<RealtimeEvent, { type: 'notification' }>) => {
      if (ev.notification_type === 'presence_check') return
      const link = notificationLink({ type: ev.notification_type, data: ev.data })
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
      if (document.hidden) void showSystemNotification(ev.title, ev.body, ev.id, link)
    },
    [navigate, t.common.open],
  )

  // Re-register this device for push on each start (tokens rotate; permission may have been granted elsewhere).
  const userId = user?.id
  useEffect(() => {
    if (sessionReady && userId) void registerWebPush()
  }, [sessionReady, userId])

  useRealtime(sessionReady ? (user?.id ?? null) : null, onNotification)
  const { data: notes } = useNotifications(!!user && sessionReady, 15_000)
  usePolledNotificationToasts(notes?.items, !!user && sessionReady, t.common.open)

  return (
    <div className="flex h-full flex-col md:flex-row">
      <nav
        className="fixed inset-x-4 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-30 flex shrink-0 rounded-2xl border border-line bg-surface shadow-[0_8px_28px_rgba(0,0,0,0.14)] md:static md:inset-auto md:bottom-auto md:z-auto md:w-56 md:flex-col md:rounded-none md:border-r md:border-t-0 md:p-3 md:shadow-none"
      >
        <div className="display hidden items-center gap-1.5 px-3 pb-6 pt-2 text-3xl font-extrabold md:flex">
          <BaseSportIcon className="size-6 text-brand" />
          <span>
            Find the <span className="text-brand">Game</span>
          </span>
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
      <CourtChangeAlert enabled={!!user} />
      <EngagementPrompts
        enabled={!!user}
        onCreateAvatar={user && !hasPlayerAvatar(user) && pathname !== '/profile/avatar' ? () => navigate('/profile/avatar') : null}
        avatarLabels={{ title: t.profile.createAvatar, body: t.profile.avatarPrompt, create: t.avatarStudio.create, later: t.avatarStudio.later }}
      />
    </div>
  )
}
