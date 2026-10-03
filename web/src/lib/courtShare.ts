/** Direct link — opens court details even when the pin is outside the map radius. */
export function courtShareUrl(courtId: string) {
  return `${window.location.origin}/courts/${encodeURIComponent(courtId)}`
}
