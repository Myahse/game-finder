import { useEffect, useState } from 'react'
import { SportIcon } from './icons'

/** Photos from Unsplash (Unsplash License), self-hosted in `public/sports`. */
const sportPhotos = [
  { slug: 'basketball', name: 'Basketball', position: '50% 30%' },
  { slug: 'football', name: 'Football', position: '50% 25%' },
  { slug: 'volleyball', name: 'Volleyball', position: '45% 40%' },
  { slug: 'tennis', name: 'Tennis', position: '42% 30%' },
  { slug: 'badminton', name: 'Badminton', position: '55% 30%' },
] as const

const SLIDE_MS = 5500

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Full-bleed sport photos that crossfade one at a time behind the welcome screen.
 * The bottom fades into `--bg`, so light/dark still follows the device.
 */
export function SportPhotoBackdrop() {
  const [index, setIndex] = useState(0)
  const [reduced] = useState(prefersReducedMotion)

  useEffect(() => {
    if (reduced) return
    const id = window.setInterval(() => {
      if (!document.hidden) setIndex((i) => (i + 1) % sportPhotos.length)
    }, SLIDE_MS)
    return () => window.clearInterval(id)
  }, [reduced])

  const current = sportPhotos[index]

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {sportPhotos.map((p, i) => {
        const on = i === index
        return (
          <img
            key={p.slug}
            src={`/sports/${p.slug}-900.webp`}
            srcSet={`/sports/${p.slug}-900.webp 900w, /sports/${p.slug}-1800.webp 1800w`}
            sizes="100vw"
            alt=""
            decoding="async"
            fetchPriority={i === 0 ? 'high' : 'low'}
            style={{ objectPosition: p.position, animationDelay: `${-i * 3}s` }}
            className={`ftg-kenburns absolute inset-0 size-full object-cover transition-opacity duration-[1600ms] ease-in-out ${
              on ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )
      })}

      {/* Readability: darken the top a touch, then melt into the page background behind the text. */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-[68%] bg-gradient-to-t from-bg from-50% via-bg/90 via-75% to-transparent" />

      <div className="absolute inset-x-0 top-[max(1.25rem,env(safe-area-inset-top))] mx-auto flex max-w-md items-center justify-between px-6">
        <span key={current.slug} className="ftg-label-in inline-flex items-center gap-1.5 text-sm font-semibold text-white drop-shadow">
          <SportIcon slug={current.slug} className="size-4" />
          {current.name}
        </span>
        <span className="flex gap-1">
          {sportPhotos.map((p, i) => (
            <span
              key={p.slug}
              className={`h-1 rounded-full bg-white transition-all duration-500 ${i === index ? 'w-5 opacity-100' : 'w-1.5 opacity-50'}`}
            />
          ))}
        </span>
      </div>
    </div>
  )
}
