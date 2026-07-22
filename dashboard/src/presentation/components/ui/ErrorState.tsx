interface ErrorStateProps {
  message?: string
  code?: string
  onRetry?: () => void
  onAction?: () => void
  actionLabel?: string
  fullPage?: boolean
}

export function ErrorState({ message, code, onRetry, onAction, actionLabel, fullPage }: ErrorStateProps) {
  const container = fullPage
    ? 'min-h-[60dvh] flex items-center justify-center'
    : 'flex items-center justify-center py-12'

  return (
    <div className={container}>
      <div className="max-w-sm text-center">
        <div className="bg-accent-red/10 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
          <svg className="text-accent-red h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01" />
          </svg>
        </div>
        <p className="font-body text-text-muted mb-1 text-sm">
          {message || 'Ocurrió un error al cargar los datos'}
        </p>
        {code && <p className="text-text-dim mb-4 font-mono text-[11px]">{code}</p>}
        <div className="mt-4 flex flex-col items-center justify-center gap-2">
          {onRetry && (
            <button
              onClick={onRetry}
              className="bg-accent-blue/10 text-accent-blue font-body hover:bg-accent-blue/20 focus-visible rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
            >
              Reintentar
            </button>
          )}
          {onAction && (
            <button
              onClick={onAction}
              className="bg-bg-card text-text-muted hover:text-text-primary font-body focus-visible rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
            >
              {actionLabel || 'Volver'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
