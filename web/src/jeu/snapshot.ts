// The match state the server sends about 20 times a second (it plays online
// matches itself), and how the phones read it. What arrives from the network is untrusted: every
// field is checked and clamped before it is drawn.
import { H, SPORTS, W, clamp, emptyStats, type Banner, type Choice, type FeedLine, type Fx, type Moment, type Sport, type Stats, type Tactics } from './engine'

export interface Snap {
  v: 1
  ro: [string, string, number][]
  s: [number, number]
  ph: string
  off: number
  po: number
  h: number
  sc: number
  hk: number
  b: [number, number, number, number]
  bm: string
  ps: [number, number] | null
  pl: number[][]
  fd: FeedLine[]
  bn: Banner | null
  fx: Fx[]
  cl: Record<string, string>
  mo: number
  aw: { k: number; q: number; t: number; o: Choice[]; who: string } | null
  fin: number
  end: Moment[] | null
  tm: { pace: string; focus: string; def: string; to: boolean }
  sp: number
  pause: boolean
  g: string
}

export interface ViewPlayer { id: string; name: string; num: number; team: 0 | 1; x: number; y: number; tx: number; ty: number; stam: number; st: Stats; fire: boolean; bob: number; jt: number; jd: number; jh: number; jz: number; pts: number }
export interface ClientView {
  sport: Sport
  P: ViewPlayer[]
  score: [number, number]
  phase: string
  off: 0 | 1
  poss: number
  handler: number
  shotClock: number
  hostIdx: number
  ball: { x: number; y: number; z: number; zb: number; mode: string }
  ballT: { x: number; y: number; z: number; zb: number }
  lane: [number, number] | null
  feed: FeedLine[]
  banner: Banner | null
  claims: Record<string, string>
  momentum: number
  aw: Snap['aw']
  finished: boolean
  moments: Moment[]
  fxSeen: number
  tactics: Tactics
  timeoutUsed: boolean
  speed: number
  paused: boolean
}

const n = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const int = (v: unknown, lo: number, hi: number, d = lo) => clamp(Math.round(n(v, d)), lo, hi)
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')
const KEY = /^[a-zA-Z]{1,16}$/

function feedLine(v: unknown): FeedLine | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  if (typeof o.k !== 'string' || !KEY.test(o.k)) return null
  const line: FeedLine = { k: o.k }
  if (Array.isArray(o.p)) line.p = o.p.slice(0, 3).map((x) => int(x, 0, 5))
  if (Array.isArray(o.s)) line.s = [int(o.s[0], 0, 99), int(o.s[1], 0, 99)]
  if (o.team === 0 || o.team === 1) line.team = o.team
  if (o.n !== undefined) line.n = int(o.n, 0, 99)
  if (typeof o.v === 'string' && /^[a-z]{1,8}$/.test(o.v)) line.v = o.v
  return line
}

