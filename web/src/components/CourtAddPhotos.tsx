import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, errorMessage, uploadImage } from '../lib/api'
import { qk } from '../lib/queries'
import { Plus } from './icons'
import { Button, ErrorText } from './ui'

type Props = {
  courtId: string
  photos: string[]
  canAdd: boolean
}

/** Lets the court proposer add more photos (up to 6 total). */
export function CourtAddPhotos({ courtId, photos, canAdd }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  if (!canAdd || photos.length >= 6) return null

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
      await qc.invalidateQueries({ queryKey: qk.court(courtId) })
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="px-4 pt-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => add(e.target.files)}
      />
      <Button
        type="button"
        variant="secondary"
        loading={uploading}
        className="w-full"
        onClick={() => inputRef.current?.click()}
      >
        <Plus className="size-5" aria-hidden />
        {photos.length === 0 ? 'Add court photos' : 'Add more photos'}
      </Button>
      <p className="mt-1 text-center text-xs text-ink-2">
        {photos.length}/6 photos · only you can add photos to a court you proposed
      </p>
      {error && (
        <p className="mt-2">
          <ErrorText>{error}</ErrorText>
        </p>
      )}
    </div>
  )
}
