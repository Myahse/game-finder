/** Game ids that should play the "just appeared" animation on the map rail. */
const pulse = new Set<string>()
const listeners = new Set<(ids: Set<string>) => void>()

export function subscribeLiveGamePulse(cb: (ids: Set<string>) => void): () => void {
  listeners.add(cb)
  cb(new Set(pulse))
  return () => {
    listeners.delete(cb)
  }
}

export function pulseLiveGames(ids: string[]) {
  if (ids.length === 0) return
  ids.forEach((id) => pulse.add(id))
  listeners.forEach((cb) => cb(new Set(pulse)))
  window.setTimeout(() => {
    ids.forEach((id) => pulse.delete(id))
    listeners.forEach((cb) => cb(new Set(pulse)))
  }, 2800)
}
