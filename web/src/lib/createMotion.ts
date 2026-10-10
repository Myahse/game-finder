import { buzz, dust } from './fx'

const PIN =
  '<svg viewBox="0 0 64 70" aria-hidden="true"><path d="M32 4c-11.6 0-21 9.4-21 21 0 15.8 21 35 21 35s21-19.2 21-35c0-11.6-9.4-21-21-21z" fill="currentColor" stroke="#fff" stroke-width="3"/><circle cx="32" cy="25" r="9" fill="none" stroke="#fff" stroke-width="3.5"/></svg>'

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

function tween(ms: number, fn: (t: number) => void): Promise<void> {
  return new Promise((done) => {
    const t0 = performance.now()
    const step = (now: number) => {
      const t = clamp((now - t0) / ms, 0, 1)
      fn(t)
      if (t < 1) requestAnimationFrame(step)
      else done()
    }
    requestAnimationFrame(step)
  })
}

/**
 * The folded publish button becomes a map pin that arcs to `target` (viewport point),
 * is planted with a squash and a puff of dust, and sends out a radar wave.
 * Resolves after about 1.1 s so the success screen follows straight away; the pin and
 * waves clean themselves up.
 */
export async function plantPin(from: Element, target: { x: number; y: number }): Promise<void> {
  if (typeof document === 'undefined' || typeof requestAnimationFrame === 'undefined') return
  const started = performance.now()
  const br = from.getBoundingClientRect()
  const x0 = br.left + br.width / 2
  const y0 = br.top + br.height / 2 + 18
  const x1 = target.x
  const y1 = target.y

  const pin = document.createElement('div')
  pin.className = 'ftg-create-flypin'
  pin.style.color = 'var(--brand)'
  pin.innerHTML = PIN
  document.body.appendChild(pin)
  const put = (x: number, y: number, rot: number, sx: number, sy: number) => {
    pin.style.transform = `translate(${x - 20}px, ${y - 44}px) rotate(${rot}deg) scale(${sx}, ${sy})`
  }
  put(x0, y0, 0, 0.4, 0.4)

  // Pop out of the button, then fly a curved path to the spot.
  await tween(140, (t) => put(x0, y0 + 6 * t, 0, lerp(0.4, 1.15, t), lerp(0.4, 0.8, t)))
  const cx = (x0 + x1) / 2 + 50
  const cy = Math.min(y0, y1) - 70
  let px = x0
  await tween(600, (t0) => {
    const e = easeInOut(t0)
    const x = (1 - e) * (1 - e) * x0 + 2 * (1 - e) * e * cx + e * e * x1
    const y = (1 - e) * (1 - e) * y0 + 2 * (1 - e) * e * cy + e * e * y1
    const s = 1 + Math.sin(Math.PI * e) * 0.35
    const early = t0 < 0.15
    put(x, y, clamp((x - px) * 2.5, -30, 30), s * (early ? 0.9 : 1), s * (early ? 1.12 : 1))
    px = x
  })

  put(x1, y1, 0, 1, 1)
  pin.classList.add('ftg-create-land')
  buzz([18, 30, 10])
  dust({ x: x1, y: y1 }, 14)
  const shadow = document.createElement('span')
  shadow.className = 'ftg-create-pinsh'
  Object.assign(shadow.style, { left: `${x1}px`, top: `${y1}px` })
  const waves = document.createElement('span')
  waves.className = 'ftg-create-waves'
  waves.setAttribute('aria-hidden', 'true')
  Object.assign(waves.style, { left: `${x1}px`, top: `${y1}px` })
  waves.innerHTML = '<i></i><i></i><i></i>'
  document.body.append(shadow, waves)

  window.setTimeout(() => {
    pin.classList.add('ftg-create-out')
    shadow.style.transition = 'opacity .3s'
    shadow.style.opacity = '0'
  }, 700)
  window.setTimeout(() => { pin.remove(); shadow.remove() }, 1050)
  window.setTimeout(() => waves.remove(), 2000)

  const left = 1100 - (performance.now() - started)
  if (left > 0) await new Promise((r) => window.setTimeout(r, left))
}
