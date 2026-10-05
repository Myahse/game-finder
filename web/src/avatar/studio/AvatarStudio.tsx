import { useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Dices, Glasses, PersonStanding, RotateCcw, Scissors, Shirt, Smile } from 'lucide-react'
import type { AvatarAsset, PlayerAvatarConfig, SportSlug } from '../schema'
import { presetConfig, PRESET_LABELS, sportKit } from '../presets'
import { randomizeAvatar } from '../randomize'
import {
  ACCESSORIES,
  BODY_TYPES,
  BOTTOMS,
  EQUIPMENT,
  EYEBROWS,
  EYES,
  EYEWEAR,
  FACES,
  FACIAL_HAIR,
  HAIR_COLORS,
  HAIRS,
  HEADWEAR,
  MOUTHS,
  NOSES,
  POSES,
  SHOES_LIST,
  SKIN_TONES,
  SPORTS,
  TOPS,
} from '../registry'
import { SKIN_HEX } from '../colors'
import { HAIR_COLORS as HAIR_HEX, KITS } from '../render/svg/palette'
import { AthleteSvgScene } from '../render/svg/AthleteSvgScene'
import { Button, ErrorText, PageHeader } from '../../components/ui'
import { api, errorMessage } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import type { Me } from '../../lib/types'
import { useLocale } from '../../i18n/LocaleProvider'

type Field = keyof PlayerAvatarConfig
type Labels = ReturnType<typeof useLocale>['t']['avatarStudio']

type Part =
  | { id: string; label: keyof Labels; kind: 'options'; field: Field; options: AvatarAsset[]; crop: 'head' | 'full'; nullable?: boolean }
  | { id: string; label: keyof Labels; kind: 'skin' }
  | { id: string; label: keyof Labels; kind: 'hairColor' }
  | { id: string; label: keyof Labels; kind: 'height' }

type Group = { id: string; label: keyof Labels; icon: ReactNode; parts: Part[] }

const opt = (id: string, label: keyof Labels, field: Field, options: AvatarAsset[], crop: 'head' | 'full', nullable = false): Part => ({
  id,
  label,
  kind: 'options',
  field,
  options,
  crop,
  nullable,
})

const GROUPS: Group[] = [
  {
    id: 'body',
    label: 'groupBody',
    icon: <PersonStanding className="size-5" aria-hidden />,
    parts: [
      opt('build', 'build', 'bodyType', BODY_TYPES, 'full'),
      { id: 'skin', label: 'skin', kind: 'skin' },
      { id: 'height', label: 'height', kind: 'height' },
    ],
  },
  {
    id: 'face',
    label: 'groupFace',
    icon: <Smile className="size-5" aria-hidden />,
    parts: [
      opt('shape', 'faceShape', 'face', FACES, 'head'),
      opt('eyes', 'eyes', 'eyes', EYES, 'head'),
      opt('brows', 'brows', 'eyebrows', EYEBROWS, 'head'),
      opt('nose', 'nose', 'nose', NOSES, 'head'),
      opt('mouth', 'mouth', 'mouth', MOUTHS, 'head'),
      opt('beard', 'beard', 'facialHair', FACIAL_HAIR, 'head'),
    ],
  },
  {
    id: 'hair',
    label: 'groupHair',
    icon: <Scissors className="size-5" aria-hidden />,
    parts: [opt('style', 'hairStyle', 'hair', HAIRS, 'head'), { id: 'color', label: 'hairColor', kind: 'hairColor' }],
  },
  {
    id: 'kit',
    label: 'groupKit',
    icon: <Shirt className="size-5" aria-hidden />,
    parts: [
      opt('sport', 'sport', 'sport', SPORTS, 'full'),
      opt('top', 'top', 'top', TOPS, 'full'),
      opt('bottom', 'bottom', 'bottom', BOTTOMS, 'full'),
      opt('shoes', 'shoes', 'shoes', SHOES_LIST, 'full'),
      opt('gear', 'gear', 'sportsEquipment', EQUIPMENT, 'full', true),
      opt('pose', 'pose', 'pose', POSES, 'full'),
    ],
  },
  {
    id: 'extras',
    label: 'groupExtras',
    icon: <Glasses className="size-5" aria-hidden />,
    parts: [
      opt('headwear', 'headwear', 'headwear', HEADWEAR, 'head', true),
      opt('eyewear', 'eyewear', 'eyewear', EYEWEAR, 'head', true),
      opt('accessory', 'accessory', 'accessory', ACCESSORIES, 'full', true),
    ],
  },
]

/** Apply one choice; picking a sport also dresses the player in that sport's kit. */
function withValue(c: PlayerAvatarConfig, field: Field, value: unknown): PlayerAvatarConfig {
  if (field === 'sport') return { ...c, ...sportKit(value as SportSlug), sport: value as SportSlug }
  return { ...c, [field]: value }
}

