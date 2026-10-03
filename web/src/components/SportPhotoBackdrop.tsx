import { useEffect, useState } from 'react'
import { SportIcon } from './icons'

const commons = (file: string) => `https://commons.wikimedia.org/wiki/File:${file}`

/**
 * Photos from Wikimedia Commons, self-hosted in `public/sports` (resized to webp, otherwise unaltered).
 * CC BY / BY-SA require the credit shown on each slide — keep `credit` in sync if a photo changes.
 */
const sportPhotos = [
  {
    slug: 'basketball',
    name: 'Basketball',
    position: '15% 50%',
    credit: {
      author: 'James Moore200',
      license: 'CC BY-SA 4.0',
      href: commons('Basketball_players_10.jpg'),
    },
  },
  {
    slug: 'football',
    name: 'Football',
    position: '62% 50%',
    credit: {
      author: 'Tahiru Rajab',
      license: 'CC BY-SA 4.0',
      href: commons('Night_Football_matches_In_Northern_Ghana_13.jpg'),
    },
  },
  {
    slug: 'volleyball',
    name: 'Volleyball',
    position: '50% 15%',
    credit: {
      author: 'Astro Medya',
      license: 'CC BY 2.0',
      href: commons('5._Islamic_Solidarity_Games_2021_Konya_Women_Volleyball_Sudan_-_Cameroon_20220813_2.jpg'),
    },
  },
  {
    slug: 'tennis',
    name: 'Tennis',
    position: '4% 50%',
    credit: {
      author: 'Godstime Elijah',
      license: 'CC BY-SA 4.0',
      href: commons('Lawn_tennis_training_session_at_unilorin_9.jpg'),
    },
  },
  {
    slug: 'badminton',
    name: 'Badminton',
    position: '60% 50%',
    credit: {
      author: 'Samson Ssemakadde',
      license: 'CC0',
      href: commons('Schools_badminton_in_Lugogo023.jpg'),
    },
  },
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
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Photos fill the top of the screen only, so wide shots crop tight enough to keep the players in view. */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-[64%] overflow-hidden">
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
              style={{
                objectPosition: p.position,
                animationDelay: `${-i * 3}s`,
              }}
              className={`ftg-kenburns absolute inset-0 size-full object-cover transition-opacity duration-[1600ms] ease-in-out ${
                on ? 'opacity-100' : 'opacity-0'
              }`}
            />
          )
        })}

        {/* Readability: darken the top a touch, then melt into the page background behind the text. */}
        <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-black/45 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-bg from-20% via-bg/80 to-transparent" />
      </div>

      <div className="absolute inset-x-0 top-[max(1.25rem,env(safe-area-inset-top))] mx-auto flex max-w-md items-start justify-between px-6">
        <span key={current.slug} className="ftg-label-in grid gap-0.5 drop-shadow">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-white" aria-hidden>
            <SportIcon slug={current.slug} className="size-4" />
            {current.name}
          </span>
          <a
            href={current.credit.href}
            target="_blank"
            rel="noreferrer"
            className="pointer-events-auto text-[10px] font-medium text-white/70 hover:text-white hover:underline"
          >
            Photo: {current.credit.author} · {current.credit.license}
          </a>
        </span>
        <span className="mt-1.5 flex gap-1" aria-hidden>
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
