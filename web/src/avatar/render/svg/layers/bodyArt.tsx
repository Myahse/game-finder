import type { PlayerAvatarConfig } from '../../../schema'
import { JERSEY_BY_TOP, SHORTS_COLOR, skinColors } from '../../../colors'
import { bodyMetrics } from '../proportions'

type BodyArtProps = {
  config: PlayerAvatarConfig
  uid: string
  skinGrad: string
  jerseyGrad: string
  shortsGrad: string
}

export function BodyArt({ config, uid, skinGrad, jerseyGrad, shortsGrad }: BodyArtProps) {
  const skin = skinColors(config.skinTone)
  const kit = JERSEY_BY_TOP[config.top] ?? JERSEY_BY_TOP.top_basketball_jersey
  const { arm, legLen, torsoLen } = bodyMetrics(config)

  return (
    <g>
      <g transform={`translate(0 ${(1 - legLen) * 36})`}>
        {/* Legs */}
        <path
          d="M162 352 C158 400 154 468 150 518 C158 522 166 520 170 512 L176 368 Z"
          fill={skinGrad}
        />
        <path
          d="M198 352 C202 400 206 468 210 518 C202 522 194 520 190 512 L184 368 Z"
          fill={skinGrad}
        />
        {/* Shorts */}
        <path
          d="M138 328 C138 306 156 294 180 294 C204 294 222 306 222 328 L218 388 C212 372 196 362 180 362 C164 362 148 372 142 388 Z"
          fill={shortsGrad}
        />
        <path d="M142 348 L218 348" stroke={SHORTS_COLOR.trim} strokeWidth="1.5" opacity="0.45" />
        <path d="M180 294 L180 362" stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
        {/* Basketball shoes */}
        <path
          d="M146 512 C142 528 154 542 170 544 L174 518 L152 518 Z"
          fill="#141414"
        />
        <path
          d="M214 512 C218 528 206 542 190 544 L186 518 L208 518 Z"
          fill="#141414"
        />
        <path d="M152 532 C162 538 174 538 182 532" stroke="#c1121f" strokeWidth="3" fill="none" opacity="0.85" />
        <path d="M178 532 C186 538 198 538 208 532" stroke="#c1121f" strokeWidth="3" fill="none" opacity="0.85" />
        <path d="M158 520 L168 520" stroke="#333" strokeWidth="2" />
        <path d="M192 520 L202 520" stroke="#333" strokeWidth="2" />
      </g>

      <g transform={`scale(1 ${torsoLen}) translate(0 ${(1 - torsoLen) * 72})`}>
        {/* Torso skin */}
        <path
          d="M150 196 C142 228 140 272 144 312 L216 312 C220 272 218 228 210 196 C202 186 158 186 150 196 Z"
          fill={skinGrad}
        />
        {/* Jersey */}
        <path
          d="M154 198 C146 226 144 266 148 300 L212 300 C216 266 214 226 206 198 C198 188 162 188 154 198 Z"
          fill={jerseyGrad}
        />
        <path d="M170 198 L180 224 L190 198" fill="none" stroke={kit.accent} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M148 252 L212 252" stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
        <path d="M156 210 L148 228 L152 238 L164 224 Z" fill={kit.trim} opacity="0.9" />
        <path d="M204 210 L212 228 L208 238 L196 224 Z" fill={kit.trim} opacity="0.9" />

        <g transform={`scale(${arm} ${arm}) translate(${180 * (1 - arm)} ${236 * (1 - arm)})`}>
          {/* Arms */}
          <path
            d="M150 208 C122 228 112 276 116 312 L130 310 C126 274 134 240 148 226 Z"
            fill={skinGrad}
          />
          <path
            d="M210 208 C238 228 248 276 244 312 L230 310 C234 274 226 240 212 226 Z"
            fill={skinGrad}
          />
          {/* Hands */}
          <path
            d="M116 312 C110 322 114 334 124 336 C132 334 134 326 130 310 Z"
            fill={skin.shadow}
          />
          <path
            d="M244 312 C250 322 246 334 236 336 C228 334 226 326 230 310 Z"
            fill={skin.shadow}
          />
        </g>

        {config.sportsEquipment === 'eq_basketball' && (
          <g transform="translate(104 284)">
            <circle r="28" fill={`url(#${uid}-ball)`} />
            <path d="M-28 0 C-12 -10 12 -10 28 0" stroke="#5c2e0a" strokeWidth="1.5" fill="none" opacity="0.55" />
            <path d="M0 -28 C10 -12 10 12 0 28" stroke="#5c2e0a" strokeWidth="1.5" fill="none" opacity="0.55" />
            <path d="M-20 20 C0 8 20 20 24 28" stroke="#5c2e0a" strokeWidth="1.2" fill="none" opacity="0.4" />
          </g>
        )}
      </g>

      {config.accessory === 'acc_wristbands' && (
        <>
          <rect x="112" y="302" width="20" height="9" rx="2" fill="#f8f9fa" />
          <rect x="228" y="302" width="20" height="9" rx="2" fill="#f8f9fa" />
        </>
      )}
    </g>
  )
}
