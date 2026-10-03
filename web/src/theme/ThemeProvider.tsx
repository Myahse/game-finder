import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Toaster } from 'sonner'

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
