import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import Map, { AttributionControl, Marker, type MapRef } from 'react-map-gl/mapbox'
import { LocateFixed, MapPin, Minus, Plus } from './icons'
import type { Coords } from '../lib/location'
import { configureEarthMap } from '../lib/mapboxEarth'
import { offscreenEdgeHint } from '../lib/mapOffscreenEdge'
import { useTheme } from '../theme/ThemeProvider'
import { mapStyleForTheme } from '../theme/mapStyle'
import { MAPBOX_ACCESS_TOKEN, MAPBOX_MAP_PROPS, mapboxConfigured, mapboxTokenSetupError } from '../lib/mapbox'
import type { Court } from '../lib/types'
import { UserLocationPulse } from './UserLocationPulse'

type Props = {
  value: Coords | null
  initial: Coords
  onChange: (c: Coords) => void
  me?: Coords | null
  courts?: Court[]
  className?: string
  mapRef?: RefObject<MapRef | null>
  /** Show edge arrow when the court pin is outside the visible map area */
  edgePinHint?: boolean
}

export function CourtPlacementMap({
  value,
  initial,
  onChange,
  me,
  courts = [],
  className = '',
  mapRef,
  edgePinHint = true,
}: Props) {
  const { isDark } = useTheme()
  const innerRef = useRef<MapRef>(null)
  const ref = mapRef ?? innerRef
  const containerRef = useRef<HTMLDivElement>(null)
  const [edge, setEdge] = useState<ReturnType<typeof offscreenEdgeHint>>(null)

  const lockMapRotation = useCallback(() => {
    const map = ref.current?.getMap()
    if (!map) return
    map.dragRotate.disable()
    map.touchZoomRotate.disableRotation()
    if (map.getBearing() !== 0) map.setBearing(0)
    if (map.getPitch() !== 0) map.setPitch(0)
  }, [ref])

  const syncEdge = useCallback(() => {
    if (!edgePinHint || !value) {
      setEdge(null)
      return
    }
    const map = ref.current?.getMap()
    const el = containerRef.current
    if (!map || !el) return
    const p = map.project([value.longitude, value.latitude])
    const r = el.getBoundingClientRect()
    setEdge(offscreenEdgeHint(r.width, r.height, p.x, p.y))
  }, [edgePinHint, value, ref])

  useEffect(() => {
    const map = ref.current?.getMap()
    if (!map) return
    const apply = () => configureEarthMap(map)
    if (map.isStyleLoaded()) apply()
    else map.once('style.load', apply)
  }, [isDark, ref])

  useEffect(() => {
    syncEdge()
  }, [syncEdge, value])

  const zoomBy = (delta: number) => {
    const map = ref.current?.getMap()
    if (!map) return
    map.zoomTo(Math.min(18, Math.max(2, map.getZoom() + delta)), { duration: 200 })
  }

  const goToMe = () => {
    if (!me) return
    ref.current?.flyTo({ center: [me.longitude, me.latitude], zoom: 16, duration: 700 })
  }

  const goToPin = () => {
    if (!value) return
    ref.current?.flyTo({ center: [value.longitude, value.latitude], zoom: Math.max(16, ref.current.getMap()?.getZoom() ?? 16), duration: 500 })
  }

  const mapboxErr = mapboxTokenSetupError()
  if (mapboxErr || !mapboxConfigured()) {
    return (
      <div className={`flex items-center justify-center bg-surface-2 p-4 text-center text-xs text-ink-2 ${className}`}>
        {mapboxErr ?? 'Add VITE_MAPBOX_ACCESS_TOKEN (public pk.* token) to show the map.'}
      </div>
    )
  }

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className}`}>
      <Map
        {...MAPBOX_MAP_PROPS}
        ref={ref}
        mapboxAccessToken={MAPBOX_ACCESS_TOKEN}
        initialViewState={{ longitude: initial.longitude, latitude: initial.latitude, zoom: 15, bearing: 0, pitch: 0 }}
        minZoom={2}
        maxZoom={18}
        mapStyle={mapStyleForTheme(isDark)}
        onClick={(e) => onChange({ latitude: e.lngLat.lat, longitude: e.lngLat.lng })}
        onMove={syncEdge}
        onMoveEnd={syncEdge}
        onLoad={(e) => {
          configureEarthMap(e.target)
          lockMapRotation()
          syncEdge()
        }}
        antialias
        dragRotate={false}
        pitchWithRotate={false}
        maxPitch={0}
        attributionControl={false}
        logoPosition="bottom-right"
        style={{ width: '100%', height: '100%' }}
        cursor="crosshair"
      >
        <AttributionControl compact position="bottom-left" />
        {me && (
          <Marker longitude={me.longitude} latitude={me.latitude} anchor="center">
            <UserLocationPulse />
          </Marker>
        )}
        {courts.map((c) => (
          <Marker key={c.id} longitude={c.longitude} latitude={c.latitude} anchor="bottom">
            <span
              className="block size-3 rounded-full border-2 border-white bg-idle shadow"
              title={c.name}
              aria-hidden
            />
          </Marker>
        ))}
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

      <div className="absolute left-3 bottom-3 z-10 flex flex-col overflow-hidden rounded-xl border border-line bg-surface/95 shadow backdrop-blur">
        <button type="button" className="flex size-10 items-center justify-center text-ink hover:bg-surface-2" onClick={() => zoomBy(1)} aria-label="Zoom in">
          <Plus className="size-5" />
        </button>
        <div className="h-px bg-line" />
        <button type="button" className="flex size-10 items-center justify-center text-ink hover:bg-surface-2" onClick={() => zoomBy(-1)} aria-label="Zoom out">
          <Minus className="size-5" />
        </button>
      </div>

      {me && (
        <button
          type="button"
          onClick={goToMe}
          className="absolute right-3 bottom-3 z-10 flex size-11 items-center justify-center rounded-xl border border-line bg-surface/95 text-brand shadow backdrop-blur hover:bg-surface-2"
          aria-label="Center on my position"
        >
          <LocateFixed className="size-5" />
        </button>
      )}

      {edge && value && (
        <button
          type="button"
          onClick={goToPin}
          className="absolute z-20 flex size-11 items-center justify-center rounded-full border-2 border-brand bg-surface text-brand shadow-lg"
          style={{ left: edge.left, top: edge.top, transform: `translate(-50%, -50%) rotate(${edge.rotationDeg}deg)` }}
          aria-label="Pan to court pin"
        >
          <MapPin className="size-6" strokeWidth={2.4} />
        </button>
      )}
    </div>
  )
}
