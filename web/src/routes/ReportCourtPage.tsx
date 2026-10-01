import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, errorMessage } from '../lib/api'
import { reportLabels } from '../lib/format'
import type { ReportType } from '../lib/types'
import { Button, ErrorText, Field, PageHeader, Textarea } from '../components/ui'

export function ReportCourtPage() {
  const { id } = useParams()
  const navigate = useNavigate()
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
        <p className="text-6xl" aria-hidden>
          🙏
        </p>
        <h1 className="display mt-3 text-5xl font-extrabold">Thanks for the report</h1>
        <p className="mt-2 text-ink-2">An admin will review it.</p>
        <Button className="mt-8 w-full" onClick={() => navigate(`/?court=${id}`)}>
          Back to court
        </Button>
      </div>
    )
  }

  return (
    <div className="pb-10">
      <PageHeader title="Report court" back={`/courts/${id}`} />
      <form onSubmit={submit} className="mx-auto grid max-w-md gap-5 p-5">
        <Field label="What's wrong?">
          <div className="grid gap-2">
            {(Object.keys(reportLabels) as ReportType[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setType(k)}
                aria-pressed={type === k}
                className={`rounded-xl border-2 px-4 py-3 text-left font-semibold ${type === k ? 'border-brand bg-brand/10' : 'border-line bg-surface'}`}
              >
                {reportLabels[k]}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Details (optional)">
          <Textarea maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" loading={busy} disabled={!type}>
          Send report
        </Button>
      </form>
    </div>
  )
}
