import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { X } from 'lucide-react'
import { useLocale } from '../i18n/LocaleProvider'
import { useAnnouncement, useMarkAnnouncementSeen, usePendingAnnouncement } from '../lib/announcements'
import { resolveMediaUrl } from '../lib/mediaUrl'
import type { Announcement } from '../lib/types'
import { Button } from './ui'

type ModalProps = { a: Pick<Announcement, 'title' | 'body' | 'image_url' | 'link_url' | 'cta_label'>; onClose: () => void; onCta?: () => void; inline?: boolean }

/** The news pop-up: flyer, title, text and an optional button. `inline` renders it without the overlay (admin preview). */
export function AnnouncementCard({ a, onClose, onCta, inline }: ModalProps) {
  const { t } = useLocale()
  const card = (
    <div
      className={`ftg-dialog relative w-full max-w-md overflow-hidden rounded-3xl border border-line bg-surface shadow-xl ${inline ? '' : 'max-h-[min(92dvh,820px)] overflow-y-auto'}`}
      onClick={(e) => e.stopPropagation()}
    >
      <button type="button" onClick={onClose} aria-label={t.announcements.close} className="absolute right-3 top-3 z-10 rounded-full bg-black/55 p-1.5 text-white backdrop-blur hover:bg-black/70">
        <X className="size-5" aria-hidden />
      </button>
      {a.image_url && <img src={resolveMediaUrl(a.image_url)} alt="" className="block max-h-[62dvh] w-full bg-black/5 object-contain" />}
      <div className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">{t.announcements.eyebrow}</p>
        <h2 id="announcement-title" className="display mt-1 text-3xl font-extrabold leading-tight">{a.title}</h2>
        {a.body && <p className="mt-2 whitespace-pre-line text-sm text-ink-2">{a.body}</p>}
        <div className="mt-5 grid gap-2">
          {a.link_url && (
            <Button type="button" className="w-full min-h-11 text-base" onClick={onCta}>
              {a.cta_label || t.announcements.open}
            </Button>
          )}
          <Button type="button" variant={a.link_url ? 'ghost' : undefined} className="w-full min-h-11 text-base" onClick={onClose}>
            {t.announcements.close}
          </Button>
        </div>
      </div>
    </div>
  )
  if (inline) return card
  return (
    <div
      className="ftg-safe-overlay ftg-safe-overlay-b ftg-backdrop fixed inset-0 z-[65] flex items-end justify-center bg-black/55 p-4 backdrop-blur-md sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="announcement-title"
      onClick={onClose}
    >
      {card}
    </div>
  )
}

/**
 * Shows the newest unseen announcement once per user, or the one named in `?announcement=<id>`
 * (opened from a notification). Waits while another pop-up is open so they never stack.
 */
export function AnnouncementGate({ enabled }: { enabled: boolean }) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const fromLink = params.get('announcement')
  const linked = useAnnouncement(enabled && fromLink && /^[0-9a-f-]{36}$/i.test(fromLink) ? fromLink : null)
  const pending = usePendingAnnouncement(enabled && !fromLink && !pathname.startsWith('/admin'))
  const seen = useMarkAnnouncementSeen()
  const [dismissed, setDismissed] = useState<string | null>(null)
  const [free, setFree] = useState(false)

  const a = fromLink ? linked.data : pending.data
  // Wait for other pop-ups (welcome tips, intro) to close first.
  useEffect(() => {
    if (!a) return
    const check = () => setFree(!document.querySelector('[aria-modal="true"]:not([aria-labelledby="announcement-title"])'))
    check()
    const id = window.setInterval(check, 1500)
    return () => window.clearInterval(id)
  }, [a])

  if (!enabled || !a || dismissed === a.id || !free) return null

  const close = () => {
    setDismissed(a.id)
    seen.mutate(a.id)
    if (fromLink) {
      params.delete('announcement')
      setParams(params, { replace: true })
    }
  }
  const cta = () => {
    const link = a.link_url
    close()
    if (!link) return
    if (link.startsWith('https://')) window.open(link, '_blank', 'noopener,noreferrer')
    else navigate(link)
  }
  return <AnnouncementCard a={a} onClose={close} onCta={cta} />
}
