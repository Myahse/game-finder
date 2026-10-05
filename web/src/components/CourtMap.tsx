import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import Map, { AttributionControl, Marker, type MapRef } from 'react-map-gl/mapbox'
import Supercluster, { type ClusterProperties } from 'supercluster'
import type { Coords } from '../lib/location'
import { UserLocationPulse } from './UserLocationPulse'
import { configureEarthMap } from '../lib/mapboxEarth'
import { clampMapZoom, MAP_MAX_ZOOM, MAP_MIN_ZOOM } from '../lib/mapZoom'
import { MAPBOX_ACCESS_TOKEN, MAPBOX_MAP_PROPS, mapboxConfigured, mapboxTokenSetupError } from '../lib/mapbox'
import { mapStyleForTheme } from '../theme/mapStyle'
import { useTheme } from '../theme/ThemeProvider'
import { Hourglass, SportIcon, Users } from './icons'
import { courtPhotoUrl } from '../lib/mediaUrl'
import { courtPinTone, type CourtPinTone } from '../lib/sort'
import type { Court, Game } from '../lib/types'
type Props = {
  courts: Court[]
  nearbyGames?: Game[]
  center: Coords
  me: Coords | null
  sportSlug: string | null
  selectedId: string | null
  onSelect: (court: Court) => void
  /** Fires when the user pans/zooms so lists load for the visible map, not only GPS. */
  onBrowseCenterChange?: (c: Coords) => void
  mapRef?: RefObject<MapRef | null>
}

type PointProps = { court: Court }
type ClusterProps = { players: number; live: number }

