import { useEffect, useMemo, useRef, useState } from 'react'
import type { MapRef } from 'react-map-gl/mapbox'
import { Search, X } from 'lucide-react'
import { forwardGeocode } from '../lib/forwardGeocode'
import { geocodeBiasFor, type GeocodeBias } from '../lib/geocodeBias'
import type { Coords } from '../lib/location'
import type { Court } from '../lib/types'
import { SportIcon } from './icons'
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
}

export function MapSearchBar({
  mapRef,
  proximity,
  locationBias,
  courts = [],
  onSelectCourt,
  placeholder,
  className = '',
}: Props) {
  const { t } = useLocale()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [places, setPlaces] = useState<Awaited<ReturnType<typeof forwardGeocode>>>([])
  const [loading, setLoading] = useState(false)
  const [addressBias, setAddressBias] = useState<GeocodeBias | undefined>()
  const wrapRef = useRef<HTMLDivElement>(null)

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
  const showPanel = open && query.trim().length >= 2 && (hasResults || loading)

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <div className="flex items-center gap-2 rounded-xl border border-line bg-surface/95 px-3 py-2 shadow backdrop-blur-sm">
        <Search className="size-4 shrink-0 text-ink-2" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder ?? t.courts.map.searchPlaceholder}
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-2"
          autoComplete="off"
          enterKeyHint="search"
        />
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
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-line bg-surface py-1 shadow-lg"
          role="listbox"
        >
          {loading && !courtHits.length ? (
            <li className="px-3 py-2 text-xs text-ink-2">{t.courts.map.searching}</li>
          ) : null}
          {courtHits.map((c) => {
            const slug = c.sports[0]?.slug ?? 'basketball'
            return (
              <li key={c.id}>
                <button
                  type="button"
                  role="option"
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-surface-2"
                  onClick={() => pickCourt(c)}
                >
                  <SportIcon slug={slug} className="mt-0.5 size-4 shrink-0 text-brand" />
                  <span>
                    <span className="font-semibold text-ink">{c.name}</span>
                    <span className="block text-xs text-ink-2">{t.courts.map.courtOnMap}</span>
                  </span>
                </button>
              </li>
            )
          })}
          {places.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                role="option"
                className="w-full px-3 py-2 text-left text-sm hover:bg-surface-2"
                onClick={() => flyTo(p.center[0], p.center[1])}
              >
                <span className="font-medium text-ink">{p.place_name}</span>
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
