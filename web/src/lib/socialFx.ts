import { getSession } from './api'
import { buzz, shake, sparkle } from './fx'

const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms))

/** "Signed in · @ana" and "AN" for the account that just signed in. */
export function signedInBadge(template: string): { label: string; initials: string } {
  const u = getSession()?.user
  const name = u?.username ?? ''
  const initials = ((u?.first_name?.[0] ?? '') + (u?.last_name?.[0] ?? '')).toUpperCase() || name.slice(0, 2).toUpperCase()
  return { label: name ? template.replace('{user}', name) : template.replace(' · @{user}', ''), initials }
}

/** Small squash when the button is pressed. */
export function pressSocial(btn: HTMLElement | null) {
  btn?.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(.94,.9)' }, { transform: 'scale(1.03)' }, { transform: 'none' }],
    { duration: 380, easing: 'cubic-bezier(.34,1.56,.64,1)' },
  )
  buzz(8)
}

/** Sign-in failed: the light turns red and stops, the button shakes. */
export function failSocial(btn: HTMLElement | null) {
  if (!btn) return
  buzz([20, 40, 20])
  shake(btn)
}

/**
 * Signed in. The page swaps as soon as the session lands, so this plays on a copy of the
 * button pinned where it was, over a cover: the light closes into a full ring, green fills
 * the button from the left, the label rolls to "Signed in · @user" with the player's
 * initials sliding in, then the app opens in a circle that grows from the button.
 */
export async function playSignedIn(btn: HTMLElement | null, rect: DOMRect | null, label: string, initials: string) {
  if (!btn || !rect || typeof document === 'undefined') return
  const cover = document.createElement('div')
  cover.className = 'ftg-soc-cover'
  cover.setAttribute('aria-hidden', 'true')
  const ghost = btn.cloneNode(true) as HTMLElement
  ghost.classList.remove('is-busy', 'is-bad')
  ghost.classList.add('ftg-soc-ghost', 'is-ok')
  ghost.removeAttribute('id')
  ghost.setAttribute('aria-hidden', 'true')
  Object.assign(ghost.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` })
  const fill = document.createElement('span')
  fill.className = 'ftg-soc-fill'
  ghost.prepend(fill)
  document.body.append(cover, ghost)

  const x = rect.left + rect.width / 2
  const y = rect.top + rect.height / 2
  buzz([10, 30, 14])
  fill.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 420, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' })
  const lb = ghost.querySelector<HTMLElement>('.ftg-soc-lb')
  if (lb) {
    await lb.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(-120%)', opacity: 0 }], { duration: 180, fill: 'forwards' }).finished
    lb.replaceChildren()
    lb.insertAdjacentHTML(
      'beforeend',
      '<svg class="ftg-soc-check" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    )
    const text = document.createElement('span')
    text.textContent = label
    const me = document.createElement('span')
    me.className = 'ftg-soc-me'
    me.textContent = initials
    lb.append(text, me)
    lb.animate([{ transform: 'translateY(120%)', opacity: 0 }, { transform: 'none', opacity: 1 }], {
      duration: 380,
      easing: 'cubic-bezier(.34,1.56,.64,1)',
      fill: 'forwards',
    })
    me.animate([{ transform: 'translateX(-40px) scale(.4)', opacity: 0 }, { transform: 'none', opacity: 1 }], {
      duration: 480,
      delay: 160,
      easing: 'cubic-bezier(.34,1.56,.64,1)',
      fill: 'backwards',
    })
    sparkle({ x, y }, 14)
  }
  await sleep(900)

  // The app opens in a circle from the button.
  const far = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
  ghost.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.96)' }], { duration: 200, fill: 'forwards' })
  await new Promise<void>((done) => {
    const t0 = performance.now()
    const frame = (now: number) => {
      const k = Math.min(1, (now - t0) / 560)
      const e = k * k * (3 - 2 * k)
      const r = e * far
      cover.style.maskImage = cover.style.webkitMaskImage = `radial-gradient(circle at ${x}px ${y}px, transparent ${r}px, #000 ${r + 1}px)`
      if (k < 1) requestAnimationFrame(frame)
      else done()
    }
    requestAnimationFrame(frame)
  })
  cover.remove()
  ghost.remove()
}