/** Reads a host snapshot into the view, keeping positions so they can glide. Returns the new effects. */
export function applySnap(prev: ClientView | null, raw: unknown): { view: ClientView; fx: Fx[]; newRoster: boolean } | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Partial<Snap>
  if (s.v !== 1 || !Array.isArray(s.ro) || ![2, 4, 6].includes(s.ro.length) || !Array.isArray(s.pl) || s.pl.length !== s.ro.length) return null
  const half = s.ro.length / 2
  const ro = s.ro.map((r) => (Array.isArray(r) ? [str(r[0], 64), str(r[1], 24) || '?', int(r[2], 0, 99)] as const : null))
  if (ro.some((r) => !r || !r[0])) return null
  const newRoster = !prev || prev.P.some((p, i) => p.id !== ro[i]![0])
  const P: ViewPlayer[] = ro.map((r, i) => {
    const old = newRoster ? null : prev!.P[i]
    const a = Array.isArray(s.pl![i]) ? (s.pl![i] as unknown[]) : []
    const tx = clamp(n(a[0], 185), -20, W + 20), ty = clamp(n(a[1], 300), -20, H + 20)
    const st: Stats = { ...emptyStats(), pts: int(a[3], 0, 99), reb: int(a[4], 0, 99), ast: int(a[5], 0, 99), stl: int(a[6], 0, 99), blk: int(a[7], 0, 99), fgm: int(a[8], 0, 99), fga: int(a[9], 0, 99), tpm: int(a[11], 0, 99), tpa: int(a[12], 0, 99), to: int(a[13], 0, 99) }
    return { id: r![0], name: r![1], num: r![2], team: i < half ? 0 : 1, x: old ? old.x : tx, y: old ? old.y : ty, tx, ty, stam: clamp(n(a[2], 100) / 100, 0, 1), st, pts: st.pts, fire: !!a[10], bob: old?.bob ?? i, jt: old?.jt ?? 0, jd: old?.jd ?? 0.4, jh: old?.jh ?? 12, jz: old?.jz ?? 0 }
  })
  const b = Array.isArray(s.b) ? s.b : []
  const ballT = { x: clamp(n(b[0], 185), -20, W + 20), y: clamp(n(b[1], 300), -20, H + 20), z: clamp(n(b[2]), 0, 140), zb: clamp(n(b[3]), 0, 60) }
  const fxIn = Array.isArray(s.fx) ? s.fx.filter((f): f is Fx => Array.isArray(f) && Number.isFinite(f[0]) && typeof f[1] === 'string' && /^[a-z]{2,4}$/.test(f[1])).map((f) => [n(f[0]), f[1], int(f[2], 0, 5), n(f[3]), n(f[4]), int(f[5], 0, 5)] as Fx) : []
  const seen = prev && !newRoster ? prev.fxSeen : fxIn.reduce((m, f) => Math.max(m, f[0]), 0)
  const fresh = prev && !newRoster ? fxIn.filter((f) => f[0] > seen) : []
  const cl: Record<string, string> = {}
  if (s.cl && typeof s.cl === 'object') for (const [k, v] of Object.entries(s.cl)) if (/^[0-5]$/.test(k) && typeof v === 'string') cl[k] = v.slice(0, 64)
  let bn: Banner | null = null
  if (s.bn && typeof s.bn === 'object' && typeof s.bn.k === 'string' && KEY.test(s.bn.k)) {
    bn = { k: s.bn.k, n: n(s.bn.n), ms: clamp(n(s.bn.ms, 1100), 300, 3000) }
    if (s.bn.p !== undefined) bn.p = int(s.bn.p, 0, 5)
    if (s.bn.team === 0 || s.bn.team === 1) bn.team = s.bn.team
    if (Array.isArray(s.bn.s)) bn.s = [int(s.bn.s[0], 0, 99), int(s.bn.s[1], 0, 99)]
  }
  let aw: Snap['aw'] = null
  if (s.aw && typeof s.aw === 'object' && Number.isFinite(s.aw.q)) {
    const o = Array.isArray(s.aw.o) ? s.aw.o.slice(0, 4).filter((c): c is Choice => Array.isArray(c) && ['s', 'd', 'p'].includes(c[0] as string)).map((c) => [c[0], int(c[1], -1, 5, -1), int(c[2], 0, 100), int(c[3], 0, 100)] as Choice) : []
    aw = { k: int(s.aw.k, 0, 5), q: n(s.aw.q), t: int(s.aw.t, 0, 30), who: str(s.aw.who, 64), o }
  }
  const view: ClientView = {
    sport: SPORTS.find((x) => x === s.g) ?? 'basketball',
    P,
    score: [int(s.s?.[0], 0, 99), int(s.s?.[1], 0, 99)],
    phase: str(s.ph, 12) || 'play',
    off: s.off === 1 ? 1 : 0,
    poss: int(s.po, 0, 999),
    handler: int(s.h, 0, 5),
    shotClock: n(s.sc, 80) / 10,
    hostIdx: int(s.hk, 0, 5),
    ball: prev && !newRoster ? { ...prev.ball, mode: str(s.bm, 8) } : { ...ballT, mode: str(s.bm, 8) },
    ballT,
    lane: Array.isArray(s.ps) ? [int(s.ps[0], 0, 5), int(s.ps[1], 0, 5)] : null,
    feed: Array.isArray(s.fd) ? s.fd.slice(0, 3).map(feedLine).filter((x): x is FeedLine => !!x) : [],
    banner: bn,
    claims: cl,
    momentum: clamp(n(s.mo, 50), 8, 92),
    aw,
    finished: s.fin === 1,
    moments: Array.isArray(s.end) ? s.end.slice(0, 40).map((m) => (m && typeof m === 'object' && typeof m.k === 'string' && KEY.test(m.k) ? { k: m.k, p: Array.isArray(m.p) ? m.p.slice(0, 3).map((x) => int(x, 0, 5)) : [], s: [int(m.s?.[0], 0, 99), int(m.s?.[1], 0, 99)] as [number, number], t: n(m.t) } : null)).filter((x): x is Moment => !!x) : [],
    fxSeen: Math.max(seen, ...fresh.map((f) => f[0])),
    tactics: {
      pace: (['fast', 'norm', 'slow'] as const).find((x) => x === s.tm?.pace) ?? 'norm',
      focus: (['out', 'bal', 'in'] as const).find((x) => x === s.tm?.focus) ?? 'bal',
      def: (['man', 'press'] as const).find((x) => x === s.tm?.def) ?? 'man',
    },
    timeoutUsed: s.tm?.to === true,
    speed: s.sp === 2 || s.sp === 4 ? s.sp : 1,
    paused: s.pause === true,
  }
  return { view, fx: fresh, newRoster }
}

/** Glide the drawn positions toward the last snapshot. */
export function glide(v: ClientView, dt: number) {
  const k = 1 - Math.exp(-dt * 14), kb = 1 - Math.exp(-dt * 24)
  for (const p of v.P) {
    const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy)
    if (d > 160) { p.x = p.tx; p.y = p.ty } else { p.x += dx * k; p.y += dy * k }
    p.bob += dt * (d > 1.5 ? 14 : 4)
  }
  const b = v.ball, t = v.ballT
  if (Math.hypot(t.x - b.x, t.y - b.y) > 200) Object.assign(b, t)
  else { b.x += (t.x - b.x) * kb; b.y += (t.y - b.y) * kb; b.z += (t.z - b.z) * kb; b.zb += (t.zb - b.zb) * kb }
}

/** An online match before kick-off: who sits where, who is ready, who is online. */
export interface RoomLobby { sport: Sport; size: number; slots: string[]; ready: string[]; online: string[]; startIn: number | null; host: string; court: string }
export function parseRoom(raw: unknown): RoomLobby | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const size = o.size === 1 || o.size === 2 || o.size === 3 ? o.size : 0
  if (!size || !Array.isArray(o.slots) || o.slots.length !== size * 2) return null
  const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((x) => x.slice(0, 64).toLowerCase()).slice(0, 12) : [])
  return {
    sport: SPORTS.find((x) => x === o.sport) ?? 'basketball',
    size,
    slots: o.slots.map((x) => (typeof x === 'string' ? x.slice(0, 64).toLowerCase() : '')),
    ready: ids(o.ready),
    online: ids(o.online),
    startIn: typeof o.start_in === 'number' && Number.isFinite(o.start_in) ? clamp(Math.ceil(o.start_in), 0, 9) : null,
    host: typeof o.host_id === 'string' ? o.host_id.toLowerCase() : '',
    court: typeof o.court_id === 'string' ? o.court_id : '',
  }
}
