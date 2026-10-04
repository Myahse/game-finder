import { api } from './api'

export function gameSharePath(token: string) {
  return `/g/${encodeURIComponent(token.trim())}`
}

export function gameShareUrlFromToken(token: string) {
  return `${window.location.origin}${gameSharePath(token)}`
}

/** Short public link (no UUID in the URL). */
export async function createGameShareUrl(gameId: string): Promise<string> {
  const { token } = await api<{ token: string }>(`/api/games/${gameId}/share-link`, { method: 'POST' })
  return gameShareUrlFromToken(token)
}
