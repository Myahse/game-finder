import { useEffect } from 'react'

const SITE = 'https://www.outforground.com'

/**
 * Title, description and canonical URL for a public page. The app is a single page, so every
 * URL starts with the home page's tags (index.html); Google renders the page and reads these.
 * Restores the previous values when the page closes.
 */
export function usePageSeo({ title, description, path }: { title: string; description?: string; path: string }) {
  useEffect(() => {
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    const desc = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    const prev = { title: document.title, canonical: canonical?.href, desc: desc?.content }
    document.title = `${title} — Out For Ground`
    if (canonical) canonical.href = SITE + path
    if (desc && description) desc.content = description
    return () => {
      document.title = prev.title
      if (canonical && prev.canonical) canonical.href = prev.canonical
      if (desc && prev.desc) desc.content = prev.desc
    }
  }, [title, description, path])
}
