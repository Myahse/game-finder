type HairProps = { hair: string; color: string; highlight: string }

/** Hairstyles conform to shared head silhouette (y≈42–88, cx=180). */
export function HairArt({ hair, color, highlight }: HairProps) {
  const id = hair
  if (id === 'hair_buzz') {
    return (
      <g fill={color}>
        <path
          d="M152 62 C156 50 168 44 180 42 C192 44 204 50 208 62 C204 56 192 52 180 52 C168 52 156 56 152 62 Z"
          opacity="0.95"
        />
        <path d="M154 64 C168 58 192 58 206 64" stroke={highlight} strokeWidth="1" opacity="0.25" fill="none" />
      </g>
    )
  }

  if (id === 'hair_fade_low' || id === 'hair_fade_mid' || id === 'hair_fade_high') {
    const high = id === 'hair_fade_high'
    const mid = id === 'hair_fade_mid'
    const fadeY = high ? 78 : mid ? 84 : 90
    return (
      <g>
        <path
          d="M144 78 C146 54 162 40 180 38 C198 40 214 54 216 78 C210 62 196 52 180 52 C164 52 150 62 144 78 Z"
          fill={color}
        />
        <path
          d={`M142 ${fadeY} C148 72 164 66 180 66 C196 66 212 72 218 ${fadeY} L214 ${fadeY + 8} C206 76 194 72 180 72 C166 72 154 76 146 ${fadeY + 8} Z`}
          fill={color}
        />
        <path
          d="M150 48 C165 42 195 42 210 48"
          stroke={highlight}
          strokeWidth="2"
          opacity="0.2"
          fill="none"
        />
      </g>
    )
  }

  if (id === 'hair_crop' || id === 'hair_curls_short') {
    return (
      <g fill={color}>
        <path d="M142 76 C144 52 160 38 180 36 C200 38 216 52 218 76 C212 58 198 48 180 48 C162 48 148 58 142 76 Z" />
        <path
          d="M148 54 C156 46 168 42 180 42 C192 42 204 46 212 54 C206 50 194 48 180 48 C166 48 154 50 148 54 Z"
          fill={highlight}
          opacity="0.15"
        />
        {id === 'hair_curls_short' && (
          <>
            <circle cx="158" cy="58" r="4" />
            <circle cx="172" cy="52" r="4" />
            <circle cx="188" cy="52" r="4" />
            <circle cx="202" cy="58" r="4" />
          </>
        )}
        {id === 'hair_crop' && (
          <path
            d="M146 70 C152 64 164 60 180 60 C196 60 208 64 214 70 L210 78 C200 72 190 70 180 70 C170 70 160 72 150 78 Z"
            opacity="0.9"
          />
        )}
      </g>
    )
  }

  if (id === 'hair_afro') {
    return (
      <path
        d="M128 92 C120 48 148 28 180 26 C212 28 240 48 232 92 C224 68 204 54 180 54 C156 54 136 68 128 92 Z"
        fill={color}
      />
    )
  }

  if (id === 'hair_box_braids' || id === 'hair_braids') {
    return (
      <g fill={color}>
        <path d="M136 84 C138 52 156 38 180 36 C204 38 222 52 224 84 L220 120 C218 100 200 88 180 88 C160 88 142 100 140 120 Z" />
        <path d="M148 90 L146 130 M160 88 L158 128 M172 86 L170 126 M188 86 L190 126 M202 88 L204 128 M214 90 L216 130" stroke={highlight} strokeWidth="2" opacity="0.35" />
      </g>
    )
  }

  if (id === 'hair_cornrows') {
    return (
      <g fill={color}>
        <path d="M142 78 C144 50 162 38 180 36 C198 38 216 50 218 78 Z" />
        <path d="M150 44 L148 76 M165 40 L163 74 M180 38 L180 72 M195 40 L197 74 M210 44 L212 76" stroke={highlight} strokeWidth="1.5" opacity="0.4" />
      </g>
    )
  }

  if (id === 'hair_locs' || id === 'hair_twists') {
    return (
      <g fill={color}>
        <path d="M140 80 C142 48 160 36 180 34 C200 36 218 48 220 80 L216 110 C210 92 196 82 180 82 C164 82 150 92 144 110 Z" />
      </g>
    )
  }

  if (id === 'hair_ponytail') {
    return (
      <g fill={color}>
        <path d="M148 78 C150 52 164 40 180 38 C196 40 210 52 212 78 Z" />
        <path d="M176 38 C174 20 186 8 192 4 C188 16 184 28 182 38 Z" />
      </g>
    )
  }

  return (
    <path
      d="M144 78 C146 54 162 40 180 38 C198 40 214 54 216 78 C210 62 196 52 180 52 C164 52 150 62 144 78 Z"
      fill={color}
    />
  )
}
