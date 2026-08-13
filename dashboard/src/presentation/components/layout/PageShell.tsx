import type { ReactNode } from 'react'
import { Navbar } from './Navbar'
import { BottomNav } from './BottomNav'
import { Footer } from './Footer'
import { ErrorBoundary } from '@/infrastructure/errors'

interface PageShellProps {
  children: ReactNode
}

export function PageShell({ children }: PageShellProps) {
  return (
    <ErrorBoundary>
      {/* min-h-dvh respeta la URL bar dinámica de iOS Safari. */}
      <div className="flex min-h-dvh flex-col">
        <a href="#main-content" className="skip-link">
          Saltar al contenido principal
        </a>

        <Navbar />

        {/*
          pb-20 en mobile deja espacio para el BottomNav fijo (h-16 + safe area).
          En md+ el BottomNav desaparece, vuelve a pb-0.
          En lg+ el main se bloquea al alto del viewport (menos el navbar h-14) y
          se oculta el scroll del documento: cada columna del grid hace su propio
          overflow-y-auto para tener scrolls independientes.
        */}
        <main
          id="main-content"
          className="flex-1 overflow-x-hidden pb-20 pt-14 md:pb-0 lg:h-[calc(100dvh-3.5rem)] lg:overflow-hidden"
          role="main"
        >
          {children}
        </main>

        {/* Footer: en lg+ el DashboardPage lo inyecta dentro del scroll del centro,
            para que no quede duplicado cuando el main está bloqueado al viewport. */}
        <Footer className="lg:hidden" />

        <BottomNav />
      </div>
    </ErrorBoundary>
  )
}
