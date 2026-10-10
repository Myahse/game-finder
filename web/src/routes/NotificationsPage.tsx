import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import '../styles/motion-feedback.css'
import { PushSetupCard } from '../components/PushSetupCard'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { timeAgo } from '../lib/format'
import { qk, useNotifications } from '../lib/queries'
import type { AppNotification } from '../lib/types'
import { Bell, notificationIcons } from '../components/icons'
import { Button, Empty, PageHeader, SkeletonList } from '../components/ui'
import { useLocale } from '../i18n/LocaleProvider'
import { useListIntro } from '../lib/motion'

export function NotificationsPage() {
  const { data, isLoading } = useNotifications()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { t } = useLocale()
  const nt = t.account.notifications
  const intro = useListIntro(data?.items.length ?? 0)

  // Alerts that arrive while the page is open slide in.
  const seen = useRef<Set<string> | null>(null)
  const [fresh, setFresh] = useState<Set<string>>(() => new Set())
  useEffect(() => {
    if (!data) return
    const ids = data.items.map((n) => n.id)
    if (seen.current) {
      const added = ids.filter((id) => !seen.current!.has(id))
      if (added.length) {
        setFresh(new Set(added))
        const tm = window.setTimeout(() => setFresh(new Set()), 900)
        seen.current = new Set(ids)
        return () => window.clearTimeout(tm)
      }
    }
    seen.current = new Set(ids)
  }, [data])

  const [sweeping, setSweeping] = useState(false)
  const [gone, setGone] = useState<Set<string>>(() => new Set())
  const remove = async (n: AppNotification) => {
    setGone((g) => new Set(g).add(n.id))
    await new Promise((r) => window.setTimeout(r, 280))
    await api(`/api/notifications/${n.id}`, { method: 'DELETE' }).catch(() => {})
    qc.invalidateQueries({ queryKey: qk.notifications })
  }

  const open = async (n: AppNotification) => {
    if (!n.read) {
      await api(`/api/notifications/${n.id}/read`, { method: 'POST' }).catch(() => {})
      qc.invalidateQueries({ queryKey: qk.notifications })
    }
    if (n.type === 'admin_court_request' && n.data.court_id) navigate(`/admin/courts/${n.data.court_id}`)
    else if (n.type === 'court_pending_review' && n.data.court_id) navigate(`/courts/${n.data.court_id}`)
    else if (n.type === 'admin_new_user') navigate('/admin/users')
    else if (n.type === 'friend_request') navigate('/profile')
    else if (n.type === 'challenge') navigate('/challenges')
    else if (n.type === 'achievement' && n.data.kind === 'king' && n.data.court_id) navigate(`/courts/${n.data.court_id}`)
    else if (n.type === 'achievement' && n.data.kind === 'card_tier') navigate(`/profile?card=${n.data.sport ?? ''}`)
    else if (n.type === 'achievement') navigate('/profile')
    else if (n.data.game_id) navigate(`/games/${n.data.game_id}`)
    else if (n.data.court_id) navigate(`/?court=${n.data.court_id}`)
    else if (n.data.user_id) navigate(`/users/${n.data.user_id}`)
  }

  // "Mark all read": a light sweeps down the unread ones and their dots pop, then they turn read.
  const readAll = async () => {
    const unread = data?.items.filter((n) => !n.read).length ?? 0
    setSweeping(true)
    await new Promise((r) => window.setTimeout(r, 600 + Math.min(unread, 10) * 55))
    await api('/api/notifications/read-all', { method: 'POST' }).catch(() => {})
    await qc.invalidateQueries({ queryKey: qk.notifications })
    setSweeping(false)
  }

  return (
    <div className="pb-10">
      <PageHeader
        title={nt.title}
        right={
          !!data?.unread && (
            <Button variant="ghost" className="min-h-9 px-3 text-base" onClick={readAll}>
              {nt.markAllRead}
            </Button>
          )
        }
      />
      <div className="mx-auto max-w-2xl p-4">
        <PushSetupCard />
        {isLoading ? (
          <SkeletonList rows={5} className="h-[5.25rem]" />
        ) : !data?.items.length ? (
          <Empty icon={<Bell className="size-14" strokeWidth={1.5} />} title={nt.emptyTitle}>
            {nt.emptyBody}
          </Empty>
        ) : (
          <ul className={`grid gap-2 ${intro}`}>
            {data.items.map((n, i) => {
              const Icon = notificationIcons[n.type]
              return (
                <li key={n.id} className={`ftg-notif-row ${gone.has(n.id) ? 'is-gone' : ''} ${fresh.has(n.id) ? 'ftg-notif-new' : ''}`}>
                  <SwipeAway onSwiped={() => remove(n)}>
                  <button
                    type="button"
                    onClick={() => open(n)}
                    onKeyDown={(e) => {
                      if (e.key === 'Delete' || e.key === 'Backspace') remove(n)
                    }}
                    style={{ ['--i' as string]: i }}
                    className={`ftg-lift ftg-notif-card flex w-full gap-3 rounded-2xl border p-3 pr-9 text-left ${n.read ? 'border-line bg-surface' : 'border-brand/40 bg-brand/5'} ${
                      sweeping && !n.read ? 'ftg-notif-sweep' : ''
                    }`}
                  >
                    <Icon className="size-7 shrink-0 text-brand" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{n.title}</span>
                      <span className="block text-sm text-ink-2">{n.body}</span>
                      <span className="mt-1 block text-xs text-ink-2">{timeAgo(n.created_at)}</span>
                    </span>
                    {!n.read && <span className="ftg-notif-dot mt-2 size-2.5 shrink-0 rounded-full bg-brand" aria-label={nt.unread} />}
                    <span
                      role="button"
                      tabIndex={-1}
                      aria-label={nt.remove}
                      title={nt.remove}
                      onClick={(e) => {
                        e.stopPropagation()
                        remove(n)
                      }}
                      className="ftg-notif-x absolute right-1.5 top-1.5 rounded-full p-1 text-ink-2 hover:bg-surface-2 hover:text-ink"
                    >
                      <X className="size-4" aria-hidden />
                    </span>
                  </button>
                  </SwipeAway>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

/** Drag sideways past a third of the width to throw the item away; otherwise it springs back. */
function SwipeAway({ onSwiped, children }: { onSwiped: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; dx: number; on: boolean; id: number } | null>(null)
  const moved = useRef(false)
  const set = (dx: number, animate: boolean) => {
    const el = ref.current
    if (!el) return
    el.style.transition = animate ? 'transform 0.3s cubic-bezier(0.2, 0.9, 0.3, 1.2), opacity 0.3s' : 'none'
    el.style.transform = dx ? `translateX(${dx}px) rotate(${dx / 60}deg)` : ''
    el.style.opacity = String(1 - Math.min(Math.abs(dx) / (el.offsetWidth || 1), 0.7))
  }
  const down = (e: ReactPointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    drag.current = { x: e.clientX, y: e.clientY, dx: 0, on: false, id: e.pointerId }
    moved.current = false
  }
  const move = (e: ReactPointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.on) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) return void (drag.current = null)
      if (Math.abs(dx) < 10) return
      d.on = true
      moved.current = true
      ref.current?.setPointerCapture(d.id)
    }
    d.dx = dx
    set(dx, false)
  }
  const up = () => {
    const d = drag.current
    drag.current = null
    if (!d?.on) return
    const w = ref.current?.offsetWidth ?? 300
    if (Math.abs(d.dx) > w / 3) {
      set(Math.sign(d.dx) * w * 1.2, true)
      onSwiped()
    } else set(0, true)
  }
  return (
    <div
      ref={ref}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onClickCapture={(e) => {
        if (moved.current) {
          e.stopPropagation()
          e.preventDefault()
          moved.current = false
        }
      }}
    >
      {children}
    </div>
  )
}
