/** Direct link — opens game details (join from any tab). */
export function gameShareUrl(gameId: string) {
  return `${window.location.origin}/games/${encodeURIComponent(gameId)}`
}
