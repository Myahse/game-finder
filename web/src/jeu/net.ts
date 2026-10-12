// Mode Jeu's live connection: friends on the game map, open online matches,
// and the messages of the match this phone is in. One socket while the player
// is in Mode Jeu; it reconnects by itself and rejoins the current match.
import { api, apiOrigin } from '../lib/api'

export interface LobbyPlayer { user_id: string; lat: number; lng: number; scene: string; room?: string; on_map: boolean }
export interface LobbyRoom { code: string; court_id: string; host_id: string; players: number; started: boolean }
export interface Lobby { players: LobbyPlayer[]; rooms: LobbyRoom[] }

export type RoomEvent =
  | { t: 'joined'; code: string; court_id: string; host_id: string; host: boolean; state: unknown }
  | { t: 'members'; code: string; members: string[]; host_online: boolean }
  | { t: 'state'; s: unknown }
  | { t: 'claim'; from: string; k: string | null }
  | { t: 'intent'; from: string; q: number; i: number }
  | { t: 'react'; from: string; e: string }
  | { t: 'host_left' }
  | { t: 'closed'; code: string; why: string }
  | { t: 'error'; code: string }

type Listener = (e: RoomEvent) => void

export class JeuSocket {
  lobby: Lobby = { players: [], rooms: [] }
  connected = false
  private ws: WebSocket | null = null
  private closed = false
  private retry = 1000
  private timer: ReturnType<typeof setTimeout> | undefined
  private room: string | null = null
  private pos: { lat: number; lng: number; scene: string } | null = null
  private lastPos = 0
  private posTimer: ReturnType<typeof setTimeout> | undefined
  private subs = new Set<() => void>()
  private listeners = new Set<Listener>()

  constructor() { void this.connect() }

  subscribe = (fn: () => void) => { this.subs.add(fn); return () => { this.subs.delete(fn) } }
  getLobby = () => this.lobby
  getConnected = () => this.connected
  onRoom(fn: Listener) { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  private emit() { for (const f of this.subs) f() }

  private async connect() {
    if (this.closed) return
    try {
      const { ticket } = await api<{ ticket: string }>('/api/me/ws-ticket', { method: 'POST' })
      if (this.closed) return
      const ws = new WebSocket(`${apiOrigin().replace(/^http/, 'ws')}/api/jeu/ws?ticket=${encodeURIComponent(ticket)}`)
      this.ws = ws
      ws.onopen = () => {
        this.connected = true; this.retry = 1000; this.emit()
        if (this.pos) this.raw({ t: 'pos', ...this.pos })
        if (this.room) this.raw({ t: 'join', code: this.room })
      }
      ws.onmessage = (m) => {
        let ev: { t?: string } & Record<string, unknown>
        try { ev = JSON.parse(String(m.data)) } catch { return }
        if (ev.t === 'lobby') {
          this.lobby = { players: Array.isArray(ev.players) ? (ev.players as LobbyPlayer[]) : [], rooms: Array.isArray(ev.rooms) ? (ev.rooms as LobbyRoom[]) : [] }
          this.emit()
        } else if (ev.t && ev.t !== 'hello') {
          if (ev.t === 'closed' || (ev.t === 'error' && ev.code === 'not_found')) this.room = null
          for (const f of this.listeners) f(ev as RoomEvent)
        }
      }
      ws.onerror = () => ws.close()
      ws.onclose = () => this.reconnect()
    } catch {
      this.reconnect()
    }
  }
  private reconnect() {
    this.connected = false; this.ws = null; this.emit()
    if (this.closed) return
    clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.connect(), this.retry)
    this.retry = Math.min(this.retry * 2, 20_000)
  }
  private raw(v: unknown) { if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(v)) }

  /** Where this player's avatar is on the game map (friends see it), at most 5 times a second. */
  setPosition(lat: number, lng: number, scene: string) {
    this.pos = { lat, lng, scene }
    const now = performance.now(), wait = 200 - (now - this.lastPos)
    clearTimeout(this.posTimer)
    if (wait <= 0) { this.lastPos = now; this.raw({ t: 'pos', ...this.pos }) }
    else this.posTimer = setTimeout(() => { this.lastPos = performance.now(); this.raw({ t: 'pos', ...this.pos }) }, wait)
  }
  hide() { this.pos = null; this.raw({ t: 'hide' }) }
  join(code: string) { this.room = code; this.raw({ t: 'join', code }) }
  leave() { this.room = null; this.raw({ t: 'leave' }) }
  sendState(s: unknown) { this.raw({ t: 'state', s }) }
  claim(k: string | null) { this.raw({ t: 'claim', k }) }
  intent(q: number, i: number) { this.raw({ t: 'intent', q, i }) }
  react(e: string) { this.raw({ t: 'react', e }) }

  close() { this.closed = true; clearTimeout(this.timer); clearTimeout(this.posTimer); this.ws?.close() }
}
