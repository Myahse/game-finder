import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Globe, ShieldCheck } from 'lucide-react'
import { useLocale } from '../../i18n/LocaleProvider'
import { useAuth } from '../../lib/auth'
import { useLocation as useGeo } from '../../lib/location'
import { useCourtsNearby } from '../../lib/queries'
import type { Court } from '../../lib/types'
import { Button } from '../../components/ui'
import { firstName, headImage, useGamePlayers, useJeuMe } from '../../jeu/data'
import { useJeuSocket, useLobby } from './JeuLayout'

// The game world is the real map around the player, 1 px ≈ 3 m. The avatar
// starts on the nearest court, so friends only ever see a game position.
const M_PER_PX = 3
const SPEED = 170
const REDUCE = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

type Proj = { lat0: number; lng0: number; kx: number; ky: number }
const toPx = (p: Proj, lat: number, lng: number) => ({ x: (lng - p.lng0) * p.kx, y: (p.lat0 - lat) * p.ky })
const toGeo = (p: Proj, x: number, y: number) => ({ lat: p.lat0 - y / p.ky, lng: p.lng0 + x / p.kx })
let lastSpot: { lat: number; lng: number } | null = null

export function JeuMapPage() {
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
  const [near, setNear] = useState<Court | null>(null)

  const cvRef = useRef<HTMLCanvasElement>(null)
  const joyRef = useRef<HTMLDivElement>(null)
  const knobRef = useRef<HTMLSpanElement>(null)
  const live = useRef({ courts, lobby, friends: friendsQ.data ?? [], user, level: me?.level ?? 1 })
  live.current = { courts, lobby, friends: friendsQ.data ?? [], user, level: me?.level ?? 1 }

  // World origin: the device's area; spawn: where the avatar was, else the nearest court.
  const proj = useMemo<Proj>(() => {
    const lat0 = center.latitude, lng0 = center.longitude
    return { lat0, lng0, kx: (111_320 * Math.cos((lat0 * Math.PI) / 180)) / M_PER_PX, ky: 110_540 / M_PER_PX }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.round(center.latitude * 50), Math.round(center.longitude * 50)])

  useEffect(() => {
    const cv = cvRef.current, J = joyRef.current, K = knobRef.current
    if (!cv || !J || !K) return
    const g = cv.getContext('2d')!
    const spawnCourt = live.current.courts[0]
    const spawn = lastSpot ?? (spawnCourt ? { lat: spawnCourt.latitude - 0.0004, lng: spawnCourt.longitude } : { lat: proj.lat0, lng: proj.lng0 })
    const me = { ...toPx(proj, spawn.lat, spawn.lng), step: 0, moving: false, was: false }
    const ghosts = new Map<string, { x: number; y: number; step: number; moving: boolean }>()
    let target: { x: number; y: number } | null = null
    let joy = { x: 0, y: 0 }
    let raf = 0, last = 0, t = 0, R = cv.getBoundingClientRect(), nearId: string | null = null
    const size = () => { R = cv.getBoundingClientRect(); const d = Math.min(2, window.devicePixelRatio || 1); cv.width = R.width * d; cv.height = R.height * d; g.setTransform(d, 0, 0, d, 0, 0) }
    size()
    const cam = () => ({ x: me.x - R.width / 2, y: me.y - R.height * 0.55 })
    socket.setPosition(spawn.lat, spawn.lng, 'map')

    const hash = (x: number, y: number) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295 }
    const ball = (x: number, y: number, r: number) => {
      g.fillStyle = '#ff5a1f'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill()
      g.strokeStyle = '#3d1200'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x - r, y); g.lineTo(x + r, y); g.moveTo(x, y - r); g.lineTo(x, y + r)
      g.moveTo(x - r * 0.7, y - r * 0.7); g.quadraticCurveTo(x - r * 0.2, y, x - r * 0.7, y + r * 0.7); g.moveTo(x + r * 0.7, y - r * 0.7); g.quadraticCurveTo(x + r * 0.2, y, x + r * 0.7, y + r * 0.7); g.stroke()
    }
    const avatar = (x: number, y: number, img: HTMLImageElement | null, ring: string, r: number, label: string, initial: string, bob = 0, live2 = false) => {
      g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(x, y + r + 4, r * 0.9, r * 0.3, 0, 0, Math.PI * 2); g.fill()
      if (live2) { g.strokeStyle = 'rgba(34,197,94,.55)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y - bob, r + 6 + Math.sin(t * 5) * 1.5, 0, Math.PI * 2); g.stroke() }
      g.save(); g.beginPath(); g.arc(x, y - bob, r, 0, Math.PI * 2); g.clip(); g.fillStyle = '#1d2430'; g.fill()
      if (img && img.complete && img.naturalWidth) g.drawImage(img, x - r, y - r - bob, r * 2, r * 2)
      else { g.fillStyle = '#fff'; g.font = `900 ${Math.round(r)}px "Barlow Condensed", sans-serif`; g.textAlign = 'center'; g.fillText(initial, x, y - bob + r * 0.35) }
      g.restore()
      g.strokeStyle = ring; g.lineWidth = 3; g.beginPath(); g.arc(x, y - bob, r, 0, Math.PI * 2); g.stroke()
      g.font = '800 11px "Barlow Condensed", sans-serif'; g.textAlign = 'center'
      const w = g.measureText(label).width + 10
      g.fillStyle = live2 ? 'rgba(6,46,22,.9)' : 'rgba(13,17,23,.85)'; g.beginPath(); g.roundRect(x - w / 2, y + r + 8, w, 16, 8); g.fill()
      g.fillStyle = '#fff'; g.fillText(label, x, y + r + 20)
    }

    const draw = (dt: number) => {
      t += dt
      const L = live.current
      let vx = joy.x, vy = joy.y
      if (!vx && !vy && target) { const dx = target.x - me.x, dy = target.y - me.y, d = Math.hypot(dx, dy); if (d < 6) target = null; else { vx = dx / d; vy = dy / d } }
      me.moving = !!(vx || vy)
      if (me.moving) {
        me.x += vx * SPEED * dt; me.y += vy * SPEED * dt; me.step += dt * 12
        const geo = toGeo(proj, me.x, me.y); lastSpot = geo; socket.setPosition(geo.lat, geo.lng, 'map')
      }
      me.was = me.moving
      // friends, smoothed toward their last position
      const seen = new Set<string>()
      for (const p of L.lobby.players) {
        if (!p.on_map) continue
        const pt = toPx(proj, p.lat, p.lng); seen.add(p.user_id)
        const gh = ghosts.get(p.user_id) ?? { ...pt, step: 0, moving: false }
        const k = 1 - Math.exp(-dt * 10), dx = pt.x - gh.x, dy = pt.y - gh.y
        gh.x += dx * k; gh.y += dy * k; gh.moving = Math.hypot(dx, dy) > 2; if (gh.moving) gh.step += dt * 12
        ghosts.set(p.user_id, gh)
      }
      for (const id of [...ghosts.keys()]) if (!seen.has(id)) ghosts.delete(id)

      const c = cam()
      g.clearRect(0, 0, R.width, R.height)
      g.save(); g.translate(-c.x, -c.y)
      // the city, generated block by block around the camera
      g.fillStyle = '#121821'; g.fillRect(c.x, c.y, R.width, R.height)
      const B = 110
      for (let bx = Math.floor(c.x / B) - 1; bx <= Math.floor((c.x + R.width) / B) + 1; bx++) {
        for (let by = Math.floor(c.y / B) - 1; by <= Math.floor((c.y + R.height) / B) + 1; by++) {
          const h = hash(bx, by)
          if (h < 0.08) { g.fillStyle = '#16301f'; g.beginPath(); g.roundRect(bx * B + 8, by * B + 8, B - 16, B - 16, 26); g.fill(); continue }
          if (h < 0.85) {
            g.fillStyle = h < 0.45 ? '#1a212c' : '#1c2430'; g.fillRect(bx * B + 14, by * B + 14, 82, 82)
            if (h > 0.6) { g.fillStyle = 'rgba(242,182,50,.16)'; for (let w = 0; w < 4; w++) g.fillRect(bx * B + 22 + w * 18, by * B + 30 + (w % 2) * 24, 6, 6) }
          }
        }
      }
      g.strokeStyle = '#273141'; g.lineWidth = 12
      for (let x = Math.floor(c.x / B) * B; x <= c.x + R.width + B; x += B) { g.beginPath(); g.moveTo(x, c.y - B); g.lineTo(x, c.y + R.height + B); g.stroke() }
      for (let y = Math.floor(c.y / B) * B; y <= c.y + R.height + B; y += B) { g.beginPath(); g.moveTo(c.x - B, y); g.lineTo(c.x + R.width + B, y); g.stroke() }
      if (target) { g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 2; g.beginPath(); g.arc(target.x, target.y, 10 + Math.sin(t * 6) * 2, 0, Math.PI * 2); g.stroke() }

      let nearest: Court | null = null, nd = 1e9
      for (const a of L.courts) {
        const p = toPx(proj, a.latitude, a.longitude)
        if (p.x < c.x - 200 || p.x > c.x + R.width + 200 || p.y < c.y - 200 || p.y > c.y + R.height + 200) continue
        const d = Math.hypot(p.x - me.x, p.y - me.y); if (d < 95 && d < nd) { nd = d; nearest = a }
        const pulse = REDUCE ? 0.5 : (Math.sin(t * 2.2 + p.x) + 1) / 2
        g.fillStyle = 'rgba(255,90,31,.13)'; g.beginPath(); g.arc(p.x, p.y, 60 + pulse * 14, 0, Math.PI * 2); g.fill()
        g.strokeStyle = '#ff5a1f'; g.globalAlpha = 0.5 + pulse * 0.3; g.lineWidth = 2; g.beginPath(); g.arc(p.x, p.y, 60 + pulse * 14, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1
        g.fillStyle = '#ff5a1f'; g.beginPath(); g.moveTo(p.x, p.y + 4); g.bezierCurveTo(p.x - 22, p.y - 18, p.x - 18, p.y - 48, p.x, p.y - 48); g.bezierCurveTo(p.x + 18, p.y - 48, p.x + 22, p.y - 18, p.x, p.y + 4); g.fill()
        g.fillStyle = '#0d1117'; g.beginPath(); g.arc(p.x, p.y - 30, 10, 0, Math.PI * 2); g.fill()
        ball(p.x, p.y - 30, 7)
        g.font = '900 14px "Barlow Condensed", sans-serif'; g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(a.name.toUpperCase().slice(0, 28), p.x, p.y + 24)
        g.font = '700 11px Inter, sans-serif'; g.fillStyle = '#22c55e'; g.fillText(tj.map.here.replace('{n}', String(a.player_count)), p.x, p.y + 40)
        const rooms = L.lobby.rooms.filter((r) => r.court_id === a.id).length
        if (rooms) { g.fillStyle = '#f2b632'; g.fillText(rooms > 1 ? tj.map.matches.replace('{n}', String(rooms)) : tj.map.match, p.x, p.y + 56) }
      }
      if ((nearest?.id ?? null) !== nearId) { nearId = nearest?.id ?? null; setNear(nearest) }

      const items: { y: number; f: () => void }[] = []
      for (const [id, gh] of ghosts) {
        const gp = L.friends.find((f) => f.user.id === id), lp = L.lobby.players.find((p) => p.user_id === id)
        const name = gp ? firstName(gp.user) : '?'
        items.push({ y: gh.y, f: () => avatar(gh.x, gh.y, headImage(gp?.user), '#22c55e', 21, `${name}${lp?.room ? ' · ' + tj.map.inMatch : ''}`, name[0] ?? '?', gh.moving ? Math.abs(Math.sin(gh.step)) * 5 : 0, true) })
      }
      items.push({ y: me.y, f: () => {
        const bob = me.moving ? Math.abs(Math.sin(me.step)) * 5 : REDUCE ? 0 : Math.sin(t * 3) * 1.5
        g.strokeStyle = 'rgba(255,90,31,.5)'; g.lineWidth = 3; g.beginPath(); g.ellipse(me.x, me.y + 26, 30 + Math.sin(t * 4) * 3, 10, 0, 0, Math.PI * 2); g.stroke()
        const nm = L.user ? firstName(L.user) : tj.map.you
        avatar(me.x, me.y, headImage(L.user), '#ff5a1f', 24, `${tj.map.you.toUpperCase()} · ${tj.map.level.replace('{n}', String(L.level))}`, nm[0] ?? '?', bob)
      } })
      items.sort((a, b) => a.y - b.y).forEach((o) => o.f())
      g.restore()
    }
    const loop = (now: number) => { const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now; draw(dt); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)

    const mv = (e: PointerEvent) => { const r = J.getBoundingClientRect(); let dx = e.clientX - r.left - r.width / 2, dy = e.clientY - r.top - r.height / 2; const d = Math.hypot(dx, dy), m = 32; if (d > m) { dx = (dx / d) * m; dy = (dy / d) * m } K.style.transform = `translate(${dx}px,${dy}px)`; joy = { x: dx / m, y: dy / m }; target = null }
    const down = (e: PointerEvent) => { e.stopPropagation(); J.setPointerCapture(e.pointerId); mv(e) }
    const move = (e: PointerEvent) => { if (J.hasPointerCapture(e.pointerId)) mv(e) }
    const up = () => { joy = { x: 0, y: 0 }; K.style.transform = '' }
    const tap = (e: PointerEvent) => { const r = cv.getBoundingClientRect(), c = cam(); target = { x: e.clientX - r.left + c.x, y: e.clientY - r.top + c.y } }
    const keys = new Set<string>()
    const key = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase(); if (!['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'z', 'q', 's', 'd', 'w', 'a'].includes(k)) return
      if (e.type === 'keydown') keys.add(k); else keys.delete(k)
      const x = (keys.has('arrowright') || keys.has('d') ? 1 : 0) - (keys.has('arrowleft') || keys.has('q') || keys.has('a') ? 1 : 0)
      const y = (keys.has('arrowdown') || keys.has('s') ? 1 : 0) - (keys.has('arrowup') || keys.has('z') || keys.has('w') ? 1 : 0)
      const d = Math.hypot(x, y) || 1; joy = { x: x / d, y: y / d }; target = null
    }
    J.addEventListener('pointerdown', down); J.addEventListener('pointermove', move); J.addEventListener('pointerup', up); J.addEventListener('pointercancel', up)
    cv.addEventListener('pointerdown', tap)
    window.addEventListener('keydown', key); window.addEventListener('keyup', key)
    window.addEventListener('resize', size)
    return () => {
      cancelAnimationFrame(raf)
      J.removeEventListener('pointerdown', down); J.removeEventListener('pointermove', move); J.removeEventListener('pointerup', up); J.removeEventListener('pointercancel', up)
      cv.removeEventListener('pointerdown', tap)
      window.removeEventListener('keydown', key); window.removeEventListener('keyup', key)
      window.removeEventListener('resize', size)
    }
    // the drawing loop reads live data through `live`; it restarts only for a new world origin
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proj, socket, courts.length > 0])

  const roomsHere = near ? lobby.rooms.filter((r) => r.court_id === near.id).length : 0
  return (
    <div className="absolute inset-0">
      <canvas ref={cvRef} className="absolute inset-0 h-full w-full touch-none" aria-label={tj.nav.map} />
      <p className="pointer-events-none absolute inset-x-3 top-2 flex items-center gap-1.5 rounded-xl bg-bg/80 px-3 py-1.5 text-xs text-ink-2">
        <ShieldCheck className="size-3.5 shrink-0 text-live" aria-hidden />
        {tj.map.privacy}
      </p>
      {!courtsQ.isLoading && courts.length === 0 && (
        <p className="absolute inset-x-6 top-1/3 rounded-2xl bg-surface p-4 text-center text-sm text-ink-2">{tj.map.noCourts}</p>
      )}
      <div ref={joyRef} className="absolute bottom-5 left-5 grid size-24 touch-none place-items-center rounded-full border-2 border-white/15 bg-white/5" role="application" aria-label={tj.map.joystick}>
        <span ref={knobRef} className="size-11 rounded-full bg-white/70 shadow-lg transition-transform duration-75" />
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
        <p className="pointer-events-none absolute bottom-8 left-32 right-3 rounded-xl bg-bg/80 px-3 py-2 text-xs text-ink-2">{tj.map.hint}</p>
      )}
    </div>
  )
}
