import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Map, { AttributionControl, Marker, type MapRef } from 'react-map-gl/mapbox'
import Supercluster, { type ClusterProperties } from 'supercluster'
import type { Coords } from '../lib/location'
import { UserLocationPulse } from './UserLocationPulse'
import { configureEarthMap } from '../lib/mapboxEarth'
import {
  MAPBOX_ACCESS_TOKEN,
  MAPBOX_MAP_PROPS,
  MAP_STYLE_DARK,
  MAP_STYLE_LIGHT,
  mapboxConfigured,
} from '../lib/mapbox'
import { SportIcon, Users } from './icons'
import { courtPhotoUrl } from '../lib/mediaUrl'
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

  const lockMapRotation = () => {
    const map = mapRef.current?.getMap()
    if (!map) return
    map.dragRotate.disable()
    map.touchZoomRotate.disableRotation()
    if (map.getBearing() !== 0) map.setBearing(0)
    if (map.getPitch() !== 0) map.setPitch(0)
  }

  const onMapReady = () => {
    const map = mapRef.current?.getMap()
    if (map) configureEarthMap(map)
    lockMapRotation()
    sync()
  }

  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map) return
    const apply = () => configureEarthMap(map)
    if (map.isStyleLoaded()) apply()
    else map.once('style.load', apply)
  }, [dark])

  const sync = () => {
    const m = mapRef.current
    if (!m) return
    lockMapRotation()
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
        {...MAPBOX_MAP_PROPS}
        ref={mapRef}
        mapboxAccessToken={MAPBOX_ACCESS_TOKEN}
        initialViewState={{ longitude: center.longitude, latitude: center.latitude, zoom: 13, bearing: 0, pitch: 0 }}
        minZoom={2}
        maxZoom={18}
        mapStyle={dark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT}
        onLoad={onMapReady}
        onMoveEnd={sync}
        dragRotate={false}
        pitchWithRotate={false}
        maxPitch={0}
        attributionControl={false}
        logoPosition="bottom-right"
        style={{ width: '100%', height: '100%' }}
      >
        <AttributionControl compact position="bottom-left" />
        {me && (
          <Marker longitude={me.longitude} latitude={me.latitude} anchor="center">
            <UserLocationPulse />
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

/** Match mobile [CourtMapPin] ring + stick colors. */
const ringClass: Record<Activity, string> = {
  active: 'border-live',
  players: 'border-players',
  inactive: 'border-idle',
}

const ringShadow: Record<Activity, string> = {
  active: 'shadow-[0_0_12px_rgba(22,163,74,0.55)]',
  players: 'shadow-[0_0_6px_rgba(234,179,8,0.35)]',
  inactive: 'shadow-lg',
}

const thumbBg: Record<Activity, string> = {
  active: 'bg-live/12',
  players: 'bg-players/25',
  inactive: 'bg-[#f0ede6]',
}

function PinStick({ activity }: { activity: Activity }) {
  const fill =
    activity === 'active' ? 'var(--live)' : activity === 'players' ? 'var(--players)' : 'var(--idle)'
  return (
    <svg width="14" height="12" viewBox="0 0 14 12" className="-mt-px shrink-0" aria-hidden>
      <path
        d="M7 12 0 0h14L7 12Z"
        fill={fill}
        stroke="#fff"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function PinFallback({
  activity,
  slug,
}: {
  activity: Activity
  slug: string
}): ReactNode {
  if (activity === 'players') {
    return <Users className="size-[22px] text-[#8a6a00]" strokeWidth={2.2} />
  }
  return (
    <SportIcon
      slug={slug}
      className={`size-[26px] ${activity === 'active' ? 'text-live' : 'text-[#6b7280]'}`}
    />
  )
}

/** Court photo in the pin circle (mobile: Image.network + errorBuilder). */
function PinPicture({
  src,
  activity,
  slug,
}: {
  src: string
  activity: Activity
  slug: string
}) {
  const [broken, setBroken] = useState(false)
  if (broken) return <PinFallback activity={activity} slug={slug} />
  return (
    <img
      src={src}
      alt=""
      className="absolute inset-0 size-full object-cover"
      decoding="async"
      draggable={false}
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  )
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
  const photo = courtPhotoUrl(court.photos ?? [])
  const label =
    court.activity === 'inactive'
      ? `${court.name}: inactive`
      : `${court.name}: ${court.player_count} players${court.activity === 'active' ? ', game active' : ''}`
  const showCount = court.activity !== 'inactive' && court.player_count > 0
  const activity = court.activity
  const slug = sport?.slug ?? 'basketball'

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      aria-label={label}
      className={`group relative flex flex-col items-center transition ${selected ? 'z-10 scale-110' : 'hover:scale-105'}`}
      style={{ width: 54, height: 62 }}
    >
      <div className="relative flex flex-col items-center">
        <span
          className={`relative size-[46px] overflow-hidden rounded-full border-[2.5px] border-white ${ringShadow[activity]} ${
            selected ? 'ring-2 ring-ink ring-offset-1 ring-offset-transparent' : ''
          }`}
        >
          <span
            className={`relative flex size-full items-center justify-center overflow-hidden rounded-full border-[3px] ${ringClass[activity]} ${
              photo ? 'bg-ink/5' : thumbBg[activity]
            }`}
          >
            {photo ? (
              <PinPicture src={photo} activity={activity} slug={slug} />
            ) : (
              <PinFallback activity={activity} slug={slug} />
            )}
          </span>
        </span>
        <PinStick activity={activity} />
        {showCount && (
          <span
            className={`absolute top-[32px] left-1/2 -translate-x-1/2 rounded-full border-[1.5px] border-white px-1.5 py-0.5 text-[11px] font-black leading-none text-white ${
              activity === 'active' ? 'bg-live' : 'bg-players'
            }`}
          >
            {court.player_count}
          </span>
        )}
      </div>
    </button>
  )
}
