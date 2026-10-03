export function profileShareUrl(username: string) {
  const u = username.trim().replace(/^@/, '')
  return `${window.location.origin}/u/${encodeURIComponent(u)}`
}
