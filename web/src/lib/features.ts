/**
 * Mode Jeu is built but not launched: its buttons (map, court page, profile,
 * game result) only show when the web app is built with VITE_GAME_MODE=on.
 * The /jeu pages stay reachable by their address for testing.
 */
export const GAME_MODE_ENABLED = import.meta.env.VITE_GAME_MODE === 'on'
