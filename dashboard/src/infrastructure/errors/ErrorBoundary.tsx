import React, { Component, ReactNode } from 'react'
import ErrorHandler from './ErrorHandler'

interface ErrorBoundaryState {
  hasError: boolean
  errorMessage: string
  errorCode?: string
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (errorInfo: { message: string; code?: string }) => void
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, errorMessage: '' }
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const errorHandler = ErrorHandler.getInstance()
    const errorInfo = errorHandler.handle(error)

    return {
      hasError: true,
      errorMessage: errorInfo.message,
      errorCode: errorInfo.code,
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const errorHandler = ErrorHandler.getInstance()
    const errorDetails = errorHandler.handle(error)

    if (this.props.onError) {
      this.props.onError({
        message: errorDetails.message,
        code: errorDetails.code,
      })
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="bg-bg-base flex min-h-screen items-center justify-center">
          <div className="bg-bg-card border-border-card w-full max-w-md rounded-xl border p-8">
            <div className="text-center">
              <div className="bg-accent-red/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
                <svg
                  className="text-accent-red h-8 w-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h1 className="font-display text-text-primary mb-2 text-xl font-bold">
                Lo sentimos, algo salió mal
              </h1>
              <p className="font-body text-text-muted mb-6">Ocurrió un error inesperado.</p>
              {this.state.errorCode && (
                <p className="text-text-dim mb-4 font-mono text-xs">Error: {this.state.errorCode}</p>
              )}
              <button
                onClick={() => window.location.reload()}
                className="bg-accent-blue/10 text-accent-blue font-body hover:bg-accent-blue/20 focus-visible rounded-lg px-4 py-2 font-medium transition-colors"
              >
                Recargar página
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
