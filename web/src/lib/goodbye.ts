import { buzz } from './fx'
import '../styles/motion-part5.css'

const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms))

/**
 * Log out with a goodbye: the player's avatar waves with an "See you soon!" bubble, then two
 * doors slide shut over the screen. `leave` (the real log out) runs behind the closed doors,
 * which open again on the welcome page.
 */
export async function playGoodbye(leave: () => Promise<unknown>, { bubble, avatar }: { bubble: string; avatar?: Element | null }) {
  if (typeof document === 'undefined') return void (await leave())
  const root = document.createElement('div')
  root.className = 'ftg-bye'
  root.setAttribute('aria-hidden', 'true')
  root.innerHTML = '<div class="ftg-bye-dim"></div><div class="ftg-bye-doors"><i></i><i></i></div><div class="ftg-bye-text"></div>'
  const text = root.querySelector<HTMLElement>('.ftg-bye-text')!
  text.textContent = bubble

  const who = document.createElement('div')
  who.className = 'ftg-bye-who'
  const box = avatar?.getBoundingClientRect()
  const size = 96
  let face: HTMLElement
  if (avatar && box && box.width > 0) {
    face = avatar.cloneNode(true) as HTMLElement
    face.removeAttribute('data-profile-avatar')
    Object.assign(face.style, { width: `${size}px`, height: `${size}px`, margin: '0', position: 'relative' })
  } else {
    face = document.createElement('div')
    Object.assign(face.style, { width: `${size}px`, height: `${size}px`, borderRadius: '50%', background: 'var(--brand)' })
  }
  who.appendChild(face)
  const bub = document.createElement('span')
  bub.className = 'ftg-bye-bubble'
  bub.textContent = bubble
  const hand = document.createElement('span')
  hand.className = 'ftg-bye-hand'
  hand.textContent = '👋'
  who.append(bub, hand)
  Object.assign(who.style, { left: '50%', top: '45%', transform: 'translate(-50%, -50%)' })
  root.appendChild(who)
  document.body.appendChild(root)

  const dim = root.querySelector<HTMLElement>('.ftg-bye-dim')!
  dim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, fill: 'forwards' })
  buzz(8)
  face.animate(
    [{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1.08)', opacity: 1, offset: 0.6 }, { transform: 'none', opacity: 1 }],
    { duration: 380, easing: 'cubic-bezier(.34,1.56,.64,1)' },
  )
  hand.animate(
    [{ transform: 'rotate(0)' }, { transform: 'rotate(22deg)' }, { transform: 'rotate(-12deg)' }, { transform: 'rotate(22deg)' }, { transform: 'rotate(-12deg)' }, { transform: 'rotate(0)' }],
    { duration: 1100, easing: 'ease-in-out', delay: 200 },
  )
  face.animate([{ rotate: '0deg' }, { rotate: '-6deg' }, { rotate: '5deg' }, { rotate: '-3deg' }, { rotate: '0deg' }], { duration: 1100, delay: 200 })
  bub.animate(
    [{ transform: 'translateX(-50%) scale(0)' }, { transform: 'translateX(-50%) scale(1.1)', offset: 0.6 }, { transform: 'translateX(-50%) scale(1)' }],
    { duration: 400, delay: 250, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'forwards' },
  )
  await sleep(1400)

  const [l, r] = root.querySelectorAll<HTMLElement>('.ftg-bye-doors i')
  const shut = { duration: 420, easing: 'cubic-bezier(.5,0,.2,1)', fill: 'forwards' as const }
  l.animate([{ transform: 'translateX(-101%)' }, { transform: 'translateX(0)' }], shut)
  r.animate([{ transform: 'translateX(101%)' }, { transform: 'translateX(0)' }], shut)
  await sleep(420)
  buzz(14)
  who.remove()
  root.animate([{ transform: 'none' }, { transform: 'translateX(-2px)' }, { transform: 'translateX(2px)' }, { transform: 'none' }], { duration: 200 })
  text.animate([{ opacity: 0, transform: 'scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: 400, delay: 100, fill: 'forwards' })

  try {
    await Promise.all([leave(), sleep(900)])
  } finally {
    text.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' })
    dim.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' })
    const open = { duration: 480, easing: 'cubic-bezier(.5,0,.2,1)', fill: 'forwards' as const, delay: 150 }
    l.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-101%)' }], open)
    await r.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(101%)' }], open).finished.catch(() => {})
    root.remove()
  }
}
