import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Gamepad2, Map as MapIcon, Swords, UserRound, X } from 'lucide-react'
import { useLocale } from '../../i18n/LocaleProvider'
import { JeuSocket } from '../../jeu/net'
import '../../styles/jeu.css'

const JeuCtx = createContext<JeuSocket | null>(null)
const FROM_KEY = 'ftg.jeu.from'

export function useJeuSocket() {
  const s = useContext(JeuCtx)
  if (!s) throw new Error('useJeuSocket must be used inside Mode Jeu')
  return s
}
export function useLobby() {
  const s = useJeuSocket()
  return useSyncExternalStore(s.subscribe, s.getLobby)
}
export function useJeuConnected() {
  const s = useJeuSocket()
  return useSyncExternalStore(s.subscribe, s.getConnected)
}

/** Where "Quit" goes: the app screen the player came from (saved on the way in). */
function useExitPath() {
  const loc = useLocation()
  const from = (loc.state as { from?: string } | null)?.from
  useEffect(() => {
    if (from && !from.startsWith('/jeu')) {
      try { sessionStorage.setItem(FROM_KEY, from) } catch { /* storage blocked */ }
    }
  }, [from])
  return () => {
    try { return sessionStorage.getItem(FROM_KEY) || '/' } catch { return '/' }
  }
}

/** Mode Jeu's own space: the app's tabs are hidden, "Quit" goes back to the app. */
export function JeuLayout() {
  const { t } = useLocale()
  const tj = t.jeu
  const navigate = useNavigate()
  const loc = useLocation()
  const exitPath = useExitPath()
  // One live connection for the whole Mode Jeu visit, opened here so a remount never keeps a closed one.
  const [socket, setSocket] = useState<JeuSocket | null>(null)
  useEffect(() => {
    const s = new JeuSocket()
    setSocket(s)
    return () => s.close()
  }, [])
  const inMatch = loc.pathname.startsWith('/jeu/match')
  if (!socket) return <div className="jeu fixed inset-0" />

  return (
    <JeuCtx.Provider value={socket}>
      <div className="jeu fixed inset-0 flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <header className="flex items-center gap-2 px-4 py-2.5">
          <Gamepad2 className="size-5 text-brand" aria-hidden />
          <span className="display text-xl font-black uppercase tracking-wide">{tj.title}</span>
          <LivePill />
          <button
            type="button"
            onClick={() => navigate(exitPath())}
            className="display ml-auto inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-extrabold uppercase"
          >
            <X className="size-4" aria-hidden />
            {tj.quit}
          </button>
        </header>
        <main className="relative min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
        {!inMatch && (
          <nav className="flex border-t border-line bg-surface/95" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            {[
              { to: '/jeu', end: true, label: tj.nav.map, icon: MapIcon },
              { to: '/jeu/arenes', end: false, label: tj.nav.arenas, icon: Swords },
              { to: '/jeu/avatar', end: false, label: tj.nav.avatar, icon: UserRound },
            ].map(({ to, end, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => `flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-semibold ${isActive ? 'text-brand' : 'text-ink-2'}`}
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </NavLink>
            ))}
          </nav>
        )}
      </div>
    </JeuCtx.Provider>
  )
}

function LivePill() {
  const { t } = useLocale()
  const connected = useJeuConnected()
  const lobby = useLobby()
  const n = lobby.players.length
  const label = !connected ? t.jeu.live.offline : n === 0 ? t.jeu.live.alone : n === 1 ? t.jeu.live.friend : t.jeu.live.friends.replace('{n}', String(n))
  return (
    <span className="display inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-extrabold uppercase">
      <i className={`size-2 rounded-full ${connected ? 'jeu-ping bg-live' : 'bg-ink-2'}`} aria-hidden />
      {label}
    </span>
  )
}
