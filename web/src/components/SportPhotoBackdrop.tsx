import { prefersReducedMotion } from '../lib/motion'
import { useEffect, useState } from 'react'
import { sportPhotos } from '../content/sportPhotos'

const SLIDE_MS = 5500


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

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* Phones: top of the screen (tight crop keeps players in view). Large screens: a panel on the right. */}
      <div className="absolute inset-x-0 top-0 h-[64%] overflow-hidden lg:inset-y-0 lg:left-auto lg:h-full lg:w-[56%]">
        {sportPhotos.map((p, i) => {
          const on = i === index
          return (
            <img
              key={p.slug}
              src={`/sports/${p.slug}-900.webp`}
              srcSet={`/sports/${p.slug}-900.webp 900w, /sports/${p.slug}-1800.webp 1800w`}
              sizes="(min-width: 1024px) 56vw, 100vw"
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
        <div className="absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-bg from-20% via-bg/80 to-transparent lg:hidden" />
        <div className="absolute inset-y-0 left-0 hidden w-2/5 bg-gradient-to-r from-bg via-bg/60 to-transparent lg:block" />
      </div>

    </div>
  )
}
