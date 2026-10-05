import { Canvas } from '@react-three/fiber'
import type { PlayerAvatarConfig } from '../../schema'
import { PlayerAvatar3DScene } from './PlayerAvatar3DScene'

export function PlayerAvatar3D({
  config,
  className = '',
  interactive = false,
}: {
  config: PlayerAvatarConfig
  className?: string
  interactive?: boolean
}) {
  return (
    <div className={className}>
      <Canvas
        shadows
        camera={{ position: [0, 1.05, 2.35], fov: 36 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <group position={[0, -0.85, 0]}>
          <PlayerAvatar3DScene config={config} interactive={interactive} />
        </group>
      </Canvas>
    </div>
  )
}
