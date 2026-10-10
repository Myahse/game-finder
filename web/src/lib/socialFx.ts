import { buzz, sparkle } from './fx'

/** Small squash when the button is pressed. */
export function pressSocial(btn: HTMLElement | null) {
  btn?.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(.95)' }, { transform: 'scale(1.02)' }, { transform: 'none' }],
    { duration: 380, easing: 'cubic-bezier(.34,1.56,.64,1)' },
  )
  buzz(8)
}

/**
 * The page swaps as soon as the session lands, so the "Signed in" roll plays on a copy of
 * the button pinned where it was: the label rolls up, a check draws itself, then it fades.
 */
export function playSignedIn(btn: HTMLElement | null, rect: DOMRect | null, label: string) {
  if (!btn || !rect || typeof document === 'undefined') return
  const ghost = btn.cloneNode(true) as HTMLElement
  ghost.classList.remove('is-busy')
  ghost.classList.add('ftg-soc-ghost', 'is-ok')
  ghost.removeAttribute('id')
  ghost.setAttribute('aria-hidden', 'true')
  Object.assign(ghost.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` })
  document.body.appendChild(ghost)
  const lb = ghost.querySelector<HTMLElement>('.ftg-soc-lb')
  const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  buzz([10, 30, 14])
  if (lb) {
    lb.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(-120%)', opacity: 0 }], { duration: 180, fill: 'forwards' }).onfinish =
      () => {
        lb.replaceChildren()
        lb.insertAdjacentHTML(
          'beforeend',
          '<svg class="ftg-soc-check" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
        )
        lb.append(label)
        lb.animate([{ transform: 'translateY(120%)', opacity: 0 }, { transform: 'none', opacity: 1 }], {
          duration: 380,
          easing: 'cubic-bezier(.34,1.56,.64,1)',
          fill: 'forwards',
        })
        sparkle(center, 12)
      }
  }
  ghost.animate([{ opacity: 1 }, { opacity: 1, offset: 0.75 }, { opacity: 0, transform: 'scale(.96)' }], { duration: 1300, fill: 'forwards' }).onfinish =
    () => ghost.remove()
}
