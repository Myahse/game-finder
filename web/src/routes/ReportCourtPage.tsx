import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, errorMessage } from '../lib/api'
import { reportLabels } from '../lib/format'
import type { ReportType } from '../lib/types'
import { Spring, buzz, burst, centerOf } from '../lib/fx'
import '../styles/motion-part4.css'
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
        <ReportedFlag stamp={t.courts.report.stamp} />
        <h1 className="ftg-rep-after display mt-3 text-5xl font-extrabold">{t.courts.report.thanksTitle}</h1>
        <p className="ftg-rep-after mt-2 text-ink-2">{t.courts.report.thanksBody}</p>
        <Button className="ftg-rep-after mt-8 w-full" onClick={() => navigate(`/?court=${id}`)}>
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
                className={`ftg-reason flex items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-left font-semibold ${type === k ? 'is-on border-danger bg-danger/5' : 'border-line bg-surface'}`}
              >
                {t.games.reports[k]}
                <span className="ftg-reason-dot" aria-hidden />
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

/** After sending: a flag shoots up its pole and waves, then a stamp slams down. */
function ReportedFlag({ stamp }: { stamp: string }) {
  const flag = useRef<SVGGElement>(null)
  const cloth = useRef<SVGPathElement>(null)
  const stampEl = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    let raf = 0
    let phase = 0
    const wave = () => {
      phase += 0.12
      let d = 'M42 22'
      for (let x = 0; x <= 78; x += 3) d += ` L${42 + x} ${22 + Math.sin(phase + x / 14) * (x / 14)}`
      for (let x = 78; x >= 0; x -= 3) d += ` L${42 + x} ${68 + Math.sin(phase + x / 14 + 0.6) * (x / 14)}`
      cloth.current?.setAttribute('d', `${d}Z`)
      raf = requestAnimationFrame(wave)
    }
    wave()
    const rise = new Spring(130, (y) => flag.current?.setAttribute('transform', `translate(0 ${y})`), { k: 160, c: 11 })
    const t1 = window.setTimeout(() => rise.to(0), 150)
    const t2 = window.setTimeout(() => {
      const el = stampEl.current
      if (!el) return
      el.animate(
        [
          { transform: 'translate(-50%, -50%) rotate(-12deg) scale(3)', opacity: 0 },
          { transform: 'translate(-50%, -50%) rotate(-12deg) scale(.92)', opacity: 1, offset: 0.7 },
          { transform: 'translate(-50%, -50%) rotate(-12deg) scale(1)', opacity: 1 },
        ],
        { duration: 360, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' },
      )
      window.setTimeout(() => {
        buzz([18, 30, 18])
        burst(centerOf(el), { n: 18, colors: ['#ef2b54', '#ffffff', '#f2b632'], shape: 'spark', speed: [3, 7], gravity: 0.05, life: [20, 36] })
      }, 260)
    }, 750)
    return () => {
      cancelAnimationFrame(raf)
      rise.stop()
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [])
  return (
    <div className="relative h-44 w-44" aria-hidden>
      <svg viewBox="0 0 150 170" className="size-full overflow-visible">
        <rect x="37" y="14" width="5" height="152" rx="2" fill="var(--ink-2)" />
        <circle cx="39.5" cy="12" r="5" fill="var(--gold, #f2b632)" />
        <g ref={flag}>
          <path ref={cloth} fill="var(--danger)" />
        </g>
      </svg>
      <span ref={stampEl} className="ftg-stamp">{stamp}</span>
    </div>
  )
}
