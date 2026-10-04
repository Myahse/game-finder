const TOKEN_KEY = 'ftg_game_share_token'
const LEGACY_GAME_ID_KEY = 'ftg_pending_game_id'

export function stashGameShareToken(token: string) {
  const t = token.trim()
  if (t) localStorage.setItem(TOKEN_KEY, t)
}

export function peekGameShareToken(): string | null {
  const t = localStorage.getItem(TOKEN_KEY)?.trim()
  return t || null
}

export function clearGameShareToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export function stashPendingGameId(gameId: string) {
  const id = gameId.trim()
  if (id) localStorage.setItem(LEGACY_GAME_ID_KEY, id)
}

export function peekPendingGameId(): string | null {
  const id = localStorage.getItem(LEGACY_GAME_ID_KEY)?.trim()
  return id || null
}

export function clearPendingGameId() {
  localStorage.removeItem(LEGACY_GAME_ID_KEY)
}

export function gamePathForId(gameId: string) {
  return `/games/${encodeURIComponent(gameId)}`
}

/** Remember resolved game id and drop the short token so we don't bounce back to /g/…. */
export function stashResolvedGameTarget(gameId: string) {
  stashPendingGameId(gameId)
  clearGameShareToken()
}

/** After sign-in, open a shared game if the user landed from a link. */
export function pendingGamePathAfterAuth(): string | null {
  const id = peekPendingGameId()
  if (id) return gamePathForId(id)
  const token = peekGameShareToken()
  if (token) return `/g/${encodeURIComponent(token)}`
  return null
}

export function clearPendingGameNavigation() {
  clearGameShareToken()
  clearPendingGameId()
}

/** Avoid redirect loops when already on the destination game page. */
export function pathMatchesPendingGame(path: string, pending: string): boolean {
  if (path === pending) return true
  const a = path.match(/^\/games\/([^/]+)$/)?.[1]
  const b = pending.match(/^\/games\/([^/]+)$/)?.[1]
  return !!(a && b && a === b)
}
