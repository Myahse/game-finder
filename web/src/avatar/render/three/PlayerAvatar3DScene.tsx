import { Center, ContactShadows, Html, OrbitControls, useGLTF } from '@react-three/drei'
import { Suspense, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { PlayerAvatarConfig } from '../../schema'
import { resolveGlbAvatar, skinTintHex } from '../glb/assetManifest'

function applySkinTint(root: THREE.Object3D, hex: string) {
  const c = new THREE.Color(hex)
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh || !mesh.material) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const m of mats) {
      if (m instanceof THREE.MeshStandardMaterial && m.map) {
        m.color.lerp(c, 0.35)
      }
    }
  })
}

function CharacterModel({ url, skinTone }: { url: string; skinTone: string }) {
  const { scene } = useGLTF(url)
  const clone = useMemo(() => scene.clone(true), [scene])
  useEffect(() => {
    applySkinTint(clone, skinTintHex(skinTone))
  }, [clone, skinTone])
  return (
    <Center bottom>
      <primitive object={clone} scale={1.05} />
    </Center>
  )
}

function DemoBall({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <mesh position={[-0.35, 0.95, 0.25]} castShadow>
      <sphereGeometry args={[0.12, 32, 32]} />
      <meshStandardMaterial color="#c2410c" roughness={0.55} />
    </mesh>
  )
}

function AvatarRig({ config }: { config: PlayerAvatarConfig }) {
  const resolved = resolveGlbAvatar(config)

  if (!resolved.displayUrl) {
    return (
      <Html center>
        <div className="max-w-[240px] rounded-xl border border-line bg-bg/95 px-4 py-3 text-center shadow-lg backdrop-blur">
          <p className="text-sm font-bold text-ink">3D preview off</p>
          <p className="mt-1 text-xs text-ink-2">Add GLBs to public/avatar/ or enable demo in dev.</p>
        </div>
      </Html>
    )
  }

  const ball = config.sportsEquipment === 'eq_basketball'

  return (
    <group>
      <CharacterModel url={resolved.displayUrl} skinTone={config.skinTone} />
      {resolved.mode === 'demo' && <DemoBall show={ball} />}
      {resolved.mode === 'modular' && (
        <Html position={[0, 2, 0]} center>
          <span className="sr-only">Modular slots loaded</span>
        </Html>
      )}
    </group>
  )
}

export function PlayerAvatar3DScene({
  config,
  interactive,
}: {
  config: PlayerAvatarConfig
  interactive?: boolean
}) {
  return (
    <>
      {/* Local lights only — drei's <Environment preset> downloads an HDR from a third-party CDN,
          which the site CSP blocks and which crashed the whole app when unreachable. */}
      <hemisphereLight args={['#ffffff', '#b9c3cf', 0.9]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[-4, 6, 4]} intensity={1.15} castShadow />
      <directionalLight position={[3, 2, -2]} intensity={0.2} />
      <Suspense
        fallback={
          <Html center>
            <p className="text-sm font-semibold text-ink-2">Loading 3D…</p>
          </Html>
        }
      >
        <AvatarRig config={config} />
      </Suspense>
      <ContactShadows position={[0, 0, 0]} opacity={0.35} scale={2.5} blur={2.5} far={2.5} />
      {interactive && <OrbitControls enablePan={false} minPolarAngle={Math.PI / 3.2} maxPolarAngle={Math.PI / 2.02} />}
    </>
  )
}
