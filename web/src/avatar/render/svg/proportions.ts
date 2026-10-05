import type { PlayerAvatarConfig } from '../../schema'

/** Height adjusts legs/torso — not a uniform stretch. */
export function bodyMetrics(config: PlayerAvatarConfig) {
  const t = (config.height - 1.45) / (2.25 - 1.45)
  const body = config.bodyType
  const shoulder = body === 'slim' ? 0.94 : body === 'muscular' ? 1.08 : body === 'larger' ? 1.12 : body === 'average' ? 1 : 1.04
  const arm = body === 'slim' ? 0.92 : body === 'muscular' ? 1.1 : 1
  const legLen = 1 + t * 0.14
  const torsoLen = 1 + t * 0.04
  return { shoulder, arm, legLen, torsoLen, heightT: t }
}
