import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Share2 } from 'lucide-react'
import { gameShareUrl } from '../lib/gameShare'
import { Button } from './ui'

type Props = {
  gameId: string
  title: string
  variant?: 'secondary' | 'ghost'
  className?: string
  /** Shorter label for compact headers */
  compact?: boolean
}

export function ShareGameButton({ gameId, title, variant = 'secondary', className, compact }: Props) {
  const [copied, setCopied] = useState(false)
  const share = useMutation({
    mutationFn: async () => {
      const url = gameShareUrl(gameId)
      const shareTitle = `${title} · Find the Game`
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({ title: shareTitle, text: title, url })
          return
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') return
        }
      }
      await navigator.clipboard.writeText(url)
    },
    onSuccess: () => {
      if (typeof navigator.share !== 'function') {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2500)
      }
    },
  })

  const label = copied ? 'Link copied!' : compact ? 'Share' : 'Share game'

  return (
    <Button
      type="button"
      variant={variant}
      className={className}
      loading={share.isPending}
      onClick={() => share.mutate()}
    >
      <Share2 className="size-4 shrink-0" aria-hidden />
      {label}
    </Button>
  )
}
