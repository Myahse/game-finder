/**
 * Zero-setup demo: rigged human GLB from the Three.js examples (MIT-licensed project;
 * use only until you add your own files under public/avatar/).
 */
export const DEMO_CHARACTER_GLB =
  import.meta.env.VITE_AVATAR_DEMO_GLB ??
  'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r174/examples/models/gltf/Michelle.glb'

/** Off = never use remote demo (production). On by default in dev. */
export function demoGlbEnabled(): boolean {
  if (import.meta.env.VITE_AVATAR_DEMO === '0') return false
  if (import.meta.env.VITE_AVATAR_DEMO === '1') return true
  return import.meta.env.DEV
}
