import { useEffect, useRef, useState } from 'react'
import { Download, IdCard, Share2, X } from 'lucide-react'
import { playerAvatarForUser } from '../avatar/resolve'
import { useLocale } from '../i18n/LocaleProvider'
import { isUploadedAvatar } from '../lib/avatarPresets'
import { resolveMediaUrl } from '../lib/mediaUrl'
import { CARD_STYLES, cardNameLines, usePlayerCard, type CardStyle } from '../lib/playerCard'
import { renderPlayerCard } from '../lib/playerCardImage'
import { profileShareUrl } from '../lib/profileShare'
import { SportIcon } from './icons'
import { Button, Chip, Spinner } from './ui'
import { useSheetExit } from '../lib/motion'
import { celebrate } from '../lib/celebrate'

/** "My card" (own profile) / "View card" (another player's): opens the player card sheet. */
export function PlayerCardButton({
  userId,
  mine = false,
  legalName = false,
  initialOpen = false,
  initialSport = null,
}: {
  userId: string
  mine?: boolean
  /** Print the first/last name (own card, admins) instead of the username. */
  legalName?: boolean
  initialOpen?: boolean
  initialSport?: string | null
}) {
  const { t } = useLocale()
  const [open, setOpen] = useState(initialOpen)
  // Opened from a tier-up notification (/profile?card=…): celebrate once the sheet is up.
  const celebrated = useRef(false)
  useEffect(() => {
    if (!initialOpen || celebrated.current) return
    celebrated.current = true
    const id = window.setTimeout(() => celebrate(), 320)
    return () => window.clearTimeout(id)
  }, [initialOpen])
  return (
    <>
      <Button type="button" variant={mine ? 'primary' : 'secondary'} onClick={() => setOpen(true)}>
        <IdCard className="size-5" aria-hidden /> {mine ? t.card.mine : t.card.view}
      </Button>
      {open && <PlayerCardSheet userId={userId} legalName={mine || legalName} initialSport={initialSport} onClose={() => setOpen(false)} />}
    </>
  )
}

type Rendered = { key: string; blob: Blob; src: string }

function PlayerCardSheet({ userId, legalName, initialSport, onClose: dismiss }: { userId: string; legalName: boolean; initialSport: string | null; onClose: () => void }) {
  const { closing, close: onClose } = useSheetExit(dismiss)
  const { t } = useLocale()
  const [style, setStyle] = useState<CardStyle>('card')
  const [sport, setSport] = useState<string | null>(initialSport)
  const { data: card, isError } = usePlayerCard(userId, sport)
  const [image, setImage] = useState<Rendered | null>(null)
  const [failedKey, setFailedKey] = useState('')
  const [note, setNote] = useState('')
  const iconRef = useRef<HTMLSpanElement>(null)
  const slug = card?.sport?.slug ?? null
  const key = card ? `${card.user.id}:${slug}:${style}:${card.rating}:${card.elo}` : ''

  useEffect(() => {
    if (!card) return
    let src = ''
    let cancelled = false
    const avatar = playerAvatarForUser(card.user)
    const photo = !avatar && isUploadedAvatar(card.user.avatar_url) ? resolveMediaUrl(card.user.avatar_url!) : null
    renderPlayerCard({
      card,
      style,
      names: cardNameLines(card.user, legalName),
      avatar,
      photoUrl: photo,
      sportIconSvg: iconRef.current?.innerHTML || null,
      profileUrl: profileShareUrl(card.user.username),
      labels: t.card,
    })
      .then((blob) => {
        if (cancelled) return
        src = URL.createObjectURL(blob)
        setImage({ key, blob, src })
      })
      .catch(() => !cancelled && setFailedKey(key))
    return () => {
      cancelled = true
      if (src) URL.revokeObjectURL(src)
    }
  }, [card, style, key, legalName, t.card])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const ready = image && image.key === key ? image : null
  const failed = !!key && failedKey === key
  const fileName = card ? `out-for-ground-card-${card.user.username}-${style}.png` : 'out-for-ground-card.png'
  const url = card ? profileShareUrl(card.user.username) : ''

  const download = () => {
    if (!ready) return
    const a = document.createElement('a')
    a.href = ready.src
    a.download = fileName
    a.click()
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setNote(t.card.copied)
    } catch {
      setNote(url)
    }
  }

  const share = async () => {
    if (!ready) return
    const file = new File([ready.blob], fileName, { type: 'image/png' })
    const text = `${t.card.shareText} ${url}`
    try {
      if (navigator.canShare?.({ files: [file] })) {
        // Many apps drop `url` when files are attached, so the link also rides in the text.
        await navigator.share({ files: [file], title: t.card.title, text })
        return
      }
      if (navigator.share) {
        await navigator.share({ title: t.card.title, text: t.card.shareText, url })
        return
      }
      await copy()
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') await copy()
    }
  }

  return (
    <div className="ftg-safe-overlay ftg-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" data-closing={closing || undefined} role="dialog" aria-modal="true" aria-label={t.card.title} onClick={onClose}>
      <div className="ftg-sheet max-h-full w-full max-w-sm overflow-y-auto rounded-t-3xl bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="display text-2xl font-extrabold">{t.card.title}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink" aria-label={t.common.close}>
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <span ref={iconRef} className="hidden" aria-hidden>
          {slug && <SportIcon slug={slug} />}
        </span>
        <div className="mx-auto flex aspect-[9/16] w-full max-w-[15rem] items-center justify-center overflow-hidden rounded-2xl bg-[#0b0d10]">
          {ready ? (
            <img src={ready.src} alt={t.card.preview} className="h-full w-full object-cover" />
          ) : failed || isError ? (
            <p className="p-4 text-center text-sm text-white/80">{t.card.failed}</p>
          ) : (
            <Spinner className="text-brand" />
          )}
        </div>
        <div role="group" aria-label={t.card.styleLabel} className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
          {CARD_STYLES.map((s) => (
            <Chip key={s} active={style === s} onClick={() => setStyle(s)}>
              {t.card.styles[s]}
            </Chip>
          ))}
        </div>
        {card && card.sports.length > 1 && (
          <div role="group" aria-label={t.card.sportLabel} className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
            {card.sports.map((s) => (
              <Chip key={s.id} active={slug === s.slug} onClick={() => setSport(s.slug)}>
                <SportIcon slug={s.slug} className="size-4" />
                {s.name}
              </Chip>
            ))}
          </div>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button type="button" variant="secondary" className="text-base" onClick={download} disabled={!ready}>
            <Download className="size-5" aria-hidden /> {t.card.download}
          </Button>
          <Button type="button" className="text-base" onClick={() => void share()} disabled={!ready}>
            <Share2 className="size-5" aria-hidden /> {t.card.share}
          </Button>
        </div>
        <p aria-live="polite" className="mt-2 min-h-5 break-all text-center text-sm font-semibold text-ink-2">
          {note}
        </p>
      </div>
    </div>
  )
}
