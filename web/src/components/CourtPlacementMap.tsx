import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import Map, { AttributionControl, Marker, type MapRef } from 'react-map-gl/mapbox'
import { LocateFixed, MapPin, Minus, Plus } from './icons'
import type { Coords } from '../lib/location'
import { configureEarthMap } from '../lib/mapboxEarth'
import { clampMapZoom, MAP_MAX_ZOOM, MAP_MIN_ZOOM } from '../lib/mapZoom'
import { offscreenEdgeHint } from '../lib/mapOffscreenEdge'
import { useTheme } from '../theme/ThemeProvider'
import { mapStyleForTheme } from '../theme/mapStyle'
import { MAPBOX_ACCESS_TOKEN, MAPBOX_MAP_PROPS, mapboxConfigured, mapboxTokenSetupError } from '../lib/mapbox'
import type { Court } from '../lib/types'
import { UserLocationPulse } from './UserLocationPulse'
import { useLocale } from '../i18n/LocaleProvider'
import { CrosshairPin, type CrosshairPinHandle } from './CrosshairPin'

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
  /** View-only map (no pin drag / map tap). */
  readOnly?: boolean
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
  readOnly = false,
}: Props) {
  const { t } = useLocale()
  const { isDark } = useTheme()
  const innerRef = useRef<MapRef>(null)
  const ref = mapRef ?? innerRef
  const containerRef = useRef<HTMLDivElement>(null)
  const [edge, setEdge] = useState<ReturnType<typeof offscreenEdgeHint>>(null)
  // Editable maps use a fixed pin over a crosshair: you move the map, not the pin.
  const crosshair = !readOnly
  const pinRef = useRef<CrosshairPinHandle>(null)
  const userMove = useRef(false)
  const lastPx = useRef<{ x: number; y: number } | null>(null)

  // The value changed from outside (my position, address search): bring it under the crosshair.
  useEffect(() => {
    if (!crosshair || !value) return
    const map = ref.current?.getMap()
    if (!map) return
    const c = map.getCenter()
    const p = map.project([value.longitude, value.latitude])
    const mid = map.project(c)
    if (Math.hypot(p.x - mid.x, p.y - mid.y) > 2) map.easeTo({ center: [value.longitude, value.latitude], duration: 500 })
  }, [crosshair, value, ref])

  const lockMapRotation = useCallback(() => {
    const map = ref.current?.getMap()
    if (!map) return
    map.dragRotate.disable()
    map.touchZoomRotate.disableRotation()
    if (map.getBearing() !== 0) map.setBearing(0)
    if (map.getPitch() !== 0) map.setPitch(0)
  }, [ref])

  const syncEdge = useCallback(() => {
    if (!edgePinHint || !value || crosshair) {
      setEdge(null)
      return
    }
    const map = ref.current?.getMap()
    const el = containerRef.current
    if (!map || !el) return
    const p = map.project([value.longitude, value.latitude])
    const r = el.getBoundingClientRect()
    setEdge(offscreenEdgeHint(r.width, r.height, p.x, p.y))
  }, [edgePinHint, value, ref, crosshair])

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
    map.zoomTo(clampMapZoom(map.getZoom() + delta), { duration: 200 })
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
        {mapboxErr ?? t.courts.map.tokenMissingShort}
      </div>
    )
  }

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className}`}>
      <Map
        {...MAPBOX_MAP_PROPS}
        ref={ref}
        mapboxAccessToken={MAPBOX_ACCESS_TOKEN}
        initialViewState={{ longitude: (value ?? initial).longitude, latitude: (value ?? initial).latitude, zoom: 15, bearing: 0, pitch: 0 }}
        minZoom={MAP_MIN_ZOOM}
        maxZoom={MAP_MAX_ZOOM}
        mapStyle={mapStyleForTheme(isDark)}
        onClick={
          readOnly
            ? undefined
            : (e) => {
                // Tap: slide that spot under the crosshair (the pin lifts, then lands there).
                userMove.current = true
                pinRef.current?.lift()
                e.target.easeTo({ center: e.lngLat, duration: 450 })
              }
        }
        onMoveStart={(e) => {
          if (!crosshair) return
          if ('originalEvent' in e && e.originalEvent) userMove.current = true
          if (userMove.current) pinRef.current?.lift()
          lastPx.current = null
        }}
        onMove={(e) => {
          syncEdge()
          if (!crosshair || !userMove.current) return
          const map = e.target
          const c = map.project(map.getCenter())
          const prevCenter = lastPx.current
          lastPx.current = { x: c.x, y: c.y }
          if (prevCenter) pinRef.current?.lean(prevCenter.x - c.x)
        }}
        onMoveEnd={(e) => {
          syncEdge()
          if (!crosshair || !userMove.current) return
          userMove.current = false
          const c = e.target.getCenter()
          pinRef.current?.drop()
          onChange({ latitude: c.lat, longitude: c.lng })
        }}
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
        cursor="grab"
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
        {value && !crosshair && (
          <Marker
            longitude={value.longitude}
            latitude={value.latitude}
            anchor="bottom"
            draggable={!readOnly}
            onDragEnd={readOnly ? undefined : (e) => onChange({ latitude: e.lngLat.lat, longitude: e.lngLat.lng })}
          >
            <MapPin className="size-10 text-brand drop-shadow" strokeWidth={2.4} aria-label={t.courts.map.courtLocation} />
          </Marker>
        )}
      </Map>

      {crosshair && <CrosshairPin ref={pinRef} label={t.courts.map.here} placed={!!value} />}

      <div className="absolute left-3 bottom-3 z-10 flex flex-col overflow-hidden rounded-xl border border-line bg-surface/95 shadow backdrop-blur">
        <button type="button" className="flex size-10 items-center justify-center text-ink hover:bg-surface-2" onClick={() => zoomBy(1)} aria-label={t.courts.map.zoomIn}>
          <Plus className="size-5" />
        </button>
        <div className="h-px bg-line" />
        <button type="button" className="flex size-10 items-center justify-center text-ink hover:bg-surface-2" onClick={() => zoomBy(-1)} aria-label={t.courts.map.zoomOut}>
          <Minus className="size-5" />
        </button>
      </div>

      {me && (
        <button
          type="button"
          onClick={goToMe}
          className="absolute right-3 bottom-3 z-10 flex size-11 items-center justify-center rounded-xl border border-line bg-surface/95 text-brand shadow backdrop-blur hover:bg-surface-2"
          aria-label={t.courts.map.centerOnMyPosition}
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
          aria-label={t.courts.map.panToPin}
        >
          <MapPin className="size-6" strokeWidth={2.4} />
        </button>
      )}
    </div>
  )
}
