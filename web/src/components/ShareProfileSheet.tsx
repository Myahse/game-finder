import { useEffect, useState } from 'react'
import { Download, Link2, Share2, X } from 'lucide-react'
import { playerAvatarForUser } from '../avatar/resolve'
import { useLocale } from '../i18n/LocaleProvider'
import { renderProfileCard } from '../lib/profileCard'
import { profileShareUrl } from '../lib/profileShare'
import { useMySport } from '../lib/mySport'
import type { Me } from '../lib/types'
import { Button, Spinner } from './ui'
import { useSheetExit } from '../lib/motion'

/** "Share my profile": an image card with avatar + QR code, shared together with the link. */
export function ShareProfileButton({ me }: { me: Me }) {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <Share2 className="size-5" aria-hidden /> {t.share.button}
      </Button>
      {open && <ShareProfileSheet me={me} onClose={() => setOpen(false)} />}
    </>
  )
}

function ShareProfileSheet({ me, onClose: dismiss }: { me: Me; onClose: () => void }) {
  const { closing, close: onClose } = useSheetExit(dismiss)
  const { t } = useLocale()
  const sport = useMySport()
  const url = profileShareUrl(me.username)
  const [card, setCard] = useState<{ blob: Blob; src: string } | null>(null)
  const [failed, setFailed] = useState(false)
  const [note, setNote] = useState('')
  const subtitle = [sport?.name, me.skill_level && me.skill_level !== 'all_levels' ? t.skill[me.skill_level] : null].filter(Boolean).join(' · ')

  useEffect(() => {
    let src = ''
    let cancelled = false
    renderProfileCard({ username: me.username, url, avatar: playerAvatarForUser(me), subtitle, cta: t.share.cta })
      .then((blob) => {
        if (cancelled) return
        src = URL.createObjectURL(blob)
        setCard({ blob, src })
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
      if (src) URL.revokeObjectURL(src)
    }
  }, [me, url, subtitle, t.share.cta])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const fileName = `out-for-ground-${me.username}.png`
  const text = `${t.share.text} ${url}`

  const share = async () => {
    const file = card ? new File([card.blob], fileName, { type: 'image/png' }) : null
    try {
      if (file && navigator.canShare?.({ files: [file] })) {
        // Many apps drop `url` when files are attached, so the link also rides in the text.
        await navigator.share({ files: [file], title: t.share.title, text })
        return
      }
      if (navigator.share) {
        await navigator.share({ title: t.share.title, text: t.share.text, url })
        return
      }
      await copy()
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') await copy()
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setNote(t.share.copied)
    } catch {
      setNote(url)
    }
  }

  const download = () => {
    if (!card) return
    const a = document.createElement('a')
    a.href = card.src
    a.download = fileName
    a.click()
  }

  return (
    <div className="ftg-safe-overlay ftg-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" data-closing={closing || undefined} role="dialog" aria-modal="true" aria-label={t.share.title} onClick={onClose}>
      <div className="ftg-sheet w-full max-w-sm rounded-t-3xl bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="display text-2xl font-extrabold">{t.share.title}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink" aria-label={t.common.close}>
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="mx-auto flex aspect-[4/5] w-full max-w-[17rem] items-center justify-center overflow-hidden rounded-2xl bg-surface-2">
          {card ? <img src={card.src} alt={t.share.preview} className="h-full w-full object-cover" /> : failed ? <p className="p-4 text-center text-sm text-ink-2">{t.share.failed}</p> : <Spinner className="text-brand" />}
        </div>
        <div className="mt-4 grid gap-2">
          <Button type="button" onClick={() => void share()} disabled={!card && !failed}>
            <Share2 className="size-5" aria-hidden /> {t.share.share}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="secondary" className="text-base" onClick={download} disabled={!card}>
              <Download className="size-5" aria-hidden /> {t.share.save}
            </Button>
            <Button type="button" variant="secondary" className="text-base" onClick={() => void copy()}>
              <Link2 className="size-5" aria-hidden /> {t.share.copy}
            </Button>
          </div>
          <p aria-live="polite" className="min-h-5 break-all text-center text-sm font-semibold text-ink-2">
            {note}
          </p>
        </div>
      </div>
    </div>
  )
}
