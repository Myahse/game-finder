import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Glasses, RotateCcw, Scissors, Shirt, Smile } from 'lucide-react'
import type { PlayerAvatarConfig, SportSlug } from '../schema'
import { presetConfig, PRESET_LABELS, sportKit } from '../presets'
import { randomizeAvatar } from '../randomize'
import { EYEBROWS, EYES, EYEWEAR, FACIAL_HAIR, HAIR_COLORS, HAIRS, HEADWEAR, KIT_COLORS, MOUTHS, SKIN_TONES, SPORTS, TOPS } from '../registry'
import { SKIN_HEX } from '../colors'
import { HAIR_COLORS as HAIR_HEX } from '../render/palette'
import { kitOf } from '../render/kit'
import { AvatarPortrait } from '../render/AvatarPortrait'
import { Button, ErrorText, PageHeader } from '../../components/ui'
import { api, errorMessage } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import type { Me } from '../../lib/types'
import { useLocale } from '../../i18n/LocaleProvider'
import { buzz, centerOf, replay, sparkle, Spring } from '../../lib/fx'
import { floodFrom } from '../../lib/onboardMotion'
import '../../styles/motion-onboard.css'

type Field = keyof PlayerAvatarConfig
type Labels = ReturnType<typeof useLocale>['t']['avatarStudio']

type Item = { id: string; name: string; hex?: string }

type Part =
  | { id: string; label: keyof Labels; kind: 'options'; field: Field; options: Item[]; crop: 'head' | 'full'; nullable?: boolean }
  | { id: string; label: keyof Labels; kind: 'kitColors' }
  | { id: string; label: keyof Labels; kind: 'skin' }
  | { id: string; label: keyof Labels; kind: 'hairColor' }

type Group = { id: string; label: keyof Labels; icon: ReactNode; parts: Part[] }

/** Called when a colour swatch is tapped: floods the preview with that colour from the swatch. */
type OnColor = (color: string, from: HTMLElement) => void

/** Tops that look different as a portrait (the rest share a neckline). */
const PORTRAIT_TOPS = TOPS.filter((t) => ['top_basketball_jersey', 'top_football_jersey', 'top_tennis_shirt', 'top_tee', 'top_hoodie'].includes(t.id))
/** Sports with a club in the app; picking one sets the kit colours and shirt. */
const PORTRAIT_SPORTS = SPORTS.filter((s) => ['basketball', 'football', 'volleyball', 'tennis', 'badminton'].includes(s.id))

