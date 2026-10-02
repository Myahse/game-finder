import Map, { AttributionControl, Marker } from 'react-map-gl/mapbox'
import { MapPin } from './icons'
import type { Coords } from '../lib/location'
import { configureEarthMap } from '../lib/mapboxEarth'
import { MAPBOX_ACCESS_TOKEN, MAPBOX_MAP_PROPS, MAP_STYLE_LIGHT, mapboxConfigured } from '../lib/mapbox'

/** Tap the map to drop the court pin. */
export function LocationPicker({
  value,
  initial,
  onChange,
}: {
  value: Coords | null
  initial: Coords
  onChange: (c: Coords) => void
}) {
  if (!mapboxConfigured()) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-line bg-surface-2 p-4 text-center text-xs text-ink-2">
        Add <code className="text-ink">VITE_MAPBOX_ACCESS_TOKEN</code> to show the map.
      </div>
    )
  }

  return (
    <div className="relative h-64 overflow-hidden rounded-2xl border border-line">
      <Map
        {...MAPBOX_MAP_PROPS}
        mapboxAccessToken={MAPBOX_ACCESS_TOKEN}
        initialViewState={{ longitude: initial.longitude, latitude: initial.latitude, zoom: 15, bearing: 0, pitch: 0 }}
        minZoom={2}
        maxZoom={18}
        mapStyle={MAP_STYLE_LIGHT}
        onClick={(e) => onChange({ latitude: e.lngLat.lat, longitude: e.lngLat.lng })}
        dragRotate={false}
        pitchWithRotate={false}
        maxPitch={0}
        onLoad={(e) => {
          const map = e.target
          configureEarthMap(map)
          map.dragRotate.disable()
          map.touchZoomRotate.disableRotation()
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
