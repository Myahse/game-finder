import { useEffect, useMemo, useRef, useState } from 'react'
import Map, { AttributionControl, Marker, type MapRef } from 'react-map-gl/mapbox'
import Supercluster, { type ClusterProperties } from 'supercluster'
import type { Coords } from '../lib/location'
import { MAPBOX_ACCESS_TOKEN, MAP_STYLE_DARK, MAP_STYLE_LIGHT, mapboxConfigured } from '../lib/mapbox'
import { SportIcon, Users } from './icons'
import type { Activity, Court } from '../lib/types'

function useDark() {
  const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const on = () => setDark(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return dark
}

type Props = {
  courts: Court[]
  center: Coords
  me: Coords | null
  sportSlug: string | null
  selectedId: string | null
  onSelect: (court: Court) => void
}

type PointProps = { court: Court }
type ClusterProps = { players: number; live: number }

export function CourtMap({ courts, center, me, sportSlug, selectedId, onSelect }: Props) {
  const mapRef = useRef<MapRef>(null)
  const dark = useDark()
  const [view, setView] = useState({ zoom: 13, bounds: null as [number, number, number, number] | null })
  const centeredOnUser = useRef(false)

  // Fly to the user the first time we learn where they are.
  useEffect(() => {
    if (me && !centeredOnUser.current && mapRef.current) {
      centeredOnUser.current = true
      mapRef.current.flyTo({ center: [me.longitude, me.latitude], zoom: 14, duration: 900 })
    }
  }, [me])

  const index = useMemo(() => {
    const sc = new Supercluster<PointProps, ClusterProps>({
      radius: 56,
      maxZoom: 15,
      map: (p) => ({ players: p.court.player_count, live: p.court.activity === 'active' ? 1 : 0 }),
      reduce: (acc, p) => {
        acc.players += p.players
        acc.live += p.live
      },
    })
    sc.load(
      courts.map((c) => ({
        type: 'Feature' as const,
        properties: { court: c },
        geometry: { type: 'Point' as const, coordinates: [c.longitude, c.latitude] },
      })),
    )
    return sc
  }, [courts])

  const items = useMemo(
    () => (view.bounds ? index.getClusters(view.bounds, Math.round(view.zoom)) : []),
    [index, view],
  )

  const sync = () => {
    const m = mapRef.current
    if (!m) return
    const b = m.getBounds()
    if (!b) return
    setView({ zoom: m.getZoom(), bounds: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()] })
  }

  useEffect(() => {
    const t = setTimeout(sync, 300)
    return () => clearTimeout(t)
  }, [])

  const recenter = () => {
    const target = me ?? center
    mapRef.current?.flyTo({ center: [target.longitude, target.latitude], zoom: 14, duration: 700 })
  }

  if (!mapboxConfigured()) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-surface-2 p-6 text-center">
        <p className="max-w-sm text-sm text-ink-2">
          Set <code className="text-ink">VITE_MAPBOX_ACCESS_TOKEN</code> in <code className="text-ink">.env</code> (get a
          public token at mapbox.com), then rebuild or restart the dev server.
        </p>
      </div>
    )
  }

  return (
    <div className="absolute inset-0">
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_ACCESS_TOKEN}
        initialViewState={{ longitude: center.longitude, latitude: center.latitude, zoom: 13 }}
        mapStyle={dark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT}
        onLoad={sync}
        onMoveEnd={sync}
        attributionControl={false}
        logoPosition="bottom-right"
        style={{ width: '100%', height: '100%' }}
      >
        <AttributionControl compact position="bottom-left" />
        {me && (
          <Marker longitude={me.longitude} latitude={me.latitude} anchor="center">
            <span className="relative block size-5 text-[#3b82f6]" aria-label="You are here">
              <span className="pulse relative block size-5 rounded-full border-[3px] border-white bg-current shadow-lg" />
            </span>
          </Marker>
        )}

        {items.map((f) => {
          const [lng, lat] = f.geometry.coordinates
          if ('cluster' in f.properties && f.properties.cluster) {
            const p = f.properties as ClusterProperties & ClusterProps
            return (
              <Marker key={`c${p.cluster_id}`} longitude={lng} latitude={lat}>
                <button
                  type="button"
                  onClick={() =>
                    mapRef.current?.flyTo({
                      center: [lng, lat],
                      zoom: Math.min(index.getClusterExpansionZoom(p.cluster_id), 17),
                      duration: 600,
                    })
                  }
                  className={`display flex size-12 flex-col items-center justify-center rounded-full border-[3px] border-white text-white shadow-lg ${
                    p.live ? 'bg-live' : p.players ? 'bg-players text-ink' : 'bg-idle'
                  }`}
                  aria-label={`${p.point_count} courts, ${p.players} players`}
                >
                  <span className="text-lg font-extrabold leading-none">{p.point_count}</span>
                  <span className="text-[9px] font-bold leading-none opacity-90">COURTS</span>
                </button>
              </Marker>
            )
          }
          const court = (f.properties as PointProps).court
          return (
            <Marker key={court.id} longitude={lng} latitude={lat} anchor="bottom">
              <CourtPin
                court={court}
                sportSlug={sportSlug}
                selected={court.id === selectedId}
                onClick={() => onSelect(court)}
              />
            </Marker>
          )
        })}
      </Map>

      <button
        type="button"
        onClick={recenter}
        className="absolute bottom-44 right-4 z-[5] flex size-12 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-lg md:bottom-8"
        aria-label="Center on my location"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}

const pinStyle: Record<Activity, string> = {
  active: 'bg-live text-white',
  players: 'bg-players text-[#1a1a1a]',
  inactive: 'bg-surface text-ink-2',
}

export function CourtPin({
  court,
  sportSlug,
  selected,
  onClick,
}: {
  court: Court
  sportSlug: string | null
  selected?: boolean
  onClick?: () => void
}) {
  const sport = court.sports.find((s) => s.slug === sportSlug) ?? court.sports[0]
  const label =
    court.activity === 'inactive'
      ? `${court.name}: inactive`
      : `${court.name}: ${court.player_count} players${court.activity === 'active' ? ', game active' : ''}`
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      aria-label={label}
      className={`group relative flex flex-col items-center transition ${selected ? 'z-10 scale-110' : 'hover:scale-105'}`}
    >
      <span
        className={`relative flex h-9 items-center gap-1 rounded-full border-2 px-2.5 text-base font-bold shadow-lg ${
          selected ? 'border-ink' : 'border-white dark:border-[#0b0e12]'
        } ${pinStyle[court.activity]} ${court.activity === 'active' ? 'pulse text-white' : ''}`}
        style={court.activity === 'active' ? { color: 'white' } : undefined}
      >
        <span aria-hidden className="inline-flex">
          {court.activity === 'players' ? (
            <Users className="size-4" />
          ) : (
            <SportIcon slug={sport?.slug ?? 'basketball'} className="size-4" />
          )}
        </span>
        {court.activity !== 'inactive' && <span className="display text-xl leading-none">{court.player_count}</span>}
      </span>
      <span
        className={`-mt-1 size-3 rotate-45 border-b-2 border-r-2 ${selected ? 'border-ink' : 'border-white dark:border-[#0b0e12]'} ${pinStyle[court.activity]}`}
      />
    </button>
  )
}
