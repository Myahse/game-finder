import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Map, { Marker, type MapRef } from 'react-map-gl/mapbox'
import type { Marker as MapboxMarker } from 'mapbox-gl'
import { Globe, LocateFixed, Minus, Plus, ShieldCheck, Users } from 'lucide-react'
import { useLocale } from '../../i18n/LocaleProvider'
import { useAuth } from '../../lib/auth'
import { useLocation as useGeo } from '../../lib/location'
import { useCourtsNearby } from '../../lib/queries'
import { MAPBOX_ACCESS_TOKEN, MAPBOX_MAP_PROPS } from '../../lib/mapbox'
import { mapStyleForTheme } from '../../theme/mapStyle'
import type { Court } from '../../lib/types'
import { Avatar, Button } from '../../components/ui'
import { SportIcon } from '../../components/icons'
import { firstName, useGamePlayers, useJeuMe } from '../../jeu/data'
import { useJeuSocket, useLobby } from './JeuLayout'

// Mode Jeu on the real map (dark style): the player's avatar walks with the
// joystick, arrow keys or a tap; courts are arenas; friends walk live. The
// avatar starts on the nearest court, so friends only ever see a game position.
const SPEED_PX = 170 // screen pixels per second, whatever the zoom
const NEAR_M = 150
let lastSpot: { lat: number; lng: number } | null = null

const metersPerPx = (lat: number, zoom: number) => (156_543.03 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom
const distM = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const k = 111_320, dx = (b.lng - a.lng) * k * Math.cos((a.lat * Math.PI) / 180), dy = (b.lat - a.lat) * 110_540
  return Math.hypot(dx, dy)
}

