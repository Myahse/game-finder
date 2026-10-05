/** Face anchor: origin at bridge of nose (0,0). All features in shared perspective. */

export type FacePaths = {
  skull: string
  jaw: string
  leftEar: string
  rightEar: string
}

export function facePaths(faceId: string): FacePaths {
  switch (faceId) {
    case 'face_round':
      return {
        skull: 'M-34 -42 C-38 -8 -36 28 -18 42 C0 48 18 42 34 28 C36 -8 38 -42 0 -48 C-22 -48 -34 -42 -34 -42 Z',
        jaw: 'M-28 18 C-14 38 14 38 28 18 C22 32 0 40 -22 32 Z',
        leftEar: 'M-36 -6 C-44 -4 -46 8 -42 18 C-38 12 -36 4 -36 -6 Z',
        rightEar: 'M36 -6 C44 -4 46 8 42 18 C38 12 36 4 36 -6 Z',
      }
    case 'face_square':
      return {
        skull: 'M-36 -44 L-36 24 C-36 38 -12 44 0 44 C12 44 36 38 36 24 L36 -44 C20 -50 -20 -50 -36 -44 Z',
        jaw: 'M-30 16 L-24 36 L24 36 L30 16 Z',
        leftEar: 'M-38 -8 C-46 -6 -48 6 -44 16 C-40 10 -38 0 -38 -8 Z',
        rightEar: 'M38 -8 C46 -6 48 6 44 16 C40 10 38 0 38 -8 Z',
      }
    case 'face_heart':
      return {
        skull: 'M0 -50 C-28 -44 -40 -20 -36 4 C-32 28 -12 44 0 48 C12 44 32 28 36 4 C40 -20 28 -44 0 -50 Z',
        jaw: 'M-20 20 C-8 36 8 36 20 20 C12 32 0 36 -12 32 Z',
        leftEar: 'M-34 -10 C-42 -8 -44 4 -40 14 C-36 8 -34 0 -34 -10 Z',
        rightEar: 'M34 -10 C42 -8 44 4 40 14 C36 8 34 0 34 -10 Z',
      }
    case 'face_long':
      return {
        skull: 'M-30 -48 C-34 -12 -32 32 -14 46 C0 50 14 46 30 32 C32 -12 34 -48 0 -52 C-18 -52 -30 -48 -30 -48 Z',
        jaw: 'M-22 22 C-10 42 10 42 22 22 C16 36 0 42 -16 36 Z',
        leftEar: 'M-32 -8 C-40 -6 -42 10 -38 20 C-34 14 -32 4 -32 -8 Z',
        rightEar: 'M32 -8 C40 -6 42 10 38 20 C34 14 32 4 32 -8 Z',
      }
    case 'face_angular':
      return {
        skull: 'M-32 -46 L-38 8 L-20 44 L20 44 L38 8 L32 -46 C12 -52 -12 -52 -32 -46 Z',
        jaw: 'M-24 18 L-8 40 L8 40 L24 18 Z',
        leftEar: 'M-36 -10 C-44 -8 -46 6 -42 16 C-38 10 -36 2 -36 -10 Z',
        rightEar: 'M36 -10 C44 -8 46 6 42 16 C38 10 36 2 36 -10 Z',
      }
    default:
      return {
        skull: 'M-32 -46 C-36 -10 -34 30 -16 44 C0 48 16 44 32 30 C34 -10 36 -46 0 -50 C-18 -50 -32 -46 -32 -46 Z',
        jaw: 'M-26 16 C-12 38 12 38 26 16 C20 32 0 38 -20 32 Z',
        leftEar: 'M-35 -8 C-43 -6 -45 8 -41 18 C-37 12 -35 4 -35 -8 Z',
        rightEar: 'M35 -8 C43 -6 45 8 41 18 C37 12 35 4 35 -8 Z',
      }
  }
}

export function eyePaths(eyeId: string): { left: string; right: string; lidL: string; lidR: string } {
  const wide = eyeId === 'eyes_05'
  const narrow = eyeId === 'eyes_04'
  if (wide) {
    return {
      left: 'M-30 2 C-30 -6 -14 -6 -14 2 C-14 14 -30 14 -30 2 Z',
      right: 'M14 2 C14 -6 30 -6 30 2 C30 14 14 14 14 2 Z',
      lidL: 'M-32 0 Q-22 -8 -12 0',
      lidR: 'M12 0 Q22 -8 32 0',
    }
  }
  if (narrow) {
    return {
      left: 'M-28 4 C-28 -2 -16 -2 -16 4 C-16 10 -28 10 -28 4 Z',
      right: 'M16 4 C16 -2 28 -2 28 4 C28 10 16 10 16 4 Z',
      lidL: 'M-30 2 Q-22 -4 -14 2',
      lidR: 'M14 2 Q22 -4 30 2',
    }
  }
  return {
    left: 'M-29 2 C-29 -5 -15 -5 -15 2 C-15 13 -29 13 -29 2 Z',
    right: 'M15 2 C15 -5 29 -5 29 2 C29 13 15 13 15 2 Z',
    lidL: 'M-31 0 Q-22 -7 -13 0',
    lidR: 'M13 0 Q22 -7 31 0',
  }
}

export function browPath(browId: string, side: 'l' | 'r'): string {
  const athletic = browId === 'brow_athletic' || browId === 'brow_thick'
  const y = athletic ? -14 : -12
  if (side === 'l') return `M-36 ${y} Q-22 ${y - 6} -10 ${y}`.replace(/(\d+)/g, (m) => String(Number(m)))
  return `M10 ${y} Q22 ${y - 6} 36 ${y}`
}

export function nosePath(noseId: string): string {
  if (noseId === 'nose_wide') return 'M0 8 C-8 14 -6 26 0 30 C6 26 8 14 0 8 Z'
  if (noseId === 'nose_small') return 'M0 10 L-4 22 L0 24 L4 22 Z'
  return 'M0 6 C-5 12 -4 24 0 28 C4 24 5 12 0 6 Z'
}

export function mouthPath(mouthId: string): string {
  switch (mouthId) {
    case 'mouth_big_smile':
      return 'M-18 34 Q0 48 18 34'
    case 'mouth_serious':
      return 'M-14 36 L14 36'
    case 'mouth_confident':
      return 'M-12 34 Q0 40 12 34'
    case 'mouth_relaxed':
      return 'M-14 36 Q0 42 14 36'
    default:
      return 'M-16 34 Q0 44 16 34'
  }
}
