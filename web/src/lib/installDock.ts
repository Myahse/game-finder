import { buzz, dust, sparkle } from './fx'
import '../styles/motion-part4.css'

/**
 * Plays once the app is installed: the app icon jumps out from where the install prompt was,
 * arcs down with gravity into a phone-style dock at the bottom of the screen, the other icons
 * slide apart to make room, it lands with a squash and its badge pops. Then the dock fades.
 */
export function playInstallDock(from?: { x: number; y: number }) {
  if (typeof document === 'undefined') return
  const W = window.innerWidth
  const start = from ?? { x: W / 2, y: 70 }

  const layer = document.createElement('div')
  layer.className = 'ftg-dockfx'
  layer.setAttribute('aria-hidden', 'true')
  layer.innerHTML = `
    <div class="ftg-dockfx-dock">
      <span class="ftg-dockfx-ap" style="background:#34c759"></span>
      <span class="ftg-dockfx-ap" style="background:#0a84ff"></span>
      <span class="ftg-dockfx-slot"></span>
      <span class="ftg-dockfx-ap" style="background:#ff9f0a"></span>
    </div>
    <span class="ftg-dockfx-icon"><img src="/favicon.svg" alt="" /><b class="ftg-dockfx-badge">1</b></span>`
  document.body.appendChild(layer)
  const dock = layer.querySelector<HTMLElement>('.ftg-dockfx-dock')!
  const slot = layer.querySelector<HTMLElement>('.ftg-dockfx-slot')!
  const icon = layer.querySelector<HTMLElement>('.ftg-dockfx-icon')!
  const badge = layer.querySelector<HTMLElement>('.ftg-dockfx-badge')!

  dock.animate([{ transform: 'translateY(120%)' }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'both' })
  // The dock makes room for the new icon.
  window.setTimeout(() => slot.classList.add('is-open'), 200)

  window.setTimeout(() => {
    const target = slot.getBoundingClientRect()
    const tx = target.left + target.width / 2 - 26
    const ty = target.top
    let x = start.x - 26
    let y = start.y - 26
    const frames = 40
    let vx = (tx - x) / frames
    let vy = -9
    const g = (2 * (ty - y - vy * frames)) / (frames * frames)
    let s = 0.4
    icon.style.opacity = '1'
    const fly = () => {
      x += vx
      vy += g
      y += vy
      s += (1.12 - s) * 0.12
      icon.style.transform = `translate(${x}px, ${y}px) scale(${s}) rotate(${vx * 3}deg)`
      if (vy > 0 && y >= ty) {
        x = tx
        y = ty
        icon.animate(
          [
            { transform: `translate(${x}px, ${y}px) scale(1.25, .75)` },
            { transform: `translate(${x}px, ${y - 10}px) scale(.92, 1.1)` },
            { transform: `translate(${x}px, ${y}px) scale(1)` },
          ],
          { duration: 420, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'forwards' },
        )
        icon.style.transform = `translate(${x}px, ${y}px)`
        dock.querySelectorAll('.ftg-dockfx-ap').forEach((a) => a.animate([{ transform: 'none' }, { transform: 'translateY(-6px)' }, { transform: 'none' }], { duration: 300, delay: 60 }))
        buzz(14)
        dust({ x: x + 26, y: y + 52 }, 8)
        window.setTimeout(() => {
          badge.animate([{ transform: 'scale(0)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 380, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'forwards' })
          sparkle({ x: x + 50, y }, 12)
        }, 380)
        window.setTimeout(() => {
          layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' }).onfinish = () => layer.remove()
        }, 2200)
        return
      }
      requestAnimationFrame(fly)
    }
    requestAnimationFrame(fly)
  }, 420)

  // Safety: never leave the layer behind.
  window.setTimeout(() => layer.remove(), 5000)
}
