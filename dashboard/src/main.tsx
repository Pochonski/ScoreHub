import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import '@/presentation/styles/globals.css'
import { validateEnv } from '@/infrastructure/security/envValidator'
import RouteReporter from '@/shared/embed/RouteReporter'
import App from './App'

validateEnv()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

/**
 * TanStack Query client shared across the app.
 *
 * Defaults:
 *   - staleTime: 30s  — data shown immediately, then refetched in
 *                       background. Keeps things snappy for live data
 *                       like games.
 *   - gcTime:    5min — cached data lingers for 5 min after last use.
 *   - refetchOnWindowFocus: false — Egress 2026-09: cada foco de tab
 *                       disparaba ~11 requests a Supabase de golpe. Los
 *                       datos vivos ya se pollean (refetchInterval) y el
 *                       resto tiene staleTimes largos; el foco no necesita
 *                       refetch. Fue contribuyente a la pausa por egress.
 *   - retry:     1     — single retry on network flakiness; we don't
 *                       want 3 retries for a real 404.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <RouteReporter />
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
)
