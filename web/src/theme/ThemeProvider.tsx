import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Toaster } from 'sonner'
import '../styles/motion-feedback.css'

export type ResolvedTheme = 'light' | 'dark'

type ThemeContextValue = {
  theme: ResolvedTheme
  isDark: boolean
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'light', isDark: false })

export function readSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyDocumentTheme(theme: ResolvedTheme) {
  const root = document.documentElement
  root.dataset.theme = theme
  root.style.colorScheme = theme

  const bg = theme === 'dark' ? '#0b0e12' : '#f6f4f0'
  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (themeColor) themeColor.content = bg

  const appleBar = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-status-bar-style"]')
  if (appleBar) appleBar.content = theme === 'dark' ? 'black-translucent' : 'default'
}

/** Single listener for system light/dark — drives CSS tokens, maps, Sonner, and browser chrome. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ResolvedTheme>(() => readSystemTheme())

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const on = () => setTheme(mq.matches ? 'dark' : 'light')
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  useEffect(() => {
    applyDocumentTheme(theme)
  }, [theme])

  const value = useMemo(() => ({ theme, isDark: theme === 'dark' }), [theme])

  return (
    <ThemeContext.Provider value={value}>
      {children}
      <Toaster
        theme={theme}
        position="top-center"
        closeButton
        richColors
        icons={{
          // The check and the cross draw themselves (styles/motion-feedback.css).
          success: (
            <svg className="ftg-toast-ico" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="10" cy="10" r="8.6" transform="rotate(-90 10 10)" />
              <path d="M6 10.4l2.7 2.7L14.2 7.4" />
            </svg>
          ),
          error: (
            <svg className="ftg-toast-ico is-error" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
              <circle cx="10" cy="10" r="8.6" transform="rotate(-90 10 10)" />
              <path d="M7.2 7.2l5.6 5.6M12.8 7.2l-5.6 5.6" />
            </svg>
          ),
        }}
        toastOptions={{
          classNames: {
            toast: 'ftg-sonner-toast',
            title: 'font-semibold',
            description: 'text-ink-2',
          },
        }}
      />
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}

/** @deprecated Prefer `useTheme().isDark` */
export function usePrefersColorScheme() {
  return useTheme().isDark
}