function heightLabel(m: number) {
  const totalIn = Math.round(m * 39.3701)
  return `${Math.round(m * 100)} cm · ${Math.floor(totalIn / 12)}'${totalIn % 12}"`
}

function kitTint(c: PlayerAvatarConfig) {
  const main = (KITS[c.sport] ?? KITS.basketball).main
  const tone = main === '#f6f5f0' ? KITS.tennis.trim : main
  return `radial-gradient(120% 80% at 50% 100%, color-mix(in srgb, ${tone} 22%, transparent), transparent 70%), linear-gradient(180deg, var(--surface-2), var(--surface))`
}

export function AvatarStudio({ initial, onSaved }: { initial: PlayerAvatarConfig; onSaved?: () => void }) {
  const { updateUser } = useAuth()
  const { t } = useLocale()
  const L = t.avatarStudio
  const qc = useQueryClient()
  const [config, setConfig] = useState<PlayerAvatarConfig>(initial)
  const [groupId, setGroupId] = useState(GROUPS[0].id)
  const group = GROUPS.find((g) => g.id === groupId) ?? GROUPS[0]
  const [partByGroup, setPartByGroup] = useState<Record<string, string>>({})
  const part = group.parts.find((p) => p.id === partByGroup[group.id]) ?? group.parts[0]
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await api('/api/me/avatar', { method: 'PUT', json: config })
      updateUser(await api<Me>('/api/me'))
      await qc.invalidateQueries({ queryKey: ['my-avatar'] })
      onSaved?.()
    } catch (e) {
      setError(errorMessage(e) || L.saveError)
    } finally {
      setSaving(false)
    }
  }

  const saveButton = (label: string, className = '') => (
    <Button type="button" className={className} loading={saving} onClick={() => void save()}>
      {label}
    </Button>
  )

  return (
    <>
      <PageHeader title={L.title} back="/profile" right={saveButton(L.save, 'min-h-10 px-4 text-base lg:hidden')} />
      <div className="mx-auto w-full max-w-5xl px-4 pb-8 pt-4 lg:grid lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:gap-8 lg:pb-10">
        {/* Preview */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="relative h-[38vh] min-h-64 overflow-hidden rounded-3xl border border-line lg:h-[560px]" style={{ background: kitTint(config) }}>
            <div className="absolute inset-x-6 bottom-3 top-6">
              <AthleteSvgScene config={config} crop="full" />
            </div>
            <div className="absolute right-3 top-3 flex gap-2">
              <IconButton label={L.randomize} onClick={() => setConfig((c) => randomizeAvatar(c))}>
                <Dices className="size-5" aria-hidden />
              </IconButton>
              <IconButton label={L.reset} onClick={() => setConfig(initial)}>
                <RotateCcw className="size-5" aria-hidden />
              </IconButton>
            </div>
            <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-surface/90 py-1 pl-1 pr-3 shadow-sm backdrop-blur">
              <div className="size-12 overflow-hidden rounded-full bg-surface-2 ring-2 ring-brand">
                <AthleteSvgScene config={config} crop="head" />
              </div>
              <span className="text-xs font-semibold text-ink-2">{L.profileView}</span>
            </div>
          </div>

          <p className="mb-2 mt-4 text-xs font-bold uppercase tracking-wide text-ink-2">{L.startFrom}</p>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:flex-wrap lg:px-0">
            {PRESET_LABELS.map((p) => {
              const preset = { ...presetConfig(p.id), useAsProfile: config.useAsProfile }
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setConfig(preset)}
                  className="flex shrink-0 items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 text-sm font-semibold hover:border-brand"
                >
                  <span className="size-8 overflow-hidden rounded-full bg-surface-2">
                    <AthleteSvgScene config={preset} crop="head" />
                  </span>
                  {p.name}
                </button>
              )
            })}
          </div>
        </aside>

        {/* Editor */}
        <section className="mt-5 lg:mt-0">
          <div className="grid grid-cols-5 gap-1 rounded-2xl bg-surface-2 p-1" role="tablist">
            {GROUPS.map((g) => (
              <button
                key={g.id}
                type="button"
                role="tab"
                aria-selected={g.id === group.id}
                onClick={() => setGroupId(g.id)}
                className={`flex flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] font-bold transition sm:text-xs ${
                  g.id === group.id ? 'bg-surface text-brand shadow-sm' : 'text-ink-2 hover:text-ink'
                }`}
              >
                {g.icon}
                {L[g.label]}
              </button>
            ))}
          </div>

          {group.parts.length > 1 && (
            <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:flex-wrap lg:px-0">
              {group.parts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={p.id === part.id}
                  onClick={() => setPartByGroup((m) => ({ ...m, [group.id]: p.id }))}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                    p.id === part.id ? 'bg-ink text-bg' : 'bg-surface-2 text-ink-2 hover:text-ink'
                  }`}
                >
                  {L[p.label]}
                </button>
              ))}
            </div>
          )}

          <div className="mt-4">
            <PartEditor part={part} config={config} setConfig={setConfig} L={L} />
          </div>

          <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface p-4">
            <input
              type="checkbox"
              className="mt-0.5 size-5 accent-brand"
              checked={config.useAsProfile}
              onChange={(e) => setConfig((c) => ({ ...c, useAsProfile: e.target.checked }))}
            />
            <span>
              <span className="font-semibold">{t.profile.avatarUseAsProfile}</span>
              <span className="mt-1 block text-sm text-ink-2">{t.profile.avatarUseAsProfileHint}</span>
            </span>
          </label>

          <div className="mt-4">
            <ErrorText>{error}</ErrorText>
            {saveButton(t.profile.avatarSave, 'hidden w-full lg:flex')}
          </div>
        </section>
      </div>
    </>
  )
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex size-10 items-center justify-center rounded-full bg-surface/90 text-ink shadow-sm backdrop-blur transition hover:text-brand active:scale-95"
    >
      {children}
    </button>
  )
}

function PartEditor({
  part,
  config,
  setConfig,
  L,
}: {
  part: Part
  config: PlayerAvatarConfig
  setConfig: (fn: (c: PlayerAvatarConfig) => PlayerAvatarConfig) => void
  L: Labels
}) {
  if (part.kind === 'skin') {
    return (
      <div className="flex flex-wrap gap-3">
        {SKIN_TONES.map((s) => (
          <Swatch
            key={s.id}
            color={SKIN_HEX[s.id]}
            label={s.name}
            selected={config.skinTone === s.id}
            onClick={() => setConfig((c) => ({ ...c, skinTone: s.id }))}
          />
        ))}
      </div>
    )
  }
  if (part.kind === 'hairColor') {
    return (
      <div className="flex flex-wrap gap-3">
        {HAIR_COLORS.map((h) => (
          <Swatch
            key={h.id}
            color={HAIR_HEX[h.id]}
            label={h.name}
            selected={config.hairColor === h.id}
            onClick={() => setConfig((c) => ({ ...c, hairColor: h.id }))}
          />
        ))}
      </div>
    )
  }
  if (part.kind === 'height') {
    return (
      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold text-ink-2">{L.height}</span>
          <span className="display text-2xl font-extrabold">{heightLabel(config.height)}</span>
        </div>
        <input
          type="range"
          min={1.45}
          max={2.25}
          step={0.01}
          value={config.height}
          aria-label={L.height}
          onChange={(e) => {
            const height = Number(e.target.value)
            setConfig((c) => ({ ...c, height }))
          }}
          className="mt-3 w-full accent-brand"
        />
      </div>
    )
  }
  return <OptionGrid part={part} config={config} setConfig={setConfig} L={L} />
}

function OptionGrid({
  part,
  config,
  setConfig,
  L,
}: {
  part: Extract<Part, { kind: 'options' }>
  config: PlayerAvatarConfig
  setConfig: (fn: (c: PlayerAvatarConfig) => PlayerAvatarConfig) => void
  L: Labels
}) {
  const items = useMemo(() => {
    const list: { id: string | null; name: string }[] = part.options.map((o) => ({ id: o.id, name: o.name }))
    return part.nullable ? [{ id: null, name: L.none }, ...list] : list
  }, [part, L.none])
  const head = part.crop === 'head'
  return (
    <div className={`grid gap-2.5 ${head ? 'grid-cols-4 sm:grid-cols-5' : 'grid-cols-3 sm:grid-cols-4'}`}>
      {items.map((o) => {
        const current = config[part.field] ?? null
        const selected = current === o.id
        const preview = withValue(config, part.field, o.id)
        return (
          <button
            key={o.id ?? 'none'}
            type="button"
            aria-pressed={selected}
            onClick={() => setConfig((c) => withValue(c, part.field, o.id))}
            className={`group relative flex flex-col items-center gap-1.5 rounded-2xl border-2 p-1.5 pb-2 text-center transition ${
              selected ? 'border-brand bg-brand/10' : 'border-transparent bg-surface-2 hover:border-line'
            }`}
          >
            <span className={`block w-full overflow-hidden ${head ? 'aspect-square rounded-full bg-surface' : 'aspect-[3/4] rounded-xl bg-surface'}`}>
              <AthleteSvgScene config={preview} crop={part.crop} />
            </span>
            <span className="line-clamp-2 text-[11px] font-semibold leading-tight text-ink-2 group-aria-pressed:text-ink">{o.name}</span>
            {selected && (
              <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-brand text-brand-ink">
                <Check className="size-3" strokeWidth={3.5} aria-hidden />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function Swatch({ color, label, selected, onClick }: { color: string; label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`relative size-12 rounded-full border-2 transition ${selected ? 'scale-110 border-brand' : 'border-line hover:scale-105'}`}
      style={{ backgroundColor: color }}
    >
      {selected && (
        <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-brand text-brand-ink">
          <Check className="size-3" strokeWidth={3.5} aria-hidden />
        </span>
      )}
    </button>
  )
}
