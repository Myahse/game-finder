import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { resolveMediaUrl } from '../lib/mediaUrl'
import { useLocale } from '../i18n/LocaleProvider'
import '../styles/motion-court.css'

type Props = {
  photos: string[]
  /** Shorter strip for map sheet */
  compact?: boolean
}

/** Horizontal court photos; tap to open fullscreen viewer. */
export function CourtPhotoStrip({ photos, compact }: Props) {
  const { t } = useLocale()
  const [open, setOpen] = useState<number | null>(null)
  const urls = photos.map(resolveMediaUrl).filter(Boolean)

  const close = useCallback(() => setOpen(null), [])
  const strip = useRef<HTMLDivElement>(null)

  // Parallax: each picture drifts a little against the scroll, like looking through a window.
  useEffect(() => {
    const el = strip.current
    if (!el) return
    let raf = 0
    const draw = () => {
      raf = 0
      const c = el.scrollLeft + el.clientWidth / 2
      el.querySelectorAll<HTMLElement>('[data-ph]').forEach((ph) => {
        const d = ph.offsetLeft + ph.offsetWidth / 2 - c
        const img = ph.firstElementChild as HTMLElement | null
        if (img) img.style.transform = `translateX(${Math.max(-24, Math.min(24, -d * 0.16))}px)`
      })
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(draw)
    }
    draw()
    el.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [urls.length])

  useEffect(() => {
    if (open == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  if (urls.length === 0) return null

  const h = compact ? 'h-32' : 'h-48'
  const w = compact ? 'w-44' : 'w-72'

  return (
    <>
      <div ref={strip} className="relative flex snap-x gap-2 overflow-x-auto px-4 pt-2 [scrollbar-width:thin]">
        {urls.map((src, i) => (
          <button
            key={photos[i]}
            type="button"
            onClick={() => setOpen(i)}
            data-ph
            className={`ftg-court-x-ph ${h} ${w} shrink-0 snap-start overflow-hidden rounded-2xl ring-offset-2 transition hover:ring-2 hover:ring-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand`}
          >
            <img src={src} alt="" className="object-cover" loading="lazy" />
          </button>
        ))}
      </div>

      {open != null && (
        <div
          className="ftg-safe-overlay ftg-safe-overlay-b fixed inset-0 z-50 flex flex-col bg-black/95"
          role="dialog"
          aria-modal="true"
          aria-label={t.courts.photos.viewer}
          onClick={close}
        >
          <button
            type="button"
            onClick={close}
            className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-10 rounded-full bg-white/10 p-2 text-white"
            aria-label={t.courts.photos.close}
          >
            <X className="size-6" />
          </button>
          <div className="flex flex-1 items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
            <img src={urls[open]} alt="" className="max-h-full max-w-full object-contain" />
          </div>
          {urls.length > 1 && (
            <div className="flex justify-center gap-2 pb-8">
              {urls.map((src, i) => (
                <button
                  key={photos[i]}
                  type="button"
                  onClick={() => setOpen(i)}
                  className={`size-14 overflow-hidden rounded-lg border-2 ${i === open ? 'border-brand' : 'border-transparent opacity-70'}`}
                >
                  <img src={src} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
