/**
 * Welcome-screen photos, self-hosted in `public/sports` (from Wikimedia Commons).
 * Only public-domain / CC0 images are used here so no on-screen credit is required —
 * check the licence before swapping one in. Sources kept for reference:
 * - basketball: File:Secondary_Schools_basketball_games.jpg (CC0)
 * - football:   File:US,_Kenya_unite_for_football_match,_strengthen_partnership_(8910112).jpg (public domain, US Gov)
 * - volleyball: File:Outdoor_volleyball_game_at_Teslim_Balogun_stadium_01.jpg (CC0)
 * - badminton:  File:Schools_badminton_in_Lugogo023.jpg (CC0)
 */
export const sportPhotos = [
  { slug: 'basketball', position: '35% 50%' },
  { slug: 'football', position: '55% 50%' },
  { slug: 'volleyball', position: '50% 40%' },
  { slug: 'badminton', position: '60% 50%' },
] as const