export function CourtMap({
  courts,
  nearbyGames = [],
  center,
  me,
  sportSlug,
  selectedId,
  onSelect,
  onBrowseCenterChange,
  mapRef: mapRefProp,
}: Props) {
  const gamesByCourt = useMemo(() => {
    const m: Record<string, Game[]> = {}
    for (const g of nearbyGames) {
      ;(m[g.court_id] ??= []).push(g)
    }
    return m
  }, [nearbyGames])
  const innerRef = useRef<MapRef>(null)
  const mapRef = mapRefProp ?? innerRef
  const { isDark } = useTheme()
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
      maxZoom: MAP_MAX_ZOOM - 2,
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
  }, [isDark])

  const syncRaf = useRef<number | null>(null)
  const lastBrowseKey = useRef('')
  const sync = () => {
    const m = mapRef.current
    if (!m) return
    lockMapRotation()
    const b = m.getBounds()
    if (!b) return
    setView({ zoom: m.getZoom(), bounds: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()] })
    if (onBrowseCenterChange) {
      const c = m.getCenter()
      const key = `${c.lat.toFixed(3)},${c.lng.toFixed(3)}`
      if (key !== lastBrowseKey.current) {
        lastBrowseKey.current = key
        onBrowseCenterChange({ latitude: c.lat, longitude: c.lng })
      }
    }
  }

  const scheduleSync = () => {
    if (syncRaf.current != null) return
    syncRaf.current = requestAnimationFrame(() => {
      syncRaf.current = null
      sync()
    })
  }

  useEffect(() => {
    const t = setTimeout(sync, 300)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => () => {
    if (syncRaf.current != null) cancelAnimationFrame(syncRaf.current)
  }, [])

  const recenter = () => {
    const target = me ?? center
    mapRef.current?.flyTo({ center: [target.longitude, target.latitude], zoom: 14, duration: 700 })
  }

  const mapboxErr = mapboxTokenSetupError()
  if (mapboxErr || !mapboxConfigured()) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-surface-2 p-6 text-center">
        <p className="max-w-sm text-sm text-ink-2">
          {mapboxErr ??
            'Set VITE_MAPBOX_ACCESS_TOKEN to a public pk.* token (mapbox.com → Tokens), then rebuild or redeploy.'}
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
        minZoom={MAP_MIN_ZOOM}
        maxZoom={MAP_MAX_ZOOM}
        mapStyle={mapStyleForTheme(isDark)}
        onLoad={onMapReady}
        onMove={scheduleSync}
        onMoveEnd={sync}
        onResize={sync}
        antialias
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
              <Marker key={`c${p.cluster_id}`} longitude={lng} latitude={lat} anchor="center">
                <button
                  type="button"
                  onClick={() =>
                    mapRef.current?.flyTo({
                      center: [lng, lat],
                      zoom: clampMapZoom(index.getClusterExpansionZoom(p.cluster_id)),
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
            <Marker key={court.id} longitude={lng} latitude={lat} anchor="bottom" className="ftg-court-marker">
              <CourtPin
                court={court}
                sportSlug={sportSlug}
                pinTone={courtPinTone(court, gamesByCourt[court.id] ?? [])}
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
        className="absolute bottom-[8.5rem] right-4 z-[5] flex size-11 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-lg md:bottom-8 md:size-12"
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

/** Pin body height — geographic anchor is the stick tip (mobile CourtMapPin.totalHeight). */
const COURT_PIN_HEIGHT = 62
const COURT_PIN_WIDTH = 54

/** Match mobile [CourtMapPin] ring + stick colors. */
const ringClass: Record<CourtPinTone, string> = {
  active: 'border-live',
  players: 'border-players',
  inactive: 'border-idle',
  upcoming: 'border-upcoming',
}

const ringShadow: Record<CourtPinTone, string> = {
  active: 'shadow-[0_0_12px_rgba(22,163,74,0.55)]',
  players: 'shadow-[0_0_6px_rgba(234,179,8,0.35)]',
  inactive: 'shadow-lg',
  upcoming: 'shadow-[0_0_10px_rgba(37,99,235,0.45)]',
}

const thumbBg: Record<CourtPinTone, string> = {
  active: 'bg-live/12',
  players: 'bg-players/25',
  inactive: 'bg-[#f0ede6]',
  upcoming: 'bg-upcoming/12',
}

function PinStick({ activity }: { activity: CourtPinTone }) {
  const fill =
    activity === 'active'
      ? 'var(--live)'
      : activity === 'players'
        ? 'var(--players)'
        : activity === 'upcoming'
          ? 'var(--upcoming)'
          : 'var(--idle)'
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
  activity: CourtPinTone
  slug: string
}): ReactNode {
  if (activity === 'players') {
    return <Users className="size-[22px] text-[#8a6a00]" strokeWidth={2.2} />
  }
  return (
    <SportIcon
      slug={slug}
      className={`size-[26px] ${
        activity === 'active' ? 'text-live' : activity === 'upcoming' ? 'text-upcoming' : 'text-[#6b7280]'
      }`}
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
  activity: CourtPinTone
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
  pinTone,
  selected,
  onClick,
}: {
  court: Court
  sportSlug: string | null
  pinTone?: CourtPinTone
  selected?: boolean
  onClick?: () => void
}) {
  const sport = court.sports.find((s) => s.slug === sportSlug) ?? court.sports[0]
  const photo = courtPhotoUrl(court.photos ?? [])
  const preview = court.status === 'pending'
  const label = preview
    ? `${court.name}: preview (pending review)`
    : court.activity === 'inactive'
      ? `${court.name}: inactive`
      : `${court.name}: ${court.player_count} players${court.activity === 'active' ? ', game active' : ''}`
  const activity = pinTone ?? court.activity
  const showCount = !preview && activity !== 'inactive' && court.player_count > 0
  const slug = sport?.slug ?? 'basketball'

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      aria-label={label}
      className={`ftg-court-pin group relative flex flex-col items-center transition-transform duration-150 ${
        selected ? 'z-10' : ''
      }`}
      style={{ width: COURT_PIN_WIDTH, height: COURT_PIN_HEIGHT }}
    >
      <div className="relative flex w-full flex-col items-center">
        <span
          className={`relative size-[46px] overflow-hidden rounded-full border-[2.5px] border-white ${
            preview ? 'shadow-md' : ringShadow[activity]
          } ${selected ? 'ring-[3px] ring-brand ring-offset-2 ring-offset-transparent' : ''}`}
        >
          <span
            className={`relative flex size-full items-center justify-center overflow-hidden rounded-full border-[3px] ${
              preview ? 'border-dashed border-players bg-players/20' : ringClass[activity]
            } ${photo ? 'bg-ink/5' : preview ? 'bg-players/15' : thumbBg[activity]}`}
          >
            {photo ? (
              <PinPicture src={photo} activity={activity} slug={slug} />
            ) : preview ? (
              <Hourglass className="size-6 text-players" aria-hidden />
            ) : (
              <PinFallback activity={activity} slug={slug} />
            )}
            {preview ? (
              <span
                className="absolute inset-0 rounded-full bg-surface/35 backdrop-blur-[1px]"
                aria-hidden
              />
            ) : null}
          </span>
        </span>
        {preview ? (
          <svg width="14" height="12" viewBox="0 0 14 12" className="-mt-px shrink-0" aria-hidden>
            <path
              d="M7 12 0 0h14L7 12Z"
              fill="var(--players)"
              stroke="#fff"
              strokeWidth="1.5"
              strokeDasharray="3 2"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <PinStick activity={activity} />
        )}
        {showCount && (
          <span
            className={`absolute top-[32px] left-1/2 -translate-x-1/2 rounded-full border-[1.5px] border-white px-1.5 py-0.5 text-[11px] font-black leading-none text-white ${
              activity === 'active' ? 'bg-live' : activity === 'upcoming' ? 'bg-upcoming' : 'bg-players'
            }`}
          >
            {court.player_count}
          </span>
        )}
      </div>
      <span
        className={`pointer-events-none absolute left-1/2 top-full z-10 mt-0.5 w-max max-w-[110px] -translate-x-1/2 truncate rounded-md border px-1.5 py-0.5 text-center text-[10px] font-bold leading-tight shadow-sm ${
          preview
            ? 'border-players/60 bg-players/20 text-ink'
            : selected
              ? 'border-brand bg-surface text-ink'
              : 'border-line/80 bg-surface/95 text-ink'
        }`}
      >
        {preview ? `Preview · ${court.name}` : court.name}
      </span>
    </button>
  )
}
