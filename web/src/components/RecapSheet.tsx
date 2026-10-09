import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, ChevronLeft, ChevronRight, Download, Share2, X } from 'lucide-react'
import { playerAvatarForUser } from '../avatar/resolve'
import { useLocale } from '../i18n/LocaleProvider'
import { api } from '../lib/api'
import { renderRecapStory, type MonthlyRecap } from '../lib/recapStory'
import type { Me } from '../lib/types'
import { Button, Spinner } from './ui'

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function shiftMonth(key: string, delta: number) {
  const [y, m] = key.split('-').map(Number)
  return monthKey(new Date(Date.UTC(y, m - 1 + delta, 1)))
}

/** "My month": a shareable story image with the player's monthly stats. */
export function RecapButton({ me }: { me: Me }) {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <CalendarDays className="size-5" aria-hidden /> {t.recap.button}
      </Button>
      {open && <RecapSheet me={me} onClose={() => setOpen(false)} />}
    </>
  )
}

function RecapSheet({ me, onClose }: { me: Me; onClose: () => void }) {
  const { t, locale } = useLocale()
  const current = monthKey(new Date())
  const [month, setMonth] = useState(current)
  const { data: recap, isError } = useQuery({ queryKey: ['recap', month], queryFn: () => api<MonthlyRecap>(`/api/me/recap?month=${month}`) })
  const [story, setStory] = useState<{ blob: Blob; src: string; month: string } | null>(null)
  const [failed, setFailed] = useState(false)

  const [y, m] = month.split('-').map(Number)
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)))

  useEffect(() => {
    if (!recap) return
    let src = ''
    let cancelled = false
    setFailed(false)
    renderRecapStory({
      recap,
      username: me.username,
      avatar: playerAvatarForUser(me),
      teammateAvatar: recap.top_teammate ? playerAvatarForUser(recap.top_teammate.user) : null,
      monthLabel,
      labels: t.recap,
    })
      .then((blob) => {
        if (cancelled) return
        src = URL.createObjectURL(blob)
        setStory({ blob, src, month: recap.month })
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
      if (src) URL.revokeObjectURL(src)
    }
  }, [recap, me, monthLabel, t.recap])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const ready = story && story.month === month ? story : null
  const fileName = `out-for-ground-${me.username}-${month}.png`

  const share = async () => {
    if (!ready) return
    const file = new File([ready.blob], fileName, { type: 'image/png' })
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: t.recap.title, text: `${t.recap.text} ${monthLabel}` })
        return
      }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return
    }
    save()
  }

  const save = () => {
    if (!ready) return
    const a = document.createElement('a')
    a.href = ready.src
    a.download = fileName
    a.click()
  }

  return (
    <div className="ftg-safe-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={t.recap.title} onClick={onClose}>
      <div className="max-h-[96dvh] w-full max-w-sm overflow-y-auto rounded-t-3xl bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="display text-2xl font-extrabold">{t.recap.title}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink" aria-label={t.common.close}>
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="mb-3 flex items-center justify-between">
          <button type="button" onClick={() => setMonth((k) => shiftMonth(k, -1))} className="rounded-full p-2 text-ink-2 hover:bg-surface-2 hover:text-ink" aria-label={t.recap.prev}>
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <span className="font-bold capitalize">{monthLabel}</span>
          <button
            type="button"
            onClick={() => setMonth((k) => shiftMonth(k, 1))}
            disabled={month >= current}
            className="rounded-full p-2 text-ink-2 hover:bg-surface-2 hover:text-ink disabled:opacity-30"
            aria-label={t.recap.next}
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </div>
        <div className="mx-auto flex aspect-[9/16] w-full max-w-[15rem] items-center justify-center overflow-hidden rounded-2xl bg-surface-2">
          {ready ? (
            <img src={ready.src} alt={t.recap.title} className="h-full w-full object-cover" />
          ) : isError || failed ? (
            <p className="p-4 text-center text-sm text-ink-2">{t.recap.failed}</p>
          ) : (
            <div className="flex flex-col items-center gap-2 p-4 text-center text-sm text-ink-2">
              <Spinner className="text-brand" />
              {t.recap.loading}
            </div>
          )}
        </div>
        {recap && recap.month === month && recap.games === 0 && <p className="mt-3 text-center text-sm text-ink-2">{t.recap.empty}</p>}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button type="button" onClick={() => void share()} disabled={!ready}>
            <Share2 className="size-5" aria-hidden /> {t.recap.share}
          </Button>
          <Button type="button" variant="secondary" className="text-base" onClick={save} disabled={!ready}>
            <Download className="size-5" aria-hidden /> {t.recap.save}
          </Button>
        </div>
      </div>
    </div>
  )
}
