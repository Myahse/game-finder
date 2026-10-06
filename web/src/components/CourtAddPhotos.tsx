import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, errorMessage, uploadImage } from '../lib/api'
import { resolveMediaUrl } from '../lib/mediaUrl'
import { qk } from '../lib/queries'
import { Plus, X } from './icons'
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
  const [removing, setRemoving] = useState<string | null>(null)
  const [error, setError] = useState('')

  if (!canManage) return null

  const invalidate = () => qc.invalidateQueries({ queryKey: qk.court(courtId) })

  const add = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    setError('')
    try {
      const urls: string[] = []
      for (const f of Array.from(files).slice(0, 6 - photos.length)) {
        urls.push(await uploadImage(f, 'court'))
      }
      await api<{ photos: string[] }>(`/api/courts/${courtId}/photos`, {
        method: 'POST',
        json: { photos: urls },
      })
      await invalidate()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
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
      {photos.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {photos.map((p) => (
            <div key={p} className="relative">
              <img src={resolveMediaUrl(p)} alt="" className="size-20 rounded-xl object-cover" />
              <button
                type="button"
                disabled={removing === p}
                onClick={() => void remove(p)}
                className="absolute -right-1.5 -top-1.5 flex size-7 items-center justify-center rounded-full border border-line bg-surface text-ink shadow hover:bg-surface-2 disabled:opacity-50"
                aria-label={t.courts.removePhoto}
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}
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
