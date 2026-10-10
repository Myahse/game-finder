import { createRoot, type Root } from 'react-dom/client'
import { MoveCourtHop } from '../components/MoveCourtHop'

type Spot = { name: string; latitude: number; longitude: number; wet: boolean; dry: boolean }
type HopProps = { from: Spot; to: Spot; label: string; done: string; closeLabel: string }

let current: { root: Root; host: HTMLElement; timer: number } | null = null

function dismiss() {
  const c = current
  if (!c) return
  current = null
  window.clearTimeout(c.timer)
  c.host.style.transition = 'opacity 0.2s ease-in, transform 0.2s ease-in'
  c.host.style.opacity = '0'
  c.host.style.transform = 'translateY(12px)'
  window.setTimeout(() => {
    c.root.unmount()
    c.host.remove()
  }, 220)
}

/**
 * Shows the "game moved" hop in a small floating card above the page (not modal: tap it to close,
 * it goes by itself after a few seconds). Lives outside the sheet that started it, because that
 * sheet's parent (e.g. the rain check) can unmount as soon as the game is at a dry court.
 * Returns false when it can't be shown (no DOM), so the caller can fall back to a toast.
 */
export function showMoveHop(props: HopProps): boolean {
  if (typeof document === 'undefined') return false
  try {
    if (current) {
      const c = current
      current = null
      window.clearTimeout(c.timer)
      c.root.unmount()
      c.host.remove()
    }
    const host = document.createElement('div')
    host.className =
      'pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] flex justify-center px-4 md:bottom-6'
    document.body.appendChild(host)
    const root = createRoot(host)
    root.render(
      <div
        className="ftg-sheet pointer-events-auto w-full max-w-md cursor-pointer rounded-3xl border border-line bg-surface p-2 shadow-2xl"
        onClick={dismiss}
        title={props.closeLabel}
      >
        <MoveCourtHop from={props.from} to={props.to} label={props.label} done={props.done} />
      </div>,
    )
    current = { root, host, timer: window.setTimeout(dismiss, 4600) }
    return true
  } catch {
    return false
  }
}
