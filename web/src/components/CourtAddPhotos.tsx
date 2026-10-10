import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, errorMessage, uploadImage } from '../lib/api'
import { qk } from '../lib/queries'
import { Plus } from './icons'
import { PhotoPolaroids, type PendingPhoto } from './PhotoPolaroids'
import { Button, ErrorText } from './ui'
import { useLocale } from '../i18n/LocaleProvider'

type Props = {
  courtId: string
  photos: string[]
  canManage: boolean
}

/** Lets the court proposer add or remove photos (up to 6 total). */
export function CourtAddPhotos({ courtId, photos, canManage }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { t } = useLocale()
  const qc = useQueryClient()
  const [uploading, setUploading] = useState(false)
  const [pending, setPending] = useState<PendingPhoto[]>([])
  const [removing, setRemoving] = useState<string | null>(null)
  const [error, setError] = useState('')

  if (!canManage) return null

  const invalidate = () => qc.invalidateQueries({ queryKey: qk.court(courtId) })

  const add = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    setError('')
    const chosen = Array.from(files).slice(0, 6 - photos.length)
    const slots = chosen.map((f, i) => ({ key: `${Date.now()}-${i}`, preview: URL.createObjectURL(f), done: false }))
    setPending(slots)
    try {
      const urls: string[] = []
      for (const f of chosen) {
        urls.push(await uploadImage(f, 'court'))
      }
      await api<{ photos: string[] }>(`/api/courts/${courtId}/photos`, {
        method: 'POST',
        json: { photos: urls },
      })
      // Fill the water to the top, then the polaroids drop in.
      setPending((p) => p.map((x) => ({ ...x, done: true })))
      await new Promise((r) => window.setTimeout(r, 350))
      await invalidate()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      slots.forEach((s) => URL.revokeObjectURL(s.preview))
      setPending([])
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const remove = async (url: string) => {
    setRemoving(url)
    setError('')
    try {
      await api<{ photos: string[] }>(`/api/courts/${courtId}/photos`, {
        method: 'DELETE',
        json: { photos: [url] },
      })
      await invalidate()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setRemoving(null)
    }
  }

  return (
    <div className="px-4 pt-2">
      <div className="mb-3">
        <PhotoPolaroids photos={photos} pending={pending} removing={removing} onRemove={(p) => void remove(p)} removeLabel={t.courts.removePhoto} />
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => add(e.target.files)}
      />
      {photos.length < 6 && (
        <Button
          type="button"
          variant="secondary"
          loading={uploading}
          className="w-full min-h-11 text-base"
          onClick={() => inputRef.current?.click()}
        >
          <Plus className="size-5" aria-hidden />
          {photos.length === 0 ? t.courts.photos.addFirst : t.courts.photos.addMore}
        </Button>
      )}
      <p className="mt-1 text-center text-xs text-ink-2">
        {t.courts.photos.count.replace('{n}', String(photos.length))}
      </p>
      {error && (
        <p className="mt-2">
          <ErrorText>{error}</ErrorText>
        </p>
      )}
    </div>
  )
}
