import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchUsernameAvailable, usernamePattern } from './usernameCheck'

export type UsernameStatus = 'idle' | 'invalid' | 'checking' | 'available' | 'taken'

const DEBOUNCE_MS = 600
const CACHE_MS = 60_000

/** Answers the server already gave (lowercased name → available), kept a minute. */
const known = new Map<string, { ok: boolean; at: number }>()
function cached(u: string): boolean | undefined {
  const k = known.get(u.toLowerCase())
  return k && Date.now() - k.at < CACHE_MS ? k.ok : undefined
}
function remember(u: string, ok: boolean) {
  known.set(u.toLowerCase(), { ok, at: Date.now() })
}

/** Lowercase ASCII slug for a username candidate ("Ama Kofi" → "amakofi"). */
const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, '')

/** Candidate names built from what the person typed; each is checked against the server before it shows. */
function candidates(u: string, first: string, last: string): string[] {
  const base = slug(u)
  const f = slug(first)
  const l = slug(last)
  const two = () => String(10 + Math.floor(Math.random() * 90))
  const list = [
    f && l ? `${f}.${l}` : '',
    base && l ? `${base}.${l[0]}` : '',
    base ? `${base}_${two()}` : '',
    f && l ? `${f}${l}${two()}` : '',
    base ? `${base}${two()}` : '',
  ]
  return [...new Set(list.map((c) => c.slice(0, 24)))].filter((c) => usernamePattern.test(c) && c !== u.toLowerCase())
}

type Result = { value: string; status: 'idle' | 'available' | 'taken'; suggestions: string[] }

/**
 * Live username availability: a debounced check while typing (and `check()` for blur / Next), plus
 * up to three alternatives the server confirmed free when the name is taken.
 */
export function useUsernameCheck(username: string, sameAs?: string, names: { first?: string; last?: string } = {}) {
  const [res, setRes] = useState<Result>({ value: '', status: 'idle', suggestions: [] })
  const seq = useRef(0)
  /** Mirror of `res` for the async checks (written only where `res` is set). */
  const resRef = useRef<Result>(res)
  const namesRef = useRef(names)
  useEffect(() => {
    namesRef.current = names
  })

  const u = username.trim()
  const same = !!sameAs && u.toLowerCase() === sameAs.trim().toLowerCase()
  const valid = usernamePattern.test(u)

  let status: UsernameStatus
  if (!u || same) status = 'idle'
  else if (!valid) status = 'invalid'
  else if (res.value === u) status = res.status
  else {
    const c = cached(u)
    status = c === undefined ? 'checking' : c ? 'available' : 'taken'
  }
  const suggestions = res.value === u ? res.suggestions : []

  const run = useCallback(
    async (value: string): Promise<boolean> => {
      const v = value.trim()
      if (!usernamePattern.test(v) || (sameAs && v.toLowerCase() === sameAs.trim().toLowerCase())) return false
      const my = ++seq.current
      let ok: boolean | null = cached(v) ?? null
      if (ok === null) {
        ok = await fetchUsernameAvailable(v)
        if (ok !== null) remember(v, ok)
      }
      if (my !== seq.current) return false
      // Network error: same as before, don't block the person.
      const status = ok === null ? 'idle' : ok ? 'available' : 'taken'
      const prev = resRef.current
      // Same answer again (e.g. blur after the debounced check): keep the chips that are showing.
      if (prev.value === v && prev.status === status) return ok === false
      resRef.current = { value: v, status, suggestions: [] }
      setRes(resRef.current)
      if (ok === false) {
        const list = candidates(v, namesRef.current.first ?? '', namesRef.current.last ?? '')
        void Promise.all(list.map((c) => fetchUsernameAvailable(c).then((a) => (a ? c : null)))).then((r) => {
          const free = r.filter((c): c is string => !!c).slice(0, 3)
          free.forEach((c) => remember(c, true))
          if (resRef.current.value !== v) return
          resRef.current = { ...resRef.current, suggestions: free }
          setRes(resRef.current)
        })
      }
      return ok === false
    },
    [sameAs],
  )

  // While typing: the spinner shows straight away (derived above); ask the server once the person pauses.
  useEffect(() => {
    if (!u || same || !valid) {
      seq.current++
      return
    }
    const id = window.setTimeout(() => void run(u), cached(u) === undefined ? DEBOUNCE_MS : 0)
    return () => window.clearTimeout(id)
  }, [u, same, valid, run])

  /** Checks now; resolves `true` when the username is taken. */
  const check = useCallback(() => run(username), [run, username])

  return { status, suggestions, check, taken: status === 'taken' }
}
