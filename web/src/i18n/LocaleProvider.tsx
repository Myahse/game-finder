import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { deviceLocale } from './deviceLocale'
import { messages, type Locale, type MessageTree } from './messages'

type LocaleContextValue = {
  locale: Locale
  t: MessageTree
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => deviceLocale())

  useEffect(() => {
    const sync = () => setLocale(deviceLocale())
    sync()
    window.addEventListener('languagechange', sync)
    return () => window.removeEventListener('languagechange', sync)
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const value = useMemo(() => ({ locale, t: messages[locale] }), [locale])

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider')
  return ctx
}

/** Strings for code outside React components (formatters, error mapping). Follows the device language. */
export function currentT(): MessageTree {
  return messages[deviceLocale()]
}

export function currentLocale(): Locale {
  return deviceLocale()
}
