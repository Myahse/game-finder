import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import Map, { AttributionControl, Marker, type MapRef } from 'react-map-gl/mapbox'
import { Maximize2, Minimize2, MapPin } from './icons'
import type { Coords } from '../lib/location'
import { configureEarthMap } from '../lib/mapboxEarth'
import { useTheme } from '../theme/ThemeProvider'
import { mapStyleForTheme } from '../theme/mapStyle'
import { MAPBOX_ACCESS_TOKEN, MAPBOX_MAP_PROPS, mapboxConfigured, mapboxTokenSetupError } from '../lib/mapbox'

function CourtPlacementMap({
  value,
  initial,
  onChange,
  className = '',
  mapRef,
}: {
  value: Coords | null
  initial: Coords
  onChange: (c: Coords) => void
  className?: string
  mapRef?: RefObject<MapRef | null>
}) {
  const { isDark } = useTheme()
  const innerRef = useRef<MapRef>(null)
  const ref = mapRef ?? innerRef

  const lockMapRotation = useCallback(() => {
    const map = ref.current?.getMap()
    if (!map) return
    map.dragRotate.disable()
    map.touchZoomRotate.disableRotation()
    if (map.getBearing() !== 0) map.setBearing(0)
    if (map.getPitch() !== 0) map.setPitch(0)
  }, [ref])

  useEffect(() => {
    const map = ref.current?.getMap()
    if (!map) return
    const apply = () => configureEarthMap(map)
    if (map.isStyleLoaded()) apply()
    else map.once('style.load', apply)
  }, [isDark, ref])

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Map
        {...MAPBOX_MAP_PROPS}
        ref={ref}
        mapboxAccessToken={MAPBOX_ACCESS_TOKEN}
        initialViewState={{ longitude: initial.longitude, latitude: initial.latitude, zoom: 15, bearing: 0, pitch: 0 }}
        minZoom={2}
        maxZoom={18}
        mapStyle={mapStyleForTheme(isDark)}
        onClick={(e) => onChange({ latitude: e.lngLat.lat, longitude: e.lngLat.lng })}
        dragRotate={false}
        pitchWithRotate={false}
        maxPitch={0}
        onLoad={(e) => {
          configureEarthMap(e.target)
          lockMapRotation()
        }}
        attributionControl={false}
        logoPosition="bottom-right"
        style={{ width: '100%', height: '100%' }}
        cursor="crosshair"
      >
        <AttributionControl compact position="bottom-left" />
        {value && (
          <Marker
            longitude={value.longitude}
            latitude={value.latitude}
            anchor="bottom"
            draggable
            onDragEnd={(e) => onChange({ latitude: e.lngLat.lat, longitude: e.lngLat.lng })}
          >
            <MapPin className="size-10 text-brand drop-shadow" strokeWidth={2.4} aria-label="Court location" />
          </Marker>
        )}
      </Map>
      {!value && (
        <p className="pointer-events-none absolute inset-x-0 top-2 mx-auto w-fit rounded-full bg-surface px-3 py-1 text-xs font-semibold shadow">
          Tap the map where the court is
        </p>
      )}
    </div>
  )
}

/** Tap the map to drop the court pin. Optional expand for precise placement. */
export function LocationPicker({
  value,
  initial,
  onChange,
  allowExpand = true,
}: {
  value: Coords | null
  initial: Coords
  onChange: (c: Coords) => void
  allowExpand?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const expandedMapRef = useRef<MapRef>(null)

  useEffect(() => {
    if (!expanded) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [expanded])

  const mapboxErr = mapboxTokenSetupError()
  if (mapboxErr || !mapboxConfigured()) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-line bg-surface-2 p-4 text-center text-xs text-ink-2">
        {mapboxErr ?? 'Add VITE_MAPBOX_ACCESS_TOKEN (public pk.* token) to show the map.'}
      </div>
    )
  }

  return (
    <>
      <div className="relative h-64 rounded-2xl border border-line">
        <CourtPlacementMap value={value} initial={initial} onChange={onChange} className="h-full rounded-2xl" />
        {allowExpand && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="absolute right-2 top-2 z-10 flex items-center gap-1.5 rounded-full border border-line bg-surface/95 px-3 py-1.5 text-xs font-semibold text-ink shadow-sm backdrop-blur hover:bg-surface-2"
            aria-label="Expand map"
          >
            <Maximize2 className="size-3.5" aria-hidden />
            Expand
          </button>
        )}
      </div>

      {expanded && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-bg"
          role="dialog"
          aria-modal="true"
          aria-label="Place court on map"
        >
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <p className="text-sm font-semibold text-ink">Place the court</p>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-semibold text-ink"
            >
              <Minimize2 className="size-3.5" aria-hidden />
              Done
            </button>
          </header>
          <div className="relative min-h-0 flex-1">
            <CourtPlacementMap
              mapRef={expandedMapRef}
              value={value}
              initial={value ?? initial}
              onChange={onChange}
              className="absolute inset-0"
            />
          </div>
        </div>
      )}
    </>
  )
}
