import type { PlayerAvatarConfig } from '../../../schema'
import { HAIR_HEX, skinColors } from '../../../colors'
import { bodyMetrics } from '../proportions'

/**
 * Single-scene reference hooper — one coordinate system, strict paint order.
 * Body transforms apply only below the neck (head never stretched).
 */
export function ReferenceHooperFigure({
  config,
  showBody,
  silhouette,
}: {
  config: PlayerAvatarConfig
  showBody: boolean
  silhouette?: boolean
}) {
  const skin = skinColors(config.skinTone)
  const hair = HAIR_HEX[config.hairColor] ?? HAIR_HEX.black
  const { legLen, torsoLen, shoulder } = bodyMetrics(config)
  const ink = silhouette ? '#101010' : null
  const s = (fill: string) => ink ?? fill
  const ball = config.sportsEquipment === 'eq_basketball'
  const bands = config.accessory === 'acc_wristbands'

  const pivotY = 200
  const bodyScale = `translate(180 ${pivotY}) scale(${shoulder} 1) translate(-180 -${pivotY})`

  return (
    <g>
      <defs>
        <linearGradient id="rh-skin" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor={skin.highlight} />
          <stop offset="55%" stopColor={skin.base} />
          <stop offset="100%" stopColor={skin.shadow} />
        </linearGradient>
        <linearGradient id="rh-jersey" x1="15%" y1="0%" x2="85%" y2="100%">
          <stop offset="0%" stopColor={s('#B91C2C')} />
          <stop offset="100%" stopColor={s('#6B0F1A')} />
        </linearGradient>
        <linearGradient id="rh-shorts" x1="0%" y1="0%" x2="40%" y2="100%">
          <stop offset="0%" stopColor={s('#1E2433')} />
          <stop offset="100%" stopColor={s('#0F1218')} />
        </linearGradient>
        <radialGradient id="rh-ball" cx="30%" cy="25%" r="70%">
          <stop offset="0%" stopColor={s('#FFA04D')} />
          <stop offset="100%" stopColor={s('#B45309')} />
        </radialGradient>
      </defs>

      {showBody && (
        <g transform={bodyScale}>
          <g transform={`translate(0 ${(1 - legLen) * 24})`}>
            {/* Legs */}
            <path
              d="M164 348 C158 400 154 460 150 512 C158 520 170 518 176 504 L180 360 C176 352 168 348 164 348 Z
                 M196 348 C202 400 206 460 210 512 C202 520 190 518 184 504 L180 360 C184 352 192 348 196 348 Z"
              fill={s('url(#rh-skin)')}
            />
            {/* Shorts */}
            <path
              d="M132 322 C132 300 154 288 180 288 C206 288 228 300 228 322 L222 388
                 C214 372 198 362 180 362 C162 362 146 372 138 388 Z"
              fill={s('url(#rh-shorts)')}
            />
            {!ink && <path d="M138 340 H222" stroke="#A67C32" strokeWidth="2" opacity="0.45" />}
            {/* Shoes */}
            <path
              d="M142 508 C136 524 148 542 168 544 L174 516 H148 Z
                 M218 508 C224 524 212 542 192 544 L186 516 H212 Z"
              fill={s('#111')}
            />
            {!ink && (
              <>
                <path d="M152 532 C164 538 176 538 184 532" stroke="#B91C2C" strokeWidth="2.5" fill="none" />
                <path d="M176 532 C184 538 196 538 208 532" stroke="#B91C2C" strokeWidth="2.5" fill="none" />
              </>
            )}
          </g>

          <g transform={`scale(1 ${torsoLen}) translate(0 ${(1 - torsoLen) * 56})`}>
            {/* Torso skin */}
            <path
              d="M132 204 C118 244 116 288 120 324 H240 C244 288 242 244 228 204
                 C216 192 144 192 132 204 Z"
              fill={s('url(#rh-skin)')}
            />
            {/* Jersey */}
            <path
              d="M136 206 C122 244 120 282 124 316 H236 C240 282 238 244 224 206
                 C212 196 148 196 136 206 Z"
              fill={s('url(#rh-jersey)')}
            />
            {!ink && (
              <>
                <path d="M164 206 L180 232 L196 206" stroke="#D4A84B" strokeWidth="2.5" fill="none" />
                <path d="M148 228 V312 M212 228 V312" stroke="#D4A84B" strokeWidth="1.2" opacity="0.4" />
              </>
            )}
            {/* Right arm */}
            <path
              d="M228 212 C256 232 268 278 262 322 C254 330 242 326 238 312
                 C244 270 236 236 222 220 Z"
              fill={s('url(#rh-skin)')}
            />
            <path d="M262 322 C270 332 266 346 254 350 C244 344 242 332 248 322 Z" fill={s(skin.shadow)} />
            {/* Left arm + ball */}
            {ball && <circle cx="112" cy="372" r="30" fill={s('url(#rh-ball)')} />}
            <path
              d="M132 212 C104 236 92 286 98 332 C106 340 120 334 126 320
                 C118 278 124 240 138 222 Z"
              fill={s('url(#rh-skin)')}
            />
            {ball && (
              <path
                d="M126 320 C112 338 108 360 118 374 C132 380 146 366 148 346 C150 332 138 322 126 320 Z"
                fill={s('url(#rh-skin)')}
              />
            )}
            {!ball && <path d="M98 332 C90 342 94 356 106 360 C118 354 122 340 116 330 Z" fill={s(skin.shadow)} />}
            {!ink && ball && (
              <path
                d="M130 358 C136 364 134 372 126 374 C120 368 122 362 130 358 Z"
                fill={skin.mid}
              />
            )}
            {bands && !ink && (
              <>
                <ellipse cx="252" cy="318" rx="10" ry="5" fill="#EEE" transform="rotate(-8 252 318)" />
                <ellipse cx="104" cy="326" rx="10" ry="5" fill="#EEE" transform="rotate(12 104 326)" />
              </>
            )}
          </g>
        </g>
      )}

      {/* Head stack — no body width/height distortion */}
      <g transform={showBody ? bodyScale : undefined}>
        <path
          d="M170 150 C170 168 172 186 176 204 H184 C188 186 190 168 190 150
             C190 144 170 144 170 150 Z"
          fill={s(skin.mid)}
        />
        <path
          d="M148 196 C132 202 126 208 122 212 C138 208 158 204 180 204
             C202 204 222 208 238 212 C234 208 228 202 212 196 Z"
          fill={s(skin.shadow)}
          opacity={ink ? 1 : 0.3}
        />
      </g>

      <g transform="translate(180 108)">
        {!ink && (
          <>
            <path
              d="M0 -30 C22 -30 34 -14 34 6 C34 22 26 38 0 40 C-26 38 -34 22 -34 6 C-34 -14 -22 -30 0 -30 Z"
              fill={s('url(#rh-skin)')}
            />
            <path d="M-24 -24 C-8 -32 8 -32 24 -24 C14 -34 0 -36 -14 -32 Z" fill={skin.highlight} opacity="0.28" />
            <path d="M-38 4 C-44 10 -44 22 -40 30 C-36 24 -36 14 -36 4 Z" fill={skin.mid} />
            <path d="M38 4 C44 10 44 22 40 30 C36 24 36 14 36 4 Z" fill={skin.shadow} opacity="0.85" />
            {/* Eyes */}
            <ellipse cx="-18" cy="6" rx="7" ry="8" fill="#F5F2EE" />
            <ellipse cx="18" cy="6" rx="7" ry="8" fill="#F5F2EE" />
            <circle cx="-18" cy="7" r="4" fill="#2A1E14" />
            <circle cx="18" cy="7" r="4" fill="#2A1E14" />
            <circle cx="-16.5" cy="5.5" r="1.2" fill="#FFF" opacity="0.8" />
            <circle cx="19.5" cy="5.5" r="1.2" fill="#FFF" opacity="0.8" />
            <path d="M-28 -6 Q-18 -12 -8 -6" stroke={hair} strokeWidth="2.4" fill="none" />
            <path d="M8 -6 Q18 -12 28 -6" stroke={hair} strokeWidth="2.4" fill="none" />
            <path d="M0 10 C-3 16 -2 22 0 24 C2 22 3 16 0 10 Z" fill={skin.shadow} opacity="0.35" />
            <path d="M-12 34 Q0 42 12 34" stroke="#5C4030" strokeWidth="2" fill="none" />
          </>
        )}
        {ink && (
          <path
            d="M0 -30 C22 -30 34 -14 34 6 C34 22 26 38 0 40 C-26 38 -34 22 -34 6 C-34 -14 -22 -30 0 -30 Z"
            fill={ink}
          />
        )}
      </g>

      {/* Hair — crop fade */}
      {!ink && (
        <g>
          <path
            d="M144 72 C146 50 162 38 180 36 C198 38 214 50 216 72
               C210 56 196 48 180 48 C164 48 150 56 144 72 Z"
            fill={hair}
          />
          <path
            d="M142 76 C146 64 162 58 180 56 C198 58 214 64 218 76 L214 88
               C206 74 194 68 180 68 C166 68 154 74 146 88 Z"
            fill={hair}
          />
          <path d="M150 50 C165 44 195 44 210 50" stroke="#2A2220" strokeWidth="1" opacity="0.35" fill="none" />
        </g>
      )}
      {ink && (
        <path
          d="M144 72 C146 50 162 38 180 36 C198 38 214 50 216 72
             C210 56 196 48 180 48 C164 48 150 56 144 72 Z"
          fill={ink}
        />
      )}
    </g>
  )
}