const opt = (id: string, label: keyof Labels, field: Field, options: Item[], crop: 'head' | 'full', nullable = false): Part => ({
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
    id: 'face',
    label: 'groupFace',
    icon: <Smile className="size-5" aria-hidden />,
    parts: [
      { id: 'skin', label: 'skin', kind: 'skin' },
      opt('eyes', 'eyes', 'eyes', EYES, 'head'),
      opt('brows', 'brows', 'eyebrows', EYEBROWS, 'head'),
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
    parts: [opt('sport', 'sport', 'sport', PORTRAIT_SPORTS, 'head'), { id: 'colours', label: 'colours', kind: 'kitColors' }, opt('top', 'top', 'top', PORTRAIT_TOPS, 'head')],
  },
  {
    id: 'extras',
    label: 'groupExtras',
    icon: <Glasses className="size-5" aria-hidden />,
    parts: [opt('headwear', 'headwear', 'headwear', HEADWEAR, 'head', true), opt('eyewear', 'eyewear', 'eyewear', EYEWEAR, 'head', true)],
  },
]

/** Apply one choice; picking a sport also dresses the player in that sport's kit. */
function withValue(c: PlayerAvatarConfig, field: Field, value: unknown): PlayerAvatarConfig {
  if (field === 'sport') return { ...c, ...sportKit(value as SportSlug), sport: value as SportSlug }
  return { ...c, [field]: value }
}

function kitTint(c: PlayerAvatarConfig) {
  const tone = kitOf(c).accent
  return `radial-gradient(120% 80% at 50% 100%, color-mix(in srgb, ${tone} 22%, transparent), transparent 70%), linear-gradient(180deg, var(--surface-2), var(--surface))`
}

export function AvatarStudio({
  initial,
  onSaved,
  title,
  back = '/profile',
  skip,
}: {
  initial: PlayerAvatarConfig
  onSaved?: () => void
  title?: string
  back?: string
  /** Extra header action, e.g. "Skip" during sign-up. */
  skip?: ReactNode
}) {
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
  const preview = useRef<HTMLDivElement>(null)
  const spinEl = useRef<HTMLDivElement>(null)
  // While the wardrobe spins, other random players flash by; the saved config is already the final one.
  const [look, setLook] = useState<PlayerAvatarConfig | null>(null)
  const spin = useRef<{ th: Spring; seg: number; end: number } | null>(null)

  const land = () => {
    const el = spinEl.current
    if (!el) return
    replay(el, 'ftg-onboard-land')
    buzz([10, 30, 15])
    const c = centerOf(el)
    sparkle({ x: c.x, y: c.y - 40 }, 16)
  }

  const roll = () => {
    const next = randomizeAvatar(config)
    setConfig(next)
    let sp = spin.current
    if (!sp) {
      const state = { seg: 0, end: 0 }
      const th = new Spring(0, (v) => {
        const seg = Math.floor((v + 90) / 180)
        if (seg !== state.seg) {
          state.seg = seg
          setLook(seg >= state.end ? null : randomizeAvatar())
        }
        // Edge-on at ±90°, then the next player turns in from the other side.
        const a = ((((v + 90) % 180) + 180) % 180) - 90
        if (spinEl.current) spinEl.current.style.transform = a ? `perspective(500px) rotateY(${a}deg)` : ''
      }, { k: 46, c: 9, precision: 0.05 })
      th.done = land
      sp = spin.current = Object.assign(state, { th })
    }
    sp.end = Math.round(sp.th.t / 180) + 5 + Math.round(Math.random())
    sp.th.to(sp.end * 180)
  }
  useLayoutEffect(() => () => spin.current?.th.stop(), [])

  const onColor: OnColor = (color, from) => {
    const box = preview.current
    if (!box) return
    floodFrom(box, centerOf(from), color, { hold: 120 })
    buzz(5)
    replay(from.querySelector('.ftg-onboard-swr'), 'ftg-onboard-swring')
    window.setTimeout(() => replay(spinEl.current, 'ftg-onboard-land'), 180)
  }
  const shown = look ?? config

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
      <PageHeader
        title={title ?? L.title}
        back={back}
        right={
          <span className="flex items-center gap-1">
            {skip}
            {saveButton(L.save, 'min-h-10 px-4 text-base lg:hidden')}
          </span>
        }
      />
      <div className="mx-auto w-full max-w-5xl px-4 pb-8 pt-4 lg:grid lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:gap-8 lg:pb-10">
        {/* Preview */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div
            ref={preview}
            className="relative aspect-square max-h-[42vh] w-full overflow-hidden rounded-3xl border border-line lg:max-h-none"
            style={{ background: kitTint(shown) }}
          >
            {/* Spins like a wardrobe on "random"; lands with a squash. */}
            <div ref={spinEl} className="ftg-onboard-spin absolute inset-x-[8%] bottom-0 top-[6%] z-[1]">
              {/* Re-mount on every change so the player "pops" with the new look; idle bob after. */}
              <div key={JSON.stringify(shown)} className="ftg-av-pop h-full w-full">
                <AvatarPortrait config={shown} live={false} className="ftg-av-breathe h-full w-full" />
              </div>
            </div>
            <div className="absolute right-3 top-3 z-[2] flex gap-2">
              <DiceButton label={L.randomize} onRoll={roll} />
              <IconButton label={L.reset} onClick={() => setConfig(initial)}>
                <RotateCcw className="size-5" aria-hidden />
              </IconButton>
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
                    <AvatarPortrait config={preset} className="h-full w-full" />
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
            <PartEditor part={part} config={config} setConfig={setConfig} L={L} onColor={onColor} />
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

const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }
const FACES_3D = ['rotateY(0deg)', 'rotateY(180deg)', 'rotateY(90deg)', 'rotateY(-90deg)', 'rotateX(90deg)', 'rotateX(-90deg)']

/** "Random": a real little 3D die that hops and tumbles to a new face on every roll. */
function DiceButton({ label, onRoll }: { label: string; onRoll: () => void }) {
  const cube = useRef<HTMLSpanElement>(null)
  const springs = useRef<{ rx: Spring; ry: Spring; hy: Spring } | null>(null)
  useLayoutEffect(() => {
    const s: { rx?: Spring; ry?: Spring; hy?: Spring } = {}
    const draw = () => {
      if (cube.current && s.rx && s.ry && s.hy) cube.current.style.transform = `translateY(${s.hy.x}px) rotateX(${s.rx.x}deg) rotateY(${s.ry.x}deg)`
    }
    s.rx = new Spring(-20, draw, { k: 70, c: 11 })
    s.ry = new Spring(30, draw, { k: 70, c: 11 })
    s.hy = new Spring(0, draw, { k: 260, c: 11, precision: 0.05 })
    draw()
    springs.current = s as { rx: Spring; ry: Spring; hy: Spring }
    return () => [s.rx, s.ry, s.hy].forEach((x) => x?.stop())
  }, [])
  const roll = () => {
    const s = springs.current
    if (s) {
      buzz(8)
      s.hy.kick(-420)
      s.rx.to(Math.round(s.rx.t / 90) * 90 + 90 * (4 + Math.floor(Math.random() * 4)))
      s.ry.to(Math.round(s.ry.t / 90) * 90 + 90 * (3 + Math.floor(Math.random() * 4)))
    }
    onRoll()
  }
  return (
    <IconButton label={label} onClick={roll}>
      <span className="[perspective:300px]" aria-hidden>
        <span ref={cube} className="ftg-onboard-dcube block">
          {[1, 6, 2, 5, 3, 4].map((n, i) => (
            <b key={n} className={`f${n}`} style={{ transform: `${FACES_3D[i]} translateZ(10px)` }}>
              {Array.from({ length: 9 }, (_, j) => (PIPS[n].includes(j) ? <i key={j} /> : <span key={j} />))}
            </b>
          ))}
        </span>
      </span>
    </IconButton>
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
  onColor,
}: {
  part: Part
  config: PlayerAvatarConfig
  setConfig: (fn: (c: PlayerAvatarConfig) => PlayerAvatarConfig) => void
  L: Labels
  onColor?: OnColor
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
            onColor={onColor}
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
            onColor={onColor}
            onClick={() => setConfig((c) => ({ ...c, hairColor: h.id }))}
          />
        ))}
      </div>
    )
  }
  if (part.kind === 'kitColors') return <KitColors config={config} setConfig={setConfig} L={L} onColor={onColor} />
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
    // Option names are locale getters; depend on L so a language change re-reads them.
    const list: { id: string | null; name: string }[] = part.options.map((o) => ({ id: o.id, name: o.name }))
    return part.nullable ? [{ id: null, name: L.none }, ...list] : list
  }, [part, L])
  const head = true
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
              <AvatarPortrait config={preview} className="h-full w-full" />
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

