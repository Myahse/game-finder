import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { flushSync } from 'react-dom'
import { Download, Sticker, X } from 'lucide-react'
import type { PlayerAvatarConfig } from '../avatar/schema'
import { useLocale } from '../i18n/LocaleProvider'
import { renderSticker, stickerSet } from '../lib/stickers'
import { Button, Spinner } from './ui'
import { useSheetExit } from '../lib/motion'
import { buzz, replay, sparkle, Spring } from '../lib/fx'
import { corners, easeInOut, lerp, paperFold, tween, type Pt } from '../lib/socialMotion'
import '../styles/motion-social.css'

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

  // Stickers that came off fly into this tray, like messages landing in a chat.
  const [sent, setSent] = useState<{ key: number; src: string; hidden: boolean; read: boolean }[]>([])
  const tray = useRef<HTMLDivElement>(null)
  const nextKey = useRef(0)
  const flyToTray = useCallback((from: DOMRect, src: string) => {
    const key = ++nextKey.current
    flushSync(() => setSent((l) => [...l.slice(-7), { key, src, hidden: true, read: false }]))
    const target = tray.current?.querySelector<HTMLElement>(`[data-key="${key}"]`)
    const show = () => setSent((l) => l.map((m) => (m.key === key ? { ...m, hidden: false } : m)))
    if (!target) return show()
    const to = target.getBoundingClientRect()
    const f = document.createElement('div')
    f.className = 'ftg-social-fly'
    f.setAttribute('aria-hidden', 'true')
    Object.assign(f.style, { width: `${from.width}px`, height: `${from.height}px` })
    const img = document.createElement('img')
    img.src = src
    img.alt = ''
    f.appendChild(img)
    document.body.appendChild(f)
    const x0 = from.left
    const y0 = from.top
    const x1 = to.left - (from.width - to.width) / 2
    const y1 = to.top - (from.height - to.height) / 2
    const cx = (x0 + x1) / 2 + 40
    const cy = Math.min(y0, y1) - 70
    const sEnd = to.width / from.width
    tween(
      700,
      (t) => {
        const e = easeInOut(t)
        const x = (1 - e) * (1 - e) * x0 + 2 * (1 - e) * e * cx + e * e * x1
        const y = (1 - e) * (1 - e) * y0 + 2 * (1 - e) * e * cy + e * e * y1
        f.style.transform = `translate(${x}px, ${y}px) rotate(${Math.sin(Math.PI * e) * -18}deg) scale(${lerp(1, sEnd, e) + Math.sin(Math.PI * e) * 0.18})`
      },
      () => {
        f.remove()
        show()
        if (!target.isConnected) return
        replay(target, 'ftg-social-boing')
        buzz(8)
        sparkle(target, 10)
        window.setTimeout(() => setSent((l) => l.map((m) => (m.key === key ? { ...m, read: true } : m))), 800)
      },
    )
  }, [])

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
          <>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {stickerSet(avatar.sport, locale).map((spec) => (
                <PeelSticker key={spec.id} caption={spec.caption} item={items?.find((i) => i.id === spec.id)} onSend={(s) => void send(s)} onPeeled={flyToTray} />
              ))}
            </div>
            <div ref={tray} className="ftg-social-tray mt-3">
              {sent.length === 0 && <span className="mr-auto text-xs font-semibold text-ink-2">{t.stickers.tray}</span>}
              {sent.map((m) => (
                <span key={m.key} data-key={m.key} className="ftg-social-msg" data-hidden={m.hidden || undefined} aria-hidden>
                  <img src={m.src} alt="" />
                  <svg viewBox="0 0 16 10" className="ftg-social-ticks" data-read={m.read || undefined}>
                    <path d="M1 5.5l3 3L10.5 1.5M6.5 8.5L14.5 1.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              ))}
            </div>
          </>
        )}
        <Button type="button" variant="secondary" className="mt-4 w-full" disabled={!items || items.length === 0} onClick={() => items?.forEach((s, i) => setTimeout(() => download(s.blob, `sticker-${s.id}.png`), i * 250))}>
          <Download className="size-5" aria-hidden /> {t.stickers.save}
        </Button>
      </div>
    </div>
  )
}

const PEEL_OFF = 0.62

/**
 * A sticker you can peel off by a corner: the paper really folds (front clipped along the fold
 * line, die-cut back mirrored over it). Past the threshold it comes off, flies into the tray and
 * is sent. A plain tap (or Enter) sends it straight away, with a quick peel for show.
 */
