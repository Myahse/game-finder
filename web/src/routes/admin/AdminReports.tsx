import { useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorMessage } from '../../lib/api'
import { playerDisplayLabel, reportLabels, timeAgo } from '../../lib/format'
import type { PublicUser, ReportType } from '../../lib/types'
import { Button, Card, Chip } from '../../components/ui'
import { Loading } from '../CourtPage'
import { useLocale } from '../../i18n/LocaleProvider'
import { buzz, replay, sparkle } from '../../lib/fx'
import '../../styles/motion-part5.css'

type Dir = 1 | -1

/** Sends a card into a tray: it shrinks and spins toward it, then its space folds away. */
async function flyInto(row: HTMLElement, tray: HTMLElement | null, dir: Dir) {
  if (!tray) return
  const tr = tray.getBoundingClientRect()
  const rr = row.getBoundingClientRect()
  const dx = tr.left + tr.width / 2 - (rr.left + rr.width / 2)
  const dy = tr.top + tr.height / 2 - (rr.top + rr.height / 2)
  await row.animate(
    [{ transform: row.style.transform || 'none' }, { transform: `translate(${dx}px, ${dy}px) scale(.25) rotate(${dir * 12}deg)`, opacity: 0.4 }],
    { duration: 480, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' },
  ).finished.catch(() => {})
  row.style.visibility = 'hidden'
  row.animate([{ height: `${rr.height}px` }, { height: '0px', marginTop: '-12px', paddingTop: '0', paddingBottom: '0' }], { duration: 250, fill: 'forwards' })
}

/** A report card that can be dragged: far enough right resolves it, left dismisses it. */
function SwipeRow({ enabled, onSwipe, children }: { enabled: boolean; onSwipe: (dir: Dir, row: HTMLElement) => void; children: ReactNode }) {
  const row = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; id: number; on: boolean } | null>(null)
  const paint = (dx: number) => {
    const el = row.current
    if (!el) return
    el.style.transform = dx ? `translateX(${dx}px) rotate(${dx / 30}deg)` : ''
    el.classList.toggle('is-done-hint', dx > 30)
    el.classList.toggle('is-skip-hint', dx < -30)
  }
  const back = () => {
    const el = row.current
    if (!el) return
    el.classList.add('is-back')
    paint(0)
    window.setTimeout(() => el.classList.remove('is-back'), 320)
  }
  if (!enabled) return <div>{children}</div>
  return (
    <div
      ref={row}
      className="ftg-rep rounded-2xl"
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('button, a')) return
        drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, on: false }
      }}
      onPointerMove={(e) => {
        const d = drag.current
        if (!d) return
        const dx = e.clientX - d.x
        if (!d.on) {
          if (Math.abs(e.clientY - d.y) > 12) return void (drag.current = null)
          if (Math.abs(dx) < 8) return
          d.on = true
          row.current?.setPointerCapture(d.id)
        }
        paint(dx)
      }}
      onPointerUp={(e) => {
        const d = drag.current
        drag.current = null
        if (!d?.on || !row.current) return
        const dx = e.clientX - d.x
        if (Math.abs(dx) > 90) onSwipe(dx > 0 ? 1 : -1, row.current)
        else back()
      }}
      onPointerCancel={() => {
        drag.current = null
        back()
      }}
    >
      {children}
    </div>
  )
}

interface Report {
  id: string
  type: ReportType
  description: string | null
  status: 'open' | 'resolved' | 'rejected'
  admin_note: string | null
  created_at: string
  court: { id: string; name: string; status: string }
  reporter: PublicUser | null
}

