import { useLocale } from '../i18n/LocaleProvider'

/** Blue "you are here" dot with expanding rings — real DOM nodes (Mapbox markers clip pseudo-elements). */
export function UserLocationPulse() {
  const { t } = useLocale()
  return (
    <div
      className="pointer-events-none relative size-14"
      aria-label={t.courts.map.youAreHere}
      role="img"
    >
      <div className="absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2">
        <span className="ftg-loc-ring absolute inset-0 rounded-full bg-[#3b82f6]" aria-hidden />
        <span className="ftg-loc-ring ftg-loc-ring-delay absolute inset-0 rounded-full bg-[#3b82f6]" aria-hidden />
        <span
          className="relative z-10 block size-5 rounded-full border-[3px] border-white bg-[#3b82f6] shadow-[0_2px_8px_rgba(0,0,0,0.22)]"
          aria-hidden
        />
      </div>
    </div>
  )
}