function PeelSticker({ caption, item, onSend, onPeeled }: { caption: string; item?: Rendered; onSend: (s: Rendered) => void; onPeeled: (from: DOMRect, src: string) => void }) {
  const btn = useRef<HTMLButtonElement>(null)
  const front = useRef<HTMLDivElement>(null)
  const back = useRef<HTMLDivElement>(null)
  const st = useRef({ C: [0, 0] as Pt, rest: [0, 0] as Pt, dir: [0, 0] as Pt, P: [0, 0] as Pt, from: null as Pt | null, down: null as { x: number; y: number; moved: boolean } | null, gone: false, auto: false, pendingSend: false, skipClick: false })
  const spring = useRef<Spring | null>(null)
  const timers = useRef<number[]>([])
  const cancelTween = useRef<(() => void) | null>(null)

  useEffect(
    () => () => {
      timers.current.forEach((id) => window.clearTimeout(id))
      cancelTween.current?.()
      spring.current?.stop()
    },
    [],
  )

  const size = () => [btn.current?.offsetWidth ?? 0, btn.current?.offsetHeight ?? 0] as const
  const fold = (P: Pt) => {
    const b = btn.current
    if (!b || !front.current || !back.current) return 0
    const [W, H] = size()
    const f = paperFold(front.current, back.current, W, H, st.current.C, P)
    b.toggleAttribute('data-peel', f > 0)
    return f
  }
  const setCorner = (ci: number) => {
    const [W, H] = size()
    const [cx, cy, ix, iy] = corners(W, H)[ci]
    st.current.C = [cx, cy]
    st.current.rest = [cx + ix * 4, cy + iy * 4]
    st.current.dir = [ix, iy]
  }

  const detach = () => {
    const s = st.current
    const b = btn.current
    if (s.gone || !b || !item) return
    s.gone = true
    buzz([10, 30, 15])
    onPeeled(b.getBoundingClientRect(), item.src)
    b.setAttribute('data-gone', '')
    // A fresh copy of the sticker slides back onto the sheet.
    timers.current.push(
      window.setTimeout(() => {
        s.gone = false
        s.P = s.C
        fold(s.C)
        b.removeAttribute('data-gone')
        b.setAttribute('data-back', '')
        timers.current.push(window.setTimeout(() => b.removeAttribute('data-back'), 500))
      }, 1000),
    )
  }

  const autoPeel = () => {
    const s = st.current
    if (s.gone || s.auto) return
    s.auto = true
    setCorner(2)
    const [W] = size()
    const from = s.rest
    const to: Pt = [s.C[0] + s.dir[0] * W * 1.25, s.C[1] + s.dir[1] * W * 0.95]
    cancelTween.current = tween(
      420,
      (t) => {
        const e = easeInOut(t)
        s.P = [lerp(from[0], to[0], e), lerp(from[1], to[1], e)]
        fold(s.P)
      },
      () => {
        s.auto = false
        detach()
      },
    )
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const s = st.current
    if (!item || s.gone || s.auto || (e.pointerType === 'mouse' && e.button !== 0)) return
    const r = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    const [W, H] = size()
    let bi = 0
    let bd = Infinity
    corners(W, H).forEach(([cx, cy], i) => {
      const d = Math.hypot(cx - x, cy - y)
      if (d < bd) {
        bd = d
        bi = i
      }
    })
    setCorner(bi)
    spring.current?.set(0)
    s.down = { x, y, moved: false }
    s.skipClick = false
    s.pendingSend = false
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const s = st.current
    if (!s.down || s.gone) return
    const r = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    if (!s.down.moved && Math.hypot(x - s.down.x, y - s.down.y) > 4) {
      s.down.moved = true
      buzz(4)
    }
    if (!s.down.moved) return
    s.P = [s.rest[0] + x - s.down.x, s.rest[1] + y - s.down.y]
    if (fold(s.P) > PEEL_OFF) {
      s.down = null
      s.pendingSend = true
      s.skipClick = true
      detach()
    }
  }
  const onPointerEnd = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const s = st.current
    // Send on release: that is the gesture browsers accept for opening the share sheet.
    if (s.pendingSend) {
      s.pendingSend = false
      if (item) onSend(item)
      return
    }
    if (!s.down || s.gone) return
    const moved = s.down.moved
    s.down = null
    if (!moved) {
      if (e.type === 'pointercancel') fold(s.C)
      return
    }
    // Let go too early: the corner springs back flat.
    s.skipClick = true
    s.from = s.P
    if (!spring.current) {
      spring.current = new Spring(0, (k) => {
        const from = st.current.from
        if (!from || st.current.gone) return
        st.current.P = [lerp(st.current.C[0], from[0], k), lerp(st.current.C[1], from[1], k)]
        fold(st.current.P)
      }, { k: 320, c: 22, precision: 0.002 })
    }
    spring.current.set(1)
    spring.current.to(0)
  }
  const onClick = () => {
    const s = st.current
    if (s.skipClick) {
      s.skipClick = false
      return
    }
    if (!item) return
    onSend(item)
    autoPeel()
  }

  return (
    <button
      ref={btn}
      type="button"
      disabled={!item}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onContextMenu={(e) => e.preventDefault()}
      className="ftg-social-stk group flex aspect-square items-center justify-center"
      aria-label={caption}
    >
      {/* The sheet backing; the button itself stays square so a corner can be grabbed. */}
      <span className="absolute inset-0 rounded-2xl bg-[repeating-conic-gradient(var(--surface-2)_0_25%,transparent_0_50%)] bg-[length:16px_16px] group-hover:ring-2 group-hover:ring-brand" aria-hidden />
      {item ? (
        <>
          <div ref={front} className="ftg-social-sf ftg-av-pop">
            <img src={item.src} alt="" draggable={false} />
          </div>
          <div className="ftg-social-sbw" aria-hidden>
            <div ref={back} className="ftg-social-sb" style={{ maskImage: `url(${item.src})`, WebkitMaskImage: `url(${item.src})` }} />
          </div>
        </>
      ) : (
        <Spinner className="text-brand" />
      )}
    </button>
  )
}
