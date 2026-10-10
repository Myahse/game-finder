import { useRef, type ComponentProps, type CSSProperties, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { GameCard } from './GameCard'
import { morphToGame } from '../lib/playMotion'
import '../styles/motion-play.css'

/**
 * A GameCard that grows into the game page when opened (View Transitions API where the browser
 * has it; a normal navigation otherwise). `morphIndex` plays the skeleton → card morph for a list
 * that just finished loading.
 */
export function PlayGameCard({ morphIndex, ...props }: ComponentProps<typeof GameCard> & { morphIndex?: number }) {
  const navigate = useNavigate()
  const wrap = useRef<HTMLDivElement>(null)

  const onClickCapture = (e: MouseEvent<HTMLDivElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const a = (e.target as Element).closest('a')
    const href = a?.getAttribute('href')
    if (!a || !href?.startsWith('/games/') || !wrap.current?.contains(a)) return
    // Stops the Link's own navigation; ours runs inside the view transition.
    if (morphToGame(a, () => void navigate(href))) e.preventDefault()
  }

  const morph = morphIndex != null
  return (
    <div
      ref={wrap}
      onClickCapture={onClickCapture}
      className={morph ? 'ftg-play-morph' : undefined}
      style={morph ? ({ '--ftg-play-i': morphIndex } as CSSProperties) : undefined}
    >
      <GameCard {...props} />
      {morph && (
        <span className="ftg-play-morph-sk" aria-hidden>
          <i />
          <span>
            <i />
            <i />
          </span>
        </span>
      )}
    </div>
  )
}

/** Loading rows shaped like game cards (sport block + two lines); they melt into the cards when data lands. */
export function GameCardSkeletons({ rows = 3, label }: { rows?: number; label: string }) {
  return (
    <div className="grid gap-2" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="ftg-play-skrow" aria-hidden>
          <div className="ftg-skeleton" />
          <div className="ftg-play-sklines">
            <div className="ftg-skeleton h-3.5" style={{ width: `${70 - i * 8}%` }} />
            <div className="ftg-skeleton h-3" style={{ width: `${48 - i * 5}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}
