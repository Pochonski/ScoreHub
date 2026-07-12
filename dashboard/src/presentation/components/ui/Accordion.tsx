import { useState, useId, type ReactNode } from 'react'

interface AccordionSectionProps {
  title: string
  defaultOpen?: boolean
  icon?: ReactNode
  children: ReactNode
  badge?: string | number
  className?: string
}

export function AccordionSection({
  title,
  defaultOpen,
  icon,
  children,
  badge,
  className = '',
}: AccordionSectionProps) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  const id = useId()

  return (
    <div className={`bg-bg-card border-border-card overflow-hidden rounded-xl border ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={id}
        className="hover:bg-bg-elevated/30 focus-visible flex w-full items-center gap-2 px-5 py-4 text-left transition-colors"
      >
        {icon && <span aria-hidden="true">{icon}</span>}
        <span className="font-body text-text-dim flex-1 text-[10px] tracking-wider uppercase">{title}</span>
        {badge != null && (
          <span className="text-text-dim bg-bg-elevated rounded px-1.5 py-0.5 font-mono text-[10px]">
            {badge}
          </span>
        )}
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`text-text-muted shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <path d="M3 4.5L6 7.5L9 4.5" />
        </svg>
      </button>
      <div id={id} role="region" hidden={!open}>
        {children}
      </div>
    </div>
  )
}
