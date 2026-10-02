/** Parse stored opening_hours (e.g. "06:00–22:00") for time inputs. */
export function parseOpeningHours(raw: string | null | undefined): { opens: string; closes: string } | null {
  if (!raw?.trim()) return null
  for (const sep of ['–', '-', '—', ' to ']) {
    const i = raw.indexOf(sep)
    if (i > 0) {
      const opens = raw.slice(0, i).trim()
      const closes = raw.slice(i + sep.length).trim()
      if (/^\d{1,2}:\d{2}$/.test(opens) && /^\d{1,2}:\d{2}$/.test(closes)) {
        return { opens: padHm(opens), closes: padHm(closes) }
      }
    }
  }
  return null
}

function padHm(s: string): string {
  const [h, m] = s.split(':')
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`
}

export function formatOpeningHours(opens: string, closes: string): string {
  return `${padHm(opens)}–${padHm(closes)}`
}
