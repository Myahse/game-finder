import type { PlayerAvatarConfig } from '../../../schema'
import { HAIR_HEX, skinColors } from '../../../colors'
import { browPath, eyePaths, facePaths, mouthPath, nosePath } from './faceArt'
import { HairArt } from './hairArt'

type HeadArtProps = {
  config: PlayerAvatarConfig
  uid: string
  skinGrad: string
  softFilter?: string
}

export function HeadArt({ config, uid, skinGrad, softFilter }: HeadArtProps) {
  const skin = skinColors(config.skinTone)
  const hairColor = HAIR_HEX[config.hairColor] ?? HAIR_HEX.black
  const hairHi = HAIR_HEX[config.hairColor === 'black' ? 'dark_brown' : config.hairColor] ?? hairColor
  const face = facePaths(config.face)
  const eyes = eyePaths(config.eyes)

  return (
    <>
      <path
        d="M168 154 C168 168 170 178 172 198 L188 198 C190 178 192 168 192 154 C192 148 168 148 168 154 Z"
        fill={skin.mid}
      />
      <g transform="translate(180 108)">
        <path d={face.leftEar} fill={skin.mid} />
        <path d={face.rightEar} fill={skin.mid} />
        <path d={face.skull} fill={skinGrad} filter={softFilter} />
        <path d={face.jaw} fill={skin.mid} opacity="0.55" />
        <rect
          x="-34"
          y="-20"
          width="68"
          height="90"
          fill={`url(#${uid}-face-shade)`}
          clipPath={`url(#${uid}-head-clip)`}
          opacity="0.45"
        />
        <path d={eyes.lidL} stroke={hairColor} strokeWidth="2.8" fill="none" strokeLinecap="round" />
        <path d={eyes.lidR} stroke={hairColor} strokeWidth="2.8" fill="none" strokeLinecap="round" />
        <path d={browPath(config.eyebrows, 'l')} stroke={hairColor} strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d={browPath(config.eyebrows, 'r')} stroke={hairColor} strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d={eyes.left} fill="#f5f5f4" />
        <path d={eyes.right} fill="#f5f5f4" />
        <circle cx="-22" cy="8" r="5" fill="#1c1410" />
        <circle cx="22" cy="8" r="5" fill="#1c1410" />
        <circle cx="-20" cy="6" r="1.6" fill="#fff" opacity="0.75" />
        <circle cx="24" cy="6" r="1.6" fill="#fff" opacity="0.75" />
        <path d={nosePath(config.nose)} fill={skin.shadow} opacity="0.45" />
        <path d={mouthPath(config.mouth)} stroke="#5c3d2e" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </g>
      <g clipPath={`url(#${uid}-head-clip)`}>
        <HairArt hair={config.hair} color={hairColor} highlight={hairHi} />
      </g>
      {config.facialHair !== 'beard_none' && config.facialHair !== 'beard_mustache' && (
        <path
          d="M158 118 C164 134 172 140 180 140 C188 140 196 134 202 118 C194 128 186 132 180 132 C174 132 166 128 158 118 Z"
          fill={hairColor}
          opacity="0.88"
        />
      )}
      {config.headwear === 'head_headband' && <path d="M146 70 L214 70 L212 78 L148 78 Z" fill="#e63946" />}
      {config.headwear === 'head_cap' && (
        <path d="M138 76 C146 48 164 38 180 36 C196 38 214 48 222 76 L218 86 L142 86 Z" fill="#1d3557" />
      )}
      {config.eyewear && (
        <g transform="translate(180 108)">
          <path d="M-34 0 L-8 0 L-8 10 L-34 10 Z" fill="#111" opacity="0.85" />
          <path d="M8 0 L34 0 L34 10 L8 10 Z" fill="#111" opacity="0.85" />
          <path d="M-8 4 L8 4" stroke="#111" strokeWidth="2" />
        </g>
      )}
    </>
  )
}
