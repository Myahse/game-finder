import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { LocaleProvider } from './i18n/LocaleProvider'
import { router } from './router'
import './index.css'
import { Toaster } from 'sonner'
import { registerSW } from 'virtual:pwa-register'
import { initMonitoring } from './lib/monitoring'

initMonitoring()

if (import.meta.env.PROD) {
  registerSW({ immediate: true })
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: true },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LocaleProvider>
          <RouterProvider router={router} />
        </LocaleProvider>
        <Toaster
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
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
