import { useCallback, useMemo, useState } from 'react'
import { Dices, RotateCcw } from 'lucide-react'
import type { AvatarCategory, PlayerAvatarConfig, SportSlug } from '../schema'
import { defaultConfig, presetConfig, PRESET_LABELS } from '../presets'
import { randomizeAvatar } from '../randomize'
import { assetsForCategory, HAIR_COLORS, SKIN_TONES, STUDIO_CATEGORIES } from '../registry'
import { SKIN_HEX } from '../colors'
import { PlayerAvatarRenderer } from '../render/PlayerAvatarRenderer'
import { demoGlbEnabled } from '../render/glb/demoGlb'
import { Button } from '../../components/ui'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import type { Me } from '../../lib/types'

function heightLabel(m: number) {
  const totalIn = Math.round(m * 39.3701)
  const ft = Math.floor(totalIn / 12)
  const inch = totalIn % 12
  return `${ft}'${inch}"`
}

function setField<K extends keyof PlayerAvatarConfig>(c: PlayerAvatarConfig, key: K, value: PlayerAvatarConfig[K]): PlayerAvatarConfig {
  const next = { ...c, [key]: value }
  if (key === 'sport') {
    const sport = value as SportSlug
    const d = defaultConfig(sport)
    return { ...next, top: d.top, bottom: d.bottom, shoes: d.shoes, sportsEquipment: d.sportsEquipment }
  }
  return next
}

