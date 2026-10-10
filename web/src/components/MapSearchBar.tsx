import { useEffect, useMemo, useRef, useState } from 'react'
import type { MapRef } from 'react-map-gl/mapbox'
import { Search, X } from 'lucide-react'
import { forwardGeocode } from '../lib/forwardGeocode'
import { geocodeBiasFor, type GeocodeBias } from '../lib/geocodeBias'
import type { Coords } from '../lib/location'
import type { Court } from '../lib/types'
import { SportIcon } from './icons'
import { useSports } from '../lib/queries'
import { Spring, buzz } from '../lib/fx'
import '../styles/motion-part4.css'
import { useLocale } from '../i18n/LocaleProvider'

type Props = {
  mapRef: React.RefObject<MapRef | null>
  /** Map center for flying; address bias uses `locationBias` when set. */
  proximity: Coords
  /** User GPS — country and city bias for address suggestions. */
  locationBias?: Coords | null
  courts?: Court[]
  onSelectCourt?: (court: Court) => void
  placeholder?: string
  className?: string
  /** Type sport names in the empty bar (map page). */
  typingPlaceholder?: boolean
}

export function MapSearchBar({
  mapRef,
  proximity,
  locationBias,
  courts = [],
  onSelectCourt,
  placeholder,
  className = '',
  typingPlaceholder = false,
}: Props) {
  const { t } = useLocale()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [places, setPlaces] = useState<Awaited<ReturnType<typeof forwardGeocode>>>([])
  const [loading, setLoading] = useState(false)
  const [addressBias, setAddressBias] = useState<GeocodeBias | undefined>()
  const wrapRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [focused, setFocused] = useState(false)
  const stretch = useRef<Spring | null>(null)
  useEffect(() => {
    stretch.current = new Spring(1, (v) => barRef.current && (barRef.current.style.transform = `scaleX(${v})`), { k: 260, c: 14 })
    return () => stretch.current?.stop()
  }, [])

  useEffect(() => {
    const origin = locationBias ?? proximity
    let cancelled = false
    void geocodeBiasFor(origin).then((b) => {
      if (!cancelled) setAddressBias(b)
    })
    return () => {
      cancelled = true
    }
  }, [locationBias?.latitude, locationBias?.longitude, proximity.latitude, proximity.longitude])

  const courtHits = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    return courts
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 6)
  }, [courts, query])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setPlaces([])
      setLoading(false)
      return
    }
    setLoading(true)
    const timer = window.setTimeout(() => {
      void forwardGeocode(q, addressBias).then((list) => {
        setPlaces(list)
        setLoading(false)
      })
    }, 280)
    return () => window.clearTimeout(timer)
  }, [query, addressBias])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const flyTo = (lng: number, lat: number, zoom = 15) => {
    mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: 700 })
    setOpen(false)
  }

  const pickCourt = (c: Court) => {
    flyTo(c.longitude, c.latitude, 16)
    onSelectCourt?.(c)
    setQuery(c.name)
  }

  const hasResults = courtHits.length > 0 || places.length > 0
  const q = query.trim().toLowerCase()
  const highlight = (name: string) => {
    const at = q ? name.toLowerCase().indexOf(q) : -1
    if (at < 0) return name
    return (
      <>
        {name.slice(0, at)}
        <mark className="ftg-hit">{name.slice(at, at + q.length)}</mark>
        {name.slice(at + q.length)}
      </>
    )
  }
  // Drag the results down to close them.
  const drag = useRef<number | null>(null)
  const showPanel = open && query.trim().length >= 2 && (hasResults || loading)

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <div
        ref={barRef}
        className={`ftg-sbar relative flex items-center gap-2 rounded-xl border border-line bg-surface/95 px-3 py-2 shadow backdrop-blur-sm ${focused ? 'is-focused' : ''}`}
      >
        <Search className="size-4 shrink-0 text-ink-2" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            setOpen(true)
            setFocused(true)
            // The bar springs open when you tap it.
            stretch.current?.set(0.95)
            stretch.current?.to(1)
            buzz(6)
          }}
          onBlur={() => setFocused(false)}
          placeholder={typingPlaceholder ? '' : (placeholder ?? t.courts.map.searchPlaceholder)}
          aria-label={placeholder ?? t.courts.map.searchPlaceholder}
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-2"
          autoComplete="off"
          enterKeyHint="search"
        />
        {typingPlaceholder && !query && <TypingPlaceholder template={t.courts.map.searchTyping} fallback={placeholder ?? t.courts.map.searchPlaceholder} />}
        {query ? (
          <button
            type="button"
            className="rounded p-0.5 text-ink-2 hover:text-ink"
            aria-label={t.courts.map.clearSearch}
            onClick={() => {
              setQuery('')
              setPlaces([])
            }}
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>
      {showPanel ? (
        <ul
          ref={listRef}
          className="ftg-sres absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-line bg-surface py-1 shadow-lg"
          role="listbox"
          onPointerDown={(e) => {
            if (e.pointerType === 'mouse') return
            drag.current = e.clientY
          }}
          onPointerMove={(e) => {
            if (drag.current == null || !listRef.current) return
            const dy = Math.max(0, e.clientY - drag.current)
            if (listRef.current.scrollTop > 0) return
            listRef.current.style.transform = `translateY(${dy}px)`
            listRef.current.style.opacity = String(1 - dy / 220)
          }}
          onPointerUp={(e) => {
            if (drag.current == null || !listRef.current) return
            const dy = e.clientY - drag.current
            drag.current = null
            const el = listRef.current
            el.style.transition = 'transform .3s cubic-bezier(.34,1.56,.64,1), opacity .3s'
            el.style.transform = ''
            el.style.opacity = ''
            window.setTimeout(() => (el.style.transition = ''), 320)
            if (dy > 60) setOpen(false)
          }}
        >
          {loading && !courtHits.length ? (
            <li className="px-3 py-2 text-xs text-ink-2">{t.courts.map.searching}</li>
          ) : null}
          {courtHits.map((c, i) => {
            const slug = c.sports[0]?.slug ?? 'basketball'
            return (
              <li key={c.id} className="ftg-sres-row" style={{ animationDelay: `${i * 60}ms` }}>
                <button
                  type="button"
                  role="option"
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-surface-2"
                  onClick={() => pickCourt(c)}
                >
                  <SportIcon slug={slug} className="mt-0.5 size-4 shrink-0 text-brand" />
                  <span>
                    <span className="font-semibold text-ink">{highlight(c.name)}</span>
                    <span className="block text-xs text-ink-2">{t.courts.map.courtOnMap}</span>
                  </span>
                </button>
              </li>
            )
          })}
          {places.map((p, i) => (
            <li key={p.id} className="ftg-sres-row" style={{ animationDelay: `${(courtHits.length + i) * 60}ms` }}>
              <button
                type="button"
                role="option"
                className="w-full px-3 py-2 text-left text-sm hover:bg-surface-2"
                onClick={() => flyTo(p.center[0], p.center[1])}
              >
                <span className="font-medium text-ink">{highlight(p.place_name)}</span>
              </button>
            </li>
          ))}
          {!loading && !hasResults ? (
            <li className="px-3 py-2 text-xs text-ink-2">{t.courts.map.noMatches}</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  )
}

/** Empty bar: types "A basketball court", then the next sport, with the sport's icon. */
function TypingPlaceholder({ template, fallback }: { template: string; fallback: string }) {
  const { data: sports } = useSports()
  const list = (sports ?? []).filter((s) => s.active)
  const [i, setI] = useState(0)
  const [n, setN] = useState(0)
  const [erasing, setErasing] = useState(false)
  const sport = list.length ? list[i % list.length] : null
  const word = sport ? sport.name.toLowerCase() : ''
  useEffect(() => {
    if (!word) return
    const done = !erasing && n >= word.length
    const empty = erasing && n <= 0
    const t = window.setTimeout(
      () => {
        if (done) setErasing(true)
        else if (empty) {
          setErasing(false)
          setI((x) => x + 1)
        } else setN((x) => x + (erasing ? -1 : 1))
      },
      done ? 1300 : empty ? 250 : erasing ? 35 : 80,
    )
    return () => window.clearTimeout(t)
  }, [n, erasing, word])
  if (!sport) return <span className="ftg-sph">{fallback}</span>
  const [before, after = ''] = template.split('{sport}')
  return (
    <span className="ftg-sph" aria-hidden>
      <SportIcon key={sport.slug} slug={sport.slug} className="ftg-sph-ico size-4 shrink-0 text-brand" />
      <span className="truncate">
        {before}
        <b>{word.slice(0, n)}</b>
        {n >= word.length ? after : ''}
      </span>
      <span className="ftg-sph-caret" />
    </span>
  )
}
