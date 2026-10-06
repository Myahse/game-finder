import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, errorMessage } from '../lib/api'
import { reportLabels } from '../lib/format'
import type { ReportType } from '../lib/types'
import { CheckCircle } from '../components/icons'
import { Button, ErrorText, Field, PageHeader, Textarea } from '../components/ui'
import { useLocale } from '../i18n/LocaleProvider'

export function ReportCourtPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useLocale()
  const [type, setType] = useState<ReportType | null>(null)
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!type) return
    setBusy(true)
    setError('')
    try {
      await api(`/api/courts/${id}/reports`, { method: 'POST', json: { type, description } })
      setSent(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center p-8 text-center">
        <CheckCircle className="size-16 text-brand" strokeWidth={1.5} aria-hidden />
        <h1 className="display mt-3 text-5xl font-extrabold">{t.courts.report.thanksTitle}</h1>
        <p className="mt-2 text-ink-2">{t.courts.report.thanksBody}</p>
        <Button className="mt-8 w-full" onClick={() => navigate(`/?court=${id}`)}>
          {t.courts.report.backToCourt}
        </Button>
      </div>
    )
  }

  return (
    <div className="pb-10">
      <PageHeader title={t.courts.report.title} back={`/courts/${id}`} />
      <form onSubmit={submit} className="mx-auto grid max-w-md gap-5 p-5">
        <Field label={t.courts.report.whatsWrong}>
          <div className="grid gap-2">
            {(Object.keys(reportLabels) as ReportType[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setType(k)}
                aria-pressed={type === k}
                className={`rounded-xl border-2 px-4 py-3 text-left font-semibold ${type === k ? 'border-brand bg-brand/10' : 'border-line bg-surface'}`}
              >
                {t.games.reports[k]}
              </button>
            ))}
          </div>
        </Field>
        <Field label={t.courts.report.details}>
          <Textarea maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" loading={busy} disabled={!type}>
          {t.courts.report.send}
        </Button>
      </form>
    </div>
  )
}