export function AdminReports() {
  const { t } = useLocale()
  const a = t.admin
  const [status, setStatus] = useState<Report['status'] | null>('open')
  const qc = useQueryClient()
  const [counts, setCounts] = useState({ done: 0, skip: 0 })
  const doneTray = useRef<HTMLDivElement>(null)
  const skipTray = useRef<HTMLDivElement>(null)
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'reports', status],
    queryFn: () => api<Report[]>(`/api/admin/reports${status ? `?status=${status}` : ''}`),
  })
  const act = useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: Report['status']; note?: string }) =>
      api(`/api/admin/reports/${id}/resolve`, { method: 'POST', json: { status, note } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
    onError: (e) => alert(errorMessage(e)),
  })

  /** Resolve (→) or dismiss (←) an open report, flying its card into the matching tray. */
  const send = async (r: Report, dir: Dir, row: HTMLElement | null) => {
    const note = dir > 0 ? (prompt(a.reports.notePrompt) ?? undefined) : undefined
    const tray = dir > 0 ? doneTray.current : skipTray.current
    if (row) await flyInto(row, tray, dir)
    act.mutate(
      { id: r.id, status: dir > 0 ? 'resolved' : 'rejected', note },
      {
        onSuccess: () => {
          setCounts((c) => (dir > 0 ? { ...c, done: c.done + 1 } : { ...c, skip: c.skip + 1 }))
          replay(tray, 'is-bump')
          replay(tray?.querySelector('b'), 'is-roll')
          buzz(10)
          if (dir > 0 && tray) sparkle(tray, 10)
        },
        onError: () => {
          if (row) {
            row.getAnimations().forEach((x) => x.cancel())
            row.style.visibility = ''
            row.style.transform = ''
          }
        },
      },
    )
  }

  return (
    <div className="grid gap-3">
      <div className="flex gap-2">
        {([null, 'open', 'resolved', 'rejected'] as const).map((s) => (
          <Chip key={s ?? 'all'} active={status === s} onClick={() => setStatus(s)}>
            {s ? a.reportStatus[s] : a.all}
          </Chip>
        ))}
      </div>
      {isLoading && <Loading />}
      {status === 'open' && !!data?.length && <p className="text-center text-xs font-semibold text-ink-2">{a.reports.swipeHint}</p>}
      {data?.map((r) => (
        <SwipeRow key={r.id} enabled={r.status === 'open'} onSwipe={(dir, row) => void send(r, dir, row)}>
        <Card className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              ⚑ {reportLabels[r.type]} ·{' '}
              <Link to={`/courts/${r.court.id}`} className="text-brand">
                {r.court.name}
              </Link>
            </p>
            {r.description && <p className="mt-1 text-sm">{r.description}</p>}
            <p className="mt-1 text-xs text-ink-2">
              {r.reporter ? playerDisplayLabel(r.reporter, true) : a.deletedUser} · {timeAgo(r.created_at)} · {a.reportStatus[r.status] ?? r.status}
              {r.admin_note && ` · ${a.reports.note(r.admin_note)}`}
            </p>
          </div>
          {r.status === 'open' ? (
            <div className="flex gap-2">
              <Button
                variant="live"
                className="min-h-9 px-3 text-base"
                onClick={(e) => void send(r, 1, e.currentTarget.closest('.ftg-rep'))}
              >
                {a.reports.resolve}
              </Button>
              <Button variant="secondary" className="min-h-9 px-3 text-base" onClick={(e) => void send(r, -1, e.currentTarget.closest('.ftg-rep'))}>
                {a.reject}
              </Button>
            </div>
          ) : (
            <Button variant="ghost" className="min-h-9 px-3 text-base" onClick={() => act.mutate({ id: r.id, status: 'open' })}>
              {a.reports.reopen}
            </Button>
          )}
        </Card>
        </SwipeRow>
      ))}
      {data?.length === 0 && <p className="p-6 text-center text-ink-2">{a.reports.empty}</p>}
      {status === 'open' && (
        <div className="ftg-trays">
          <div ref={doneTray} className="ftg-tray is-done">
            {a.reports.trayDone} <b>{counts.done}</b>
          </div>
          <div ref={skipTray} className="ftg-tray is-skip">
            {a.reports.traySkip} <b>{counts.skip}</b>
          </div>
        </div>
      )}
    </div>
  )
}
