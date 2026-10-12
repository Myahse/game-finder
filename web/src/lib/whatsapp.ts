/** The Out For Ground community on WhatsApp (opens the WhatsApp app). */
export const WHATSAPP_COMMUNITY_URL = 'https://chat.whatsapp.com/Dh8jlG6IWXi4UPgfnb8Kti'

/** Opens WhatsApp with a message ready to send to a chat or group of the player's choice. */
export function whatsappShareUrl(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}
