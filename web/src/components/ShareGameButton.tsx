import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Share2 } from 'lucide-react'
import { createGameShareUrl } from '../lib/gameShare'
import { Button } from './ui'
import { useLocale } from '../i18n/LocaleProvider'

type Props = {
  gameId: string
  title: string
  variant?: 'secondary' | 'ghost'
  className?: string
  /** Shorter label for compact headers */
  compact?: boolean
}

export function ShareGameButton({ gameId, title, variant = 'secondary', className, compact }: Props) {
  const { t } = useLocale()
  const [copied, setCopied] = useState(false)
  const [launches, setLaunches] = useState(0)
  const share = useMutation({
    mutationFn: async () => {
      const url = await createGameShareUrl(gameId)
      const shareTitle = `${title} · Out For Ground`
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

  const label = copied ? t.games.share.copied : compact ? t.games.share.short : t.games.share.long

  return (
    <Button
      type="button"
      variant={variant}
      className={`${copied ? 'ftg-copied' : ''} ${className ?? ''}`}
      loading={share.isPending}
      onClick={() => {
        setLaunches((n) => n + 1)
        share.mutate()
      }}
    >
      <Share2 key={launches} className={`size-4 shrink-0 ${launches ? 'ftg-share-launch' : ''}`} aria-hidden />
      <span key={String(copied)} className={launches ? 'ftg-swap' : undefined}>
        {label}
      </span>
    </Button>
  )
}
