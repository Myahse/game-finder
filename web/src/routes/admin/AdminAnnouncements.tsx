import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { ImagePlus } from 'lucide-react'
import { errorMessage, uploadImage } from '../../lib/api'
import { resolveMediaUrl } from '../../lib/mediaUrl'
import { useAdminAnnouncements, useCreateAnnouncement, useSetAnnouncementActive, type AnnouncementDraft } from '../../lib/announcements'
import { AnnouncementCard } from '../../components/AnnouncementModal'
import { Button, Card, ErrorText, Field, Input, Select, Textarea } from '../../components/ui'
import { Loading } from '../CourtPage'
import { useLocale } from '../../i18n/LocaleProvider'

const LINKS = ['', '/play', '/', '/challenges', '/profile', '/courts/new', 'custom'] as const

/** Admin: send a flyer to everyone (notification + one-time pop-up), and see past ones. */
export function AdminAnnouncements() {
  const { t, locale } = useLocale()
  const a = t.announcements
  const list = useAdminAnnouncements()
  const create = useCreateAnnouncement()
  const toggle = useSetAnnouncementActive()
  const fileRef = useRef<HTMLInputElement>(null)
  const [d, setD] = useState<AnnouncementDraft>({ title: '', body: '', image_url: '', link_url: '', cta_label: '', notify: true })
  const [linkKind, setLinkKind] = useState<(typeof LINKS)[number]>('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const set = <K extends keyof AnnouncementDraft>(k: K, v: AnnouncementDraft[K]) => setD((x) => ({ ...x, [k]: v }))

  const linkLabel: Record<(typeof LINKS)[number], string> = { '': a.linkNone, '/play': a.linkPlay, '/': a.linkMap, '/challenges': a.linkChallenges, '/profile': a.linkProfile, '/courts/new': a.linkAddCourt, custom: a.linkCustom }
  const link = linkKind === 'custom' ? d.link_url : linkKind

  const pick = async (f: File | undefined) => {
    if (!f) return
    setUploading(true)
    setError('')
    try {
      set('image_url', await uploadImage(f, 'announcement'))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }
  const send = () => {
    if (d.notify && !window.confirm(a.confirmSend)) return
    setError('')
    create.mutate(
      { ...d, link_url: link },
      {
        onSuccess: (res) => {
          toast.success(d.notify ? a.sent.replace('{n}', String(res.notified ?? 0)) : a.published)
          setD({ title: '', body: '', image_url: '', link_url: '', cta_label: '', notify: true })
          setLinkKind('')
        },
        onError: (e) => setError(errorMessage(e)),
      },
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,420px)]">
      <div className="grid content-start gap-4">
        <div>
          <h2 className="display text-2xl font-extrabold">{a.adminTitle}</h2>
          <p className="mt-1 text-sm text-ink-2">{a.adminHint}</p>
        </div>
        <Field label={a.flyer} hint={a.flyerHint}>
          <div className="flex items-center gap-3">
            {d.image_url && <img src={resolveMediaUrl(d.image_url)} alt="" className="h-24 w-auto rounded-lg border border-line object-cover" />}
            <Button type="button" variant="secondary" loading={uploading} onClick={() => fileRef.current?.click()}>
              <ImagePlus className="size-5" aria-hidden /> {uploading ? a.uploading : d.image_url ? a.changeImage : a.pickImage}
            </Button>
            {d.image_url && !uploading && (
              <Button type="button" variant="ghost" onClick={() => set('image_url', '')}>
                {a.removeImage}
              </Button>
            )}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
          </div>
        </Field>
        <Field label={a.title}>
          <Input maxLength={120} placeholder={a.titlePlaceholder} value={d.title} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <Field label={a.body}>
          <Textarea maxLength={1000} rows={3} placeholder={a.bodyPlaceholder} value={d.body} onChange={(e) => set('body', e.target.value)} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={a.link}>
            <Select value={linkKind} onChange={(e) => setLinkKind(e.target.value as (typeof LINKS)[number])}>
              {LINKS.map((k) => (
                <option key={k} value={k}>{linkLabel[k]}</option>
              ))}
            </Select>
          </Field>
          {linkKind !== '' && (
            <Field label={a.ctaLabel}>
              <Input maxLength={40} placeholder={a.ctaPlaceholder} value={d.cta_label} onChange={(e) => set('cta_label', e.target.value)} />
            </Field>
          )}
        </div>
        {linkKind === 'custom' && (
          <Field label={a.customUrl}>
            <Input type="url" placeholder="https://" value={d.link_url} onChange={(e) => set('link_url', e.target.value)} />
          </Field>
        )}
        <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold">
          <input type="checkbox" className="size-4 accent-brand" checked={d.notify} onChange={(e) => set('notify', e.target.checked)} />
          {a.notify}
        </label>
        <ErrorText>{error}</ErrorText>
        <Button type="button" onClick={send} loading={create.isPending} disabled={!d.title.trim() || uploading}>
          {d.notify ? a.send : a.sendNoNotify}
        </Button>

        <h3 className="display mt-4 text-xl font-extrabold">{a.history}</h3>
        {list.isLoading ? (
          <Loading />
        ) : !list.data?.length ? (
          <p className="text-sm text-ink-2">{a.empty}</p>
        ) : (
          <div className="grid gap-2">
            {list.data.map((x) => (
              <Card key={x.id} className="flex items-center gap-3">
                {x.image_url ? <img src={resolveMediaUrl(x.image_url)} alt="" className="size-14 shrink-0 rounded-lg object-cover" /> : <span className="size-14 shrink-0 rounded-lg bg-surface-2" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{x.title}</p>
                  <p className="text-xs text-ink-2">
                    {new Date(x.created_at).toLocaleDateString(locale)} · {a.stats.replace('{n}', String(x.notified ?? 0)).replace('{s}', String(x.seen ?? 0))}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${x.active ? 'bg-live/15 text-live' : 'bg-surface-2 text-ink-2'}`}>{x.active ? a.active : a.inactive}</span>
                <Button type="button" variant="ghost" className="min-h-9 px-3 text-sm" loading={toggle.isPending && toggle.variables?.id === x.id} onClick={() => toggle.mutate({ id: x.id, active: !x.active })}>
                  {x.active ? a.hide : a.show}
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
      <div className="lg:sticky lg:top-4 lg:self-start">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-2">{a.preview}</p>
        <div className="flex justify-center rounded-3xl bg-black/50 p-4">
          <AnnouncementCard inline a={{ title: d.title || a.titlePlaceholder, body: d.body, image_url: d.image_url || null, link_url: link || null, cta_label: d.cta_label || null }} onClose={() => {}} onCta={() => {}} />
        </div>
      </div>
    </div>
  )
}
