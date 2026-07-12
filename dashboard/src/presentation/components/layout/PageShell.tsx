import type { ReactNode } from 'react'
import { Navbar } from './Navbar'
import { Footer } from './Footer'
import { ErrorBoundary } from '@/infrastructure/errors'

interface PageShellProps {
  children: ReactNode
}

export function PageShell({ children }: PageShellProps) {
  return (
    <ErrorBoundary>
      <div className="flex min-h-screen flex-col">
        <a href="#main-content" className="skip-link">
          Saltar al contenido principal
        </a>

        <Navbar />

        <main id="main-content" className="flex-1 pt-14" role="main">
          {children}
        </main>

        <Footer />
      </div>
    </ErrorBoundary>
  )
}
