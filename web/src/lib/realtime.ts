import { useEffect, useRef, useState } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { accessToken, API_URL } from './api'
import { qk } from './queries'
import type { Court, CourtDetail, Game, RealtimeEvent } from './types'

type Notify = (e: Extract<RealtimeEvent, { type: 'notification' }>) => void

/**
 * One WebSocket per tab. Applies court stats straight into cached court
 * lists (so markers recolour instantly) and invalidates the rest.
 */
export function useRealtime(userId: string | null, onNotification: Notify) {
  const qc = useQueryClient()
  const [connected, setConnected] = useState(false)
  const notifyRef = useRef(onNotification)
  useEffect(() => {
    notifyRef.current = onNotification
  })

  useEffect(() => {
    let ws: WebSocket | null = null
    let closed = false
    let retry = 1000
    let timer: ReturnType<typeof setTimeout>

    const connect = async () => {
      const token = userId ? await accessToken() : null
      if (closed) return
      const url = `${API_URL.replace(/^http/, 'ws')}/api/ws${token ? `?token=${encodeURIComponent(token)}` : ''}`
      ws = new WebSocket(url)
      ws.onopen = () => {
        setConnected(true)
        retry = 1000
        // Catch up on anything missed while disconnected.
        qc.invalidateQueries({ queryKey: ['courts'] })
        qc.invalidateQueries({ queryKey: ['court'] })
        qc.invalidateQueries({ queryKey: ['game'] })
      }
      ws.onmessage = (m) => {
        try {
          apply(qc, JSON.parse(m.data as string) as RealtimeEvent, notifyRef.current)
        } catch {
          // ignore malformed frames
        }
      }
      ws.onclose = () => {
        setConnected(false)
        if (closed) return
        timer = setTimeout(connect, retry)
        retry = Math.min(retry * 2, 30_000)
      }
    }
    connect()
    return () => {
      closed = true
      clearTimeout(timer)
      ws?.close()
    }
  }, [qc, userId])

  return connected
}

export function apply(qc: QueryClient, ev: RealtimeEvent, notify: Notify) {
  switch (ev.type) {
    case 'court_stats': {
      const patch = {
        player_count: ev.player_count,
        active_game_count: ev.active_game_count,
        activity: ev.activity,
        last_activity_at: ev.last_activity_at,
      }
      qc.setQueriesData<Court[]>({ queryKey: ['courts'] }, (list) =>
        list?.map((c) => (c.id === ev.court_id ? { ...c, ...patch } : c)),
      )
      qc.setQueryData<CourtDetail>(qk.court(ev.court_id), (c) => (c ? { ...c, ...patch } : c))
      break
    }
    case 'game': {
      if (ev.player_count != null) {
        qc.setQueryData<Game>(qk.game(ev.game_id), (g) =>
          g
            ? {
                ...g,
                player_count: ev.player_count!,
                status: ev.status ?? g.status,
                max_players: ev.max_players ?? g.max_players,
                spots_left: Math.max((ev.max_players ?? g.max_players) - ev.player_count!, 0),
              }
            : g,
        )
      }
      qc.invalidateQueries({ queryKey: qk.game(ev.game_id) })
      qc.invalidateQueries({ queryKey: qk.court(ev.court_id) })
      qc.invalidateQueries({ queryKey: ['games-nearby'] })
      qc.invalidateQueries({ queryKey: qk.myGames })
      break
    }
    case 'notification':
      qc.invalidateQueries({ queryKey: qk.notifications })
      if (ev.notification_type === 'presence_check') qc.invalidateQueries({ queryKey: qk.presence })
      notify(ev)
      break
  }
}
