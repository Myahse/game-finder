import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { timeAgo } from '../lib/format'
import { qk, useNotifications } from '../lib/queries'
import type { AppNotification } from '../lib/types'
import { Bell, notificationIcons } from '../components/icons'
import { Button, Empty, PageHeader } from '../components/ui'
import { Loading } from './CourtPage'

export function NotificationsPage() {
  const { data, isLoading } = useNotifications()
  const qc = useQueryClient()
  const navigate = useNavigate()

  const open = async (n: AppNotification) => {
    if (!n.read) {
      await api(`/api/notifications/${n.id}/read`, { method: 'POST' }).catch(() => {})
      qc.invalidateQueries({ queryKey: qk.notifications })
    }
    if (n.type === 'admin_court_request' && n.data.court_id) navigate(`/admin/courts/${n.data.court_id}`)
    else if (n.type === 'court_pending_review' && n.data.court_id) navigate(`/courts/${n.data.court_id}`)
    else if (n.type === 'admin_new_user') navigate('/admin/users')
    else if (n.type === 'friend_request') navigate('/profile')
    else if (n.type === 'achievement' && n.data.kind === 'king' && n.data.court_id) navigate(`/courts/${n.data.court_id}`)
    else if (n.type === 'achievement') navigate('/profile')
    else if (n.data.game_id) navigate(`/games/${n.data.game_id}`)
    else if (n.data.court_id) navigate(`/?court=${n.data.court_id}`)
    else if (n.data.user_id) navigate(`/users/${n.data.user_id}`)
  }

  const readAll = async () => {
    await api('/api/notifications/read-all', { method: 'POST' }).catch(() => {})
    qc.invalidateQueries({ queryKey: qk.notifications })
  }

  return (
    <div className="pb-10">
      <PageHeader
        title="Notifications"
        right={
          !!data?.unread && (
            <Button variant="ghost" className="min-h-9 px-3 text-base" onClick={readAll}>
              Mark all read
            </Button>
          )
        }
      />
      <div className="mx-auto max-w-2xl p-4">
        {isLoading ? (
          <Loading />
        ) : !data?.items.length ? (
          <Empty icon={<Bell className="size-14" strokeWidth={1.5} />} title="All quiet">
            Nearby courts and games, invites from friends, and reminders show up here. Allow location on the map and turn on notifications.
          </Empty>
        ) : (
          <ul className="grid gap-2">
            {data.items.map((n) => {
              const Icon = notificationIcons[n.type]
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => open(n)}
                    className={`flex w-full gap-3 rounded-2xl border p-3 text-left ${n.read ? 'border-line bg-surface' : 'border-brand/40 bg-brand/5'}`}
                  >
                    <Icon className="size-7 shrink-0 text-brand" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{n.title}</span>
                      <span className="block text-sm text-ink-2">{n.body}</span>
                      <span className="mt-1 block text-xs text-ink-2">{timeAgo(n.created_at)}</span>
                    </span>
                    {!n.read && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-brand" aria-label="Unread" />}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
