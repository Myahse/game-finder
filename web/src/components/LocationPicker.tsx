import type { Coords } from '../lib/location'
import type { Court } from '../lib/types'
import { CourtPlacementMap } from './CourtPlacementMap'

/** Compact map embed (e.g. admin). Prefer full step on Add court. */
export function LocationPicker({
  value,
  initial,
  onChange,
  me,
  courts,
}: {
  value: Coords | null
  initial: Coords
  onChange: (c: Coords) => void
  me?: Coords | null
  courts?: Court[]
}) {
  return (
    <CourtPlacementMap
      value={value}
      initial={initial}
      onChange={onChange}
      me={me}
      courts={courts}
      className="h-64 rounded-2xl border border-line"
      edgePinHint
    />
  )
}
