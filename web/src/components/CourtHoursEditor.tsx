import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, errorMessage } from '../lib/api'
import { formatOpeningHours, parseOpeningHours } from '../lib/openingHours'
import { qk } from '../lib/queries'
import { Button, ErrorText, Field, Input } from './ui'
import { useLocale } from '../i18n/LocaleProvider'

type Props = {
  courtId: string
  openingHours: string | null
  canEdit: boolean
}

export function CourtHoursEditor({ courtId, openingHours, canEdit }: Props) {
  const qc = useQueryClient()
  const { t } = useLocale()
  const parsed = parseOpeningHours(openingHours)
  const [opens, setOpens] = useState(parsed?.opens ?? '')
  const [closes, setCloses] = useState(parsed?.closes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const p = parseOpeningHours(openingHours)
    setOpens(p?.opens ?? '')
    setCloses(p?.closes ?? '')
  }, [openingHours])

  if (!canEdit) return null

  const save = async () => {
    setBusy(true)
    setError('')
    try {
      const body =
        opens.trim() && closes.trim()
          ? { opens_at: opens.trim(), closes_at: closes.trim() }
          : { opens_at: null, closes_at: null }
      await api<{ opening_hours: string | null }>(`/api/courts/${courtId}/hours`, {
        method: 'PATCH',
        json: body,
      })
      await qc.invalidateQueries({ queryKey: qk.court(courtId) })
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const preview =
    opens.trim() && closes.trim() ? formatOpeningHours(opens.trim(), closes.trim()) : openingHours

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <h3 className="display text-lg font-bold">{t.courts.openingHours}</h3>
      <p className="mt-1 text-xs text-ink-2">{t.courts.hours.hint}</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label={t.courts.opens}>
          <Input type="time" value={opens} onChange={(e) => setOpens(e.target.value)} />
        </Field>
        <Field label={t.courts.closes}>
          <Input type="time" value={closes} onChange={(e) => setCloses(e.target.value)} />
        </Field>
      </div>
      {preview && <p className="mt-2 text-sm text-ink-2">{t.courts.hours.shownAs.replace('{hours}', preview)}</p>}
      <Button type="button" className="mt-3 w-full" loading={busy} onClick={save}>
        {t.courts.hours.save}
      </Button>
      {error && (
        <p className="mt-2">
          <ErrorText>{error}</ErrorText>
        </p>
      )}
    </div>
  )
}
