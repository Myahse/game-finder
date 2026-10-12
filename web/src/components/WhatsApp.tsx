import { useState } from 'react'
import { useLocale } from '../i18n/LocaleProvider'
import { createGameShareUrl } from '../lib/gameShare'
import { WHATSAPP_COMMUNITY_URL, whatsappShareUrl } from '../lib/whatsapp'
import { Spinner } from './ui'

/** The WhatsApp glyph (speech bubble with a phone), drawn as an icon. */
export function WhatsAppIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M12 2.2a9.8 9.8 0 0 0-8.4 14.8L2.2 21.8l4.9-1.3A9.8 9.8 0 1 0 12 2.2Zm0 1.8a8 8 0 1 1-4.1 14.9l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 0 1 12 4Z" />
      <path d="M9 7.4c-.2-.4-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.3.3-1 .9-1 2.2s1 2.6 1.1 2.8c.1.2 2 3.1 4.9 4.3 2.4 1 2.9.8 3.4.7.5 0 1.7-.7 1.9-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.4l-1.8-.9c-.3-.1-.5-.1-.7.2l-.8 1c-.2.2-.3.2-.6.1-.3-.1-1.1-.4-2.1-1.3-.8-.7-1.3-1.5-1.4-1.8-.2-.3 0-.4.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5L9 7.4Z" />
    </svg>
  )
}

/** Card that opens the Out For Ground community in the WhatsApp app. */
export function WhatsAppCommunityCard({ className = '' }: { className?: string }) {
  const { t } = useLocale()
  return (
    <a
      href={WHATSAPP_COMMUNITY_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`ftg-press flex items-center gap-3 rounded-2xl border border-[#1fa855]/40 bg-[#1fa855]/10 p-3.5 ${className}`}
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#1fa855] text-white">
        <WhatsAppIcon className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <b className="display block text-lg font-extrabold uppercase leading-tight">{t.whatsapp.communityTitle}</b>
        <span className="text-sm text-ink-2">{t.whatsapp.communityBody}</span>
      </span>
      <span className="display shrink-0 rounded-full bg-[#1fa855] px-3 py-1.5 text-sm font-bold uppercase text-white">{t.whatsapp.join}</span>
    </a>
  )
}

/** Posts a game in the WhatsApp community: opens WhatsApp with the game's link ready to send. */
export function PostGameToWhatsApp({ gameId, title }: { gameId: string; title: string }) {
  const { t } = useLocale()
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        try {
          const url = await createGameShareUrl(gameId)
          // A navigation (not a popup) so phones open the WhatsApp app after the await.
          window.location.href = whatsappShareUrl(`${t.whatsapp.postGameText.replace('{title}', title)} ${url}`)
        } finally {
          setBusy(false)
        }
      }}
      className="display ftg-press inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1fa855] px-4 text-lg font-bold text-white disabled:opacity-60"
    >
      {busy ? <Spinner /> : <WhatsAppIcon className="size-5" />}
      {t.whatsapp.postGame}
    </button>
  )
}