export function AvatarStudio({ initial, onSaved }: { initial?: PlayerAvatarConfig | null; onSaved?: () => void }) {
  const { updateUser } = useAuth()
  const [config, setConfig] = useState<PlayerAvatarConfig>(() => initial ?? defaultConfig('basketball'))
  const [category, setCategory] = useState<AvatarCategory>('body')
  const [rotation, setRotation] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const options = useMemo(() => {
    if (category === 'skin') return SKIN_TONES
    if (category === 'hair' && config.hairColor) return assetsForCategory('hair')
    return assetsForCategory(category)
  }, [category, config.hairColor])

  const fieldKey = useMemo((): keyof PlayerAvatarConfig | null => {
    const map: Partial<Record<AvatarCategory, keyof PlayerAvatarConfig>> = {
      body: 'bodyType',
      skin: 'skinTone',
      face: 'face',
      eyes: 'eyes',
      eyebrows: 'eyebrows',
      nose: 'nose',
      mouth: 'mouth',
      hair: 'hair',
      facialHair: 'facialHair',
      top: 'top',
      bottom: 'bottom',
      shoes: 'shoes',
      headwear: 'headwear',
      eyewear: 'eyewear',
      accessory: 'accessory',
      sport: 'sport',
      sportsEquipment: 'sportsEquipment',
      pose: 'pose',
    }
    return map[category] ?? null
  }, [category])

  const save = useCallback(async () => {
    setSaving(true)
    setError('')
    try {
      await api('/api/me/avatar', { method: 'PUT', json: config })
      const me = await api<Me>('/api/me')
      updateUser(me)
      onSaved?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save avatar')
    } finally {
      setSaving(false)
    }
  }, [config, onSaved, updateUser])

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 pb-24 lg:pb-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="display text-2xl font-extrabold">Avatar Creator</h1>
          <p className="text-sm text-ink-2">Build your sports identity — saved as configuration, not a flat image.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => setConfig(randomizeAvatar(config))}>
            <Dices className="size-4" aria-hidden /> Randomize
          </Button>
          <Button type="button" variant="ghost" onClick={() => setConfig(defaultConfig(config.sport))}>
            <RotateCcw className="size-4" aria-hidden /> Reset
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESET_LABELS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setConfig(presetConfig(p.id))}
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-semibold hover:border-brand"
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,180px)_1fr_minmax(0,280px)]">
        <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {STUDIO_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`shrink-0 rounded-xl px-3 py-2 text-left text-sm font-semibold lg:w-full ${
                category === c.id ? 'bg-brand text-brand-ink' : 'bg-surface-2 text-ink hover:bg-line'
              }`}
            >
              {c.label}
            </button>
          ))}
        </nav>

        <div className="relative min-h-[min(78vh,580px)] overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-[#eef2f6] via-[#e8edf3] to-[#dfe6ed] shadow-inner lg:min-h-[520px]">
          <div className="absolute inset-x-0 top-3 z-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-2">Preview · 3D</p>
            <p className="text-sm text-ink">{heightLabel(config.height)} · {config.bodyType}</p>
            {demoGlbEnabled() && (
              <p className="mt-1 text-[10px] text-ink-2">Demo character — hair/clothes from your picks apply when GLB packs are added.</p>
            )}
          </div>
          <div className="flex h-full min-h-[min(78vh,580px)] items-center justify-center px-4 pb-20 pt-14 lg:min-h-[520px]">
            <div className="aspect-[3/5] h-[min(72vh,520px)] w-auto max-h-full max-w-full">
              <PlayerAvatarRenderer
                config={config}
                rotationY={rotation}
                renderer="glb"
                className="h-full w-full"
              />
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-2 border-t border-line/60 bg-bg/80 px-3 py-3 backdrop-blur-sm">
            <Button type="button" variant="secondary" className="min-h-9" onClick={() => setRotation((r) => r - 45)}>
              ↺ Rotate
            </Button>
            <Button type="button" variant="secondary" className="min-h-9" onClick={() => setRotation(0)}>
              Front
            </Button>
            <Button type="button" variant="secondary" className="min-h-9" onClick={() => setRotation((r) => r + 45)}>
              ↻ Rotate
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-2">{STUDIO_CATEGORIES.find((c) => c.id === category)?.label}</p>

          {category === 'body' && (
            <div className="mb-4">
              <label className="text-sm font-semibold">Height — {heightLabel(config.height)}</label>
              <input
                type="range"
                min={1.45}
                max={2.25}
                step={0.01}
                value={config.height}
                onChange={(e) => setConfig((c) => ({ ...c, height: Number(e.target.value) }))}
                className="mt-2 w-full accent-brand"
              />
            </div>
          )}

          {category === 'hair' && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-bold uppercase text-ink-2">Hair color</p>
              <div className="flex flex-wrap gap-2">
                {HAIR_COLORS.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    aria-pressed={config.hairColor === h.id}
                    onClick={() => setConfig((c) => ({ ...c, hairColor: h.id }))}
                    className={`rounded-full border-2 px-2 py-1 text-xs font-semibold ${config.hairColor === h.id ? 'border-brand' : 'border-line'}`}
                  >
                    {h.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex max-h-[40vh] flex-wrap gap-2 overflow-y-auto">
            {category === 'skin'
              ? SKIN_TONES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={config.skinTone === s.id}
                    onClick={() => setConfig((c) => setField(c, 'skinTone', s.id))}
                    className={`size-11 rounded-full border-2 ${config.skinTone === s.id ? 'border-brand scale-110' : 'border-line'}`}
                    style={{ backgroundColor: SKIN_HEX[s.id] }}
                    title={s.name}
                  />
                ))
              : fieldKey &&
                options.map((o) => {
                  const val = config[fieldKey]
                  const selected = val === o.id || (val === null && o.id === 'beard_none')
                  return (
                    <button
                      key={o.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        const v = o.id as PlayerAvatarConfig[typeof fieldKey]
                        if (fieldKey === 'headwear' || fieldKey === 'eyewear' || fieldKey === 'accessory' || fieldKey === 'sportsEquipment') {
                          setConfig((c) => ({ ...c, [fieldKey]: o.id }))
                        } else {
                          setConfig((c) => setField(c, fieldKey, v as PlayerAvatarConfig[typeof fieldKey]))
                        }
                      }}
                      className={`rounded-xl border-2 px-3 py-2 text-left text-sm font-semibold ${
                        selected ? 'border-brand bg-brand/10' : 'border-line bg-surface-2'
                      }`}
                    >
                      {o.name}
                    </button>
                  )
                })}
          </div>

        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface p-4">
        <input
          type="checkbox"
          className="mt-1 size-5 accent-brand"
          checked={config.useAsProfile}
          onChange={(e) => setConfig((c) => ({ ...c, useAsProfile: e.target.checked }))}
        />
        <span>
          <span className="font-semibold">Use as profile picture</span>
          <span className="mt-1 block text-sm text-ink-2">Same character on profile, player cards, teams, and invites.</span>
        </span>
      </label>

      {error && <p className="text-center text-sm text-danger">{error}</p>}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 p-4 backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0">
        <Button type="button" className="w-full lg:max-w-xs" loading={saving} onClick={() => void save()}>
          Save avatar
        </Button>
      </div>
    </div>
  )
}
