interface FooterProps {
  className?: string
}

export function Footer({ className }: FooterProps = {}) {
  return (
    <footer className={`border-border-card mt-16 border-t ${className ?? ''}`} role="contentinfo">
      <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row">
        <p className="text-text-dim font-body text-xs">ScoreHub · Datos proveídos por 365scores</p>
        <p className="text-text-dim font-body text-xs">Hecho para la afición 🏆</p>
      </div>
    </footer>
  )
}