function KitColors({
  config,
  setConfig,
  L,
  onColor,
}: {
  config: PlayerAvatarConfig
  setConfig: (fn: (c: PlayerAvatarConfig) => PlayerAvatarConfig) => void
  L: Labels
  onColor?: OnColor
}) {
  const kit = kitOf(config)
  const custom = !!(config.kitMain || config.kitTrim)
  const row = (field: 'kitMain' | 'kitTrim', label: string, effective: string) => (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-2">{label}</p>
      <div className="flex flex-wrap gap-2.5">
        {KIT_COLORS.map((k) => (
          <Swatch
            key={k.id}
            small
            color={k.hex}
            label={k.name}
            selected={config[field] ? config[field] === k.id : k.hex === effective}
            onColor={onColor}
            onClick={() => setConfig((c) => ({ ...c, [field]: k.id }))}
          />
        ))}
      </div>
    </div>
  )
  return (
    <div className="grid gap-4 rounded-2xl border border-line bg-surface p-4">
      {row('kitMain', L.kitMain, kit.main)}
      {row('kitTrim', L.kitTrim, kit.trim)}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="grid gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-ink-2">{L.number}</span>
          <span className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={99}
              placeholder={kit.number || '–'}
              value={config.number ?? ''}
              onChange={(e) => {
                const raw = e.target.value
                const n = raw === '' ? null : Math.max(0, Math.min(99, Math.round(Number(raw))))
                setConfig((c) => ({ ...c, number: Number.isNaN(n) ? null : n }))
              }}
              className="display w-20 rounded-xl border border-line bg-surface px-3 py-2 text-center text-2xl font-extrabold outline-none focus:border-brand"
            />
            {config.number != null && (
              <button type="button" onClick={() => setConfig((c) => ({ ...c, number: null }))} className="text-sm font-semibold text-ink-2 hover:text-ink">
                {L.numberAuto}
              </button>
            )}
          </span>
        </label>
        {custom && (
          <button
            type="button"
            onClick={() => setConfig((c) => ({ ...c, kitMain: null, kitTrim: null }))}
            className="rounded-full bg-surface-2 px-3.5 py-1.5 text-sm font-semibold hover:bg-line"
          >
            {L.sportColours}
          </button>
        )}
      </div>
    </div>
  )
}

function Swatch({
  color,
  label,
  selected,
  onClick,
  small,
  onColor,
}: {
  color: string
  label: string
  selected: boolean
  onClick: () => void
  small?: boolean
  onColor?: OnColor
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      title={label}
      onClick={(e) => {
        onClick()
        onColor?.(color, e.currentTarget)
      }}
      className={`relative ${small ? 'size-9' : 'size-12'} rounded-full border-2 transition ${selected ? 'scale-110 border-brand' : 'border-line hover:scale-105'}`}
      style={{ backgroundColor: color }}
    >
      <span className="ftg-onboard-swr pointer-events-none absolute inset-0 rounded-full" aria-hidden />
      {selected && (
        <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-brand text-brand-ink">
          <Check className="size-3" strokeWidth={3.5} aria-hidden />
        </span>
      )}
    </button>
  )
}
