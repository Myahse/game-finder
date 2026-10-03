/** Pin on map canvas → arrow on viewport edge when pin is off-screen (Google Maps style). */
export type OffscreenEdgeHint = {
  left: number
  top: number
  rotationDeg: number
}

export function offscreenEdgeHint(
  width: number,
  height: number,
  x: number,
  y: number,
  inset = 40,
): OffscreenEdgeHint | null {
  if (width < 1 || height < 1) return null
  if (x >= inset && x <= width - inset && y >= inset && y <= height - inset) return null

  const cx = width / 2
  const cy = height / 2
  const dx = x - cx
  const dy = y - cy
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return null

  const hw = Math.max(8, width / 2 - inset)
  const hh = Math.max(8, height / 2 - inset)
  const scale = Math.min(
    Math.abs(dx) > 0.001 ? hw / Math.abs(dx) : Infinity,
    Math.abs(dy) > 0.001 ? hh / Math.abs(dy) : Infinity,
  )

  return {
    left: cx + dx * scale,
    top: cy + dy * scale,
    rotationDeg: (Math.atan2(dy, dx) * 180) / Math.PI,
  }
}
