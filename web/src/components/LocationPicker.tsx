import Map, { Marker } from 'react-map-gl/maplibre'
import type { Coords } from '../lib/location'

const STYLE = import.meta.env.VITE_MAP_STYLE_LIGHT ?? 'https://tiles.openfreemap.org/styles/positron'

/** Tap the map to drop the court pin. */
export function LocationPicker({ value, initial, onChange }: { value: Coords | null; initial: Coords; onChange: (c: Coords) => void }) {
  return (
    <div className="relative h-64 overflow-hidden rounded-2xl border border-line">
      <Map
        initialViewState={{ longitude: initial.longitude, latitude: initial.latitude, zoom: 15 }}
        mapStyle={STYLE}
        onClick={(e) => onChange({ latitude: e.lngLat.lat, longitude: e.lngLat.lng })}
        style={{ width: '100%', height: '100%' }}
        cursor="crosshair"
      >
        {value && (
          <Marker
            longitude={value.longitude}
            latitude={value.latitude}
            anchor="bottom"
            draggable
            onDragEnd={(e) => onChange({ latitude: e.lngLat.lat, longitude: e.lngLat.lng })}
          >
            <span className="text-4xl drop-shadow" aria-label="Court location">
              📍
            </span>
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
