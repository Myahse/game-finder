import { useEffect, useState } from 'react'
import { Download, Sticker, X } from 'lucide-react'
import type { PlayerAvatarConfig } from '../avatar/schema'
import { useLocale } from '../i18n/LocaleProvider'
import { renderSticker, stickerSet } from '../lib/stickers'
import { Button, Spinner } from './ui'
import { useSheetExit } from '../lib/motion'

type Rendered = { id: string; caption: string; blob: Blob; src: string }

/** "My stickers": the player's avatar as WhatsApp-ready 512×512 stickers. */
export function StickerButton({ avatar }: { avatar: PlayerAvatarConfig }) {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <Sticker className="size-5" aria-hidden /> {t.stickers.button}
      </Button>
      {open && <StickerSheet avatar={avatar} onClose={() => setOpen(false)} />}
    </>
  )
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function StickerSheet({ avatar, onClose: dismiss }: { avatar: PlayerAvatarConfig; onClose: () => void }) {
  const { closing, close: onClose } = useSheetExit(dismiss)
  const { t, locale } = useLocale()
  const [items, setItems] = useState<Rendered[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const made: Rendered[] = []
    ;(async () => {
      for (const spec of stickerSet(avatar.sport, locale)) {
        const blob = await renderSticker(avatar, spec)
        if (cancelled) return
        made.push({ id: spec.id, caption: spec.caption, blob, src: URL.createObjectURL(blob) })
        setItems([...made])
      }
    })().catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
      made.forEach((m) => URL.revokeObjectURL(m.src))
    }
  }, [avatar, locale])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const send = async (s: Rendered) => {
    const file = new File([s.blob], `sticker-${s.id}.png`, { type: 'image/png' })
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] })
        return
      }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return
    }
    download(s.blob, file.name)
  }

  return (
    <div className="ftg-safe-overlay ftg-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" data-closing={closing || undefined} role="dialog" aria-modal="true" aria-label={t.stickers.title} onClick={onClose}>
      <div className="ftg-sheet max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="display text-2xl font-extrabold">{t.stickers.title}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink" aria-label={t.common.close}>
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <p className="mb-3 text-sm text-ink-2">{t.stickers.hint}</p>
        {failed ? (
          <p className="p-6 text-center text-sm text-ink-2">{t.stickers.failed}</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {stickerSet(avatar.sport, locale).map((spec) => {
              const s = items?.find((i) => i.id === spec.id)
              return (
                <button
                  key={spec.id}
                  type="button"
                  disabled={!s}
                  onClick={() => s && void send(s)}
                  className="flex aspect-square items-center justify-center rounded-2xl bg-[repeating-conic-gradient(var(--surface-2)_0_25%,transparent_0_50%)] bg-[length:16px_16px] transition active:scale-95 hover:ring-2 hover:ring-brand"
                  aria-label={spec.caption}
                >
                  {s ? <img src={s.src} alt="" className="ftg-av-pop size-full object-contain" /> : <Spinner className="text-brand" />}
                </button>
              )
            })}
          </div>
        )}
        <Button type="button" variant="secondary" className="mt-4 w-full" disabled={!items || items.length === 0} onClick={() => items?.forEach((s, i) => setTimeout(() => download(s.blob, `sticker-${s.id}.png`), i * 250))}>
          <Download className="size-5" aria-hidden /> {t.stickers.save}
        </Button>
      </div>
    </div>
  )
}