export function JeuRealMap() {
  const { t } = useLocale()
  const tj = t.jeu
  const navigate = useNavigate()
  const { user } = useAuth()
  const { center } = useGeo()
  const courtsQ = useCourtsNearby(center, 'basketball', 15)
  const courts = useMemo(() => (courtsQ.data ?? []).filter((c) => c.status === 'approved' || c.status === 'pending'), [courtsQ.data])
  const socket = useJeuSocket()
  const lobby = useLobby()
  const { data: me } = useJeuMe()
  const friendsQ = useGamePlayers(lobby.players.map((p) => p.user_id))
  const mapRef = useRef<MapRef>(null)
  const meMarker = useRef<MapboxMarker | null>(null)
  const pos = useRef<{ lat: number; lng: number } | null>(lastSpot)
  const joy = useRef({ x: 0, y: 0 })
  const target = useRef<{ lat: number; lng: number } | null>(null)
  const follow = useRef(true)
  const [near, setNear] = useState<Court | null>(null)
  const [ready, setReady] = useState(false)
  const knobRef = useRef<HTMLSpanElement>(null)
  const joyRef = useRef<HTMLDivElement>(null)

  // Spawn next to the nearest court once courts are known.
  if (!pos.current && courts[0]) pos.current = { lat: courts[0].latitude - 0.0004, lng: courts[0].longitude }
  const start = pos.current ?? { lat: center.latitude, lng: center.longitude }

  const courtsRef = useRef(courts)
  courtsRef.current = courts
  useEffect(() => {
    if (!ready) return
    const map = mapRef.current?.getMap()
    if (!map) return
    if (pos.current) { map.jumpTo({ center: [pos.current.lng, pos.current.lat] }); socket.setPosition(pos.current.lat, pos.current.lng, 'map') }
    let raf = 0, last = 0, nearId: string | null = null
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now
      const p = pos.current
      if (!p) return
      let vx = joy.current.x, vy = joy.current.y
      if (!vx && !vy && target.current) {
        const tg = target.current, d = distM(p, tg)
        if (d < 3) target.current = null
        else { const dx = (tg.lng - p.lng) * Math.cos((p.lat * Math.PI) / 180), dy = tg.lat - p.lat, n = Math.hypot(dx, dy); vx = dx / n; vy = -dy / n }
      }
      if (vx || vy) {
        const m = SPEED_PX * dt * metersPerPx(p.lat, map.getZoom())
        p.lat -= (vy * m) / 110_540
        p.lng += (vx * m) / (111_320 * Math.cos((p.lat * Math.PI) / 180))
        lastSpot = { ...p }
        meMarker.current?.setLngLat([p.lng, p.lat])
        if (follow.current) map.jumpTo({ center: [p.lng, p.lat] })
        socket.setPosition(p.lat, p.lng, 'map')
      }
      let best: Court | null = null, bd = NEAR_M
      for (const c of courtsRef.current) { const d = distM(p, { lat: c.latitude, lng: c.longitude }); if (d < bd) { bd = d; best = c } }
      if ((best?.id ?? null) !== nearId) { nearId = best?.id ?? null; setNear(best) }
    }
    raf = requestAnimationFrame(loop)
    // arrow keys / ZQSD / WASD
    const keys = new Set<string>()
    const key = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (!['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'z', 'q', 's', 'd', 'w', 'a'].includes(k)) return
      if (e.type === 'keydown') keys.add(k); else keys.delete(k)
      const x = (keys.has('arrowright') || keys.has('d') ? 1 : 0) - (keys.has('arrowleft') || keys.has('q') || keys.has('a') ? 1 : 0)
      const y = (keys.has('arrowdown') || keys.has('s') ? 1 : 0) - (keys.has('arrowup') || keys.has('z') || keys.has('w') ? 1 : 0)
      const n = Math.hypot(x, y) || 1
      joy.current = { x: x / n, y: y / n }; target.current = null; follow.current = true
    }
    window.addEventListener('keydown', key); window.addEventListener('keyup', key)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', key); window.removeEventListener('keyup', key) }
  }, [ready, socket])

  // joystick
  useEffect(() => {
    const J = joyRef.current, K = knobRef.current
    if (!J || !K) return
    const mv = (e: PointerEvent) => { const r = J.getBoundingClientRect(); let dx = e.clientX - r.left - r.width / 2, dy = e.clientY - r.top - r.height / 2; const d = Math.hypot(dx, dy), m = 32; if (d > m) { dx = (dx / d) * m; dy = (dy / d) * m } K.style.transform = `translate(${dx}px,${dy}px)`; joy.current = { x: dx / m, y: dy / m }; target.current = null; follow.current = true }
    const down = (e: PointerEvent) => { e.stopPropagation(); J.setPointerCapture(e.pointerId); mv(e) }
    const move = (e: PointerEvent) => { if (J.hasPointerCapture(e.pointerId)) mv(e) }
    const up = () => { joy.current = { x: 0, y: 0 }; K.style.transform = '' }
    J.addEventListener('pointerdown', down); J.addEventListener('pointermove', move); J.addEventListener('pointerup', up); J.addEventListener('pointercancel', up)
    return () => { J.removeEventListener('pointerdown', down); J.removeEventListener('pointermove', move); J.removeEventListener('pointerup', up); J.removeEventListener('pointercancel', up) }
  }, [])

  const zoom = (d: number) => { const map = mapRef.current?.getMap(); if (map) map.easeTo({ zoom: map.getZoom() + d, duration: 250 }) }
  const recenter = () => { const p = pos.current, map = mapRef.current?.getMap(); follow.current = true; if (p && map) map.easeTo({ center: [p.lng, p.lat], duration: 400 }) }
  const roomsHere = near ? lobby.rooms.filter((r) => r.court_id === near.id).length : 0
  const myName = user ? firstName(user) : tj.map.you

  return (
    <div className="absolute inset-0">
      <Map
        {...MAPBOX_MAP_PROPS}
        ref={mapRef}
        mapboxAccessToken={MAPBOX_ACCESS_TOKEN}
        initialViewState={{ longitude: start.lng, latitude: start.lat, zoom: 15.5 }}
        minZoom={11}
        maxZoom={19}
        mapStyle={mapStyleForTheme(true)}
        onLoad={() => setReady(true)}
        onDragStart={() => { follow.current = false }}
        onClick={(e) => { target.current = { lat: e.lngLat.lat, lng: e.lngLat.lng }; follow.current = true }}
        dragRotate={false}
        pitchWithRotate={false}
        attributionControl={false}
        logoPosition="bottom-right"
        style={{ width: '100%', height: '100%' }}
      >
        {courts.map((c) => {
          const rooms = lobby.rooms.filter((r) => r.court_id === c.id).length
          return (
            <Marker key={c.id} longitude={c.longitude} latitude={c.latitude} anchor="bottom" onClick={(e) => { e.originalEvent.stopPropagation(); target.current = { lat: c.latitude - 0.0002, lng: c.longitude }; follow.current = true }}>
              <div className="grid cursor-pointer justify-items-center">
                <span className="grid size-11 place-items-center rounded-full border-[3px] border-brand bg-[#0d1117] text-brand shadow-[0_0_0_6px_rgba(255,90,31,.22)]">
                  <SportIcon slug="basketball" className="size-6" />
                </span>
                <span className="h-3 w-1 bg-brand" />
                <span className="display mt-0.5 max-w-36 truncate rounded-md bg-black/75 px-1.5 text-xs font-extrabold uppercase text-white">{c.name}</span>
                <span className="text-[10px] font-bold text-live [text-shadow:0_1px_2px_#000]">{tj.map.here.replace('{n}', String(c.player_count))}</span>
                {rooms > 0 && <span className="text-[10px] font-bold text-[var(--gold)] [text-shadow:0_1px_2px_#000]">{rooms > 1 ? tj.map.matches.replace('{n}', String(rooms)) : tj.map.match}</span>}
              </div>
            </Marker>
          )
        })}
        {lobby.players.filter((p) => p.on_map).map((p) => {
          const g = friendsQ.data?.find((f) => f.user.id.toLowerCase() === p.user_id)
          return (
            <Marker key={p.user_id} longitude={p.lng} latitude={p.lat} anchor="center">
              <div className="grid justify-items-center gap-0.5 transition-transform">
                <span className="rounded-full ring-[3px] ring-live">{g ? <Avatar user={g.user} size={34} /> : <span className="block size-[34px] rounded-full bg-surface-2" />}</span>
                <span className="display rounded-md bg-[#062e16]/90 px-1.5 text-[11px] font-extrabold uppercase text-white">{g ? firstName(g.user) : '…'}{p.room ? ` · ${tj.map.inMatch}` : ''}</span>
              </div>
            </Marker>
          )
        })}
        <Marker ref={meMarker} longitude={start.lng} latitude={start.lat} anchor="center">
          <div className="grid justify-items-center gap-0.5">
            <span className="rounded-full ring-[3px] ring-brand shadow-[0_0_0_8px_rgba(255,90,31,.25)]">{user ? <Avatar user={user} size={44} /> : <span className="block size-11 rounded-full bg-brand" />}</span>
            <span className="display rounded-md bg-black/80 px-1.5 text-[11px] font-extrabold uppercase text-white">{tj.map.you} · {tj.map.level.replace('{n}', String(me?.level ?? 1))}</span>
          </div>
        </Marker>
      </Map>

      <p className="pointer-events-none absolute inset-x-3 top-2 flex items-center gap-1.5 rounded-xl bg-bg/80 px-3 py-1.5 text-xs text-ink-2">
        <ShieldCheck className="size-3.5 shrink-0 text-live" aria-hidden />
        {tj.map.privacy}
      </p>
      <div className="absolute right-3 top-14 grid gap-1.5">
        <button type="button" onClick={() => zoom(1)} aria-label={tj.map.zoomIn} className="grid size-11 place-items-center rounded-xl border border-line bg-surface text-ink shadow-lg"><Plus className="size-5" aria-hidden /></button>
        <button type="button" onClick={() => zoom(-1)} aria-label={tj.map.zoomOut} className="grid size-11 place-items-center rounded-xl border border-line bg-surface text-ink shadow-lg"><Minus className="size-5" aria-hidden /></button>
        <button type="button" onClick={recenter} aria-label={tj.map.recenter} className="grid size-11 place-items-center rounded-xl border border-line bg-surface text-brand shadow-lg"><LocateFixed className="size-5" aria-hidden /></button>
      </div>
      {!courtsQ.isLoading && courts.length === 0 && <p className="absolute inset-x-6 top-1/3 rounded-2xl bg-surface p-4 text-center text-sm text-ink-2">{tj.map.noCourts}</p>}
      <div ref={joyRef} className="absolute bottom-5 left-5 grid size-24 touch-none place-items-center rounded-full border-2 border-white/15 bg-black/30 backdrop-blur" role="application" aria-label={tj.map.joystick}>
        <span ref={knobRef} className="size-11 rounded-full bg-white/75 shadow-lg transition-transform duration-75" />
      </div>
      {near ? (
        <div className="jeu-pop absolute inset-x-3 bottom-3 ml-28 grid gap-2 rounded-2xl border border-brand bg-surface p-3 shadow-2xl">
          <b className="display text-xl font-black uppercase leading-none">{near.name}</b>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-2">
            <span className="inline-flex items-center gap-1"><Users className="size-3.5" aria-hidden />{tj.map.here.replace('{n}', String(near.player_count))}</span>
            {roomsHere > 0 && <span className="inline-flex items-center gap-1 text-[var(--gold)]"><Globe className="size-3.5" aria-hidden />{roomsHere > 1 ? tj.map.matches.replace('{n}', String(roomsHere)) : tj.map.match}</span>}
          </span>
          <Button onClick={() => navigate(`/jeu/arene/${near.id}`)}>{tj.map.enter}</Button>
        </div>
      ) : (
        <p className="pointer-events-none absolute bottom-8 left-32 right-3 rounded-xl bg-bg/80 px-3 py-2 text-xs text-ink-2">{tj.map.hintReal.replace('{name}', myName)}</p>
      )}
    </div>
  )
}
