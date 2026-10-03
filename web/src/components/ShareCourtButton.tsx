import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Share2 } from 'lucide-react'
import { courtShareUrl } from '../lib/courtShare'
import { Button } from './ui'

type Props = {
  courtId: string
  courtName: string
  variant?: 'secondary' | 'ghost'
  className?: string
}

export function ShareCourtButton({ courtId, courtName, variant = 'secondary', className }: Props) {
  const [copied, setCopied] = useState(false)
  const share = useMutation({
    mutationFn: async () => {
      const url = courtShareUrl(courtId)
      const title = `${courtName} · Find the Game`
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({ title, text: courtName, url })
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

  return (
    <Button
      type="button"
      variant={variant}
      className={className}
      loading={share.isPending}
      onClick={() => share.mutate()}
    >
      <Share2 className="size-4 shrink-0" aria-hidden />
      {copied ? 'Link copied!' : 'Share court'}
    </Button>
  )
}
