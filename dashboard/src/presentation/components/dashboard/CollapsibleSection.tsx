import { useEffect, useState, type ReactNode } from 'react'

interface CollapsibleSectionProps {
  icon?: string
  title: ReactNode
  /** Acción a la derecha del encabezado (ej. link "Ver más"). No colapsa. */
  action?: ReactNode
  defaultOpen?: boolean
  /** Si se pasa, el estado abierto/cerrado se recuerda en localStorage. */
  storageKey?: string
  children: ReactNode
}

function usePersistentToggle(storageKey: string | undefined, initial: boolean) {
  const [open, setOpen] = useState<boolean>(() => {
    if (!storageKey) return initial
    try {
      const v = localStorage.getItem(storageKey)
      return v === null ? initial : v === '1'
    } catch {
      return initial
    }
  })
  useEffect(() => {
    if (!storageKey) return
    try {
      localStorage.setItem(storageKey, open ? '1' : '0')
    } catch {
      /* localStorage no disponible — ignorar */
    }
  }, [storageKey, open])
  return [open, setOpen] as const
}

export function CollapsibleSection({
  icon,
  title,
  action,
  defaultOpen = true,
  storageKey,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = usePersistentToggle(storageKey, defaultOpen)

  return (
    <div className="bg-bg-card border-border-card overflow-hidden rounded-xl border">
      <div className="border-border-card flex items-center justify-between border-b px-3 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="font-body text-text-muted hover:text-text-primary focus-visible flex min-w-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wider transition-colors"
          aria-expanded={open}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`shrink-0 transition-transform ${open ? '' : '-rotate-90'}`}
            aria-hidden="true"
          >
            <path d="M3 5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {icon && <span aria-hidden="true">{icon}</span>}
          <span className="truncate normal-case">{title}</span>
        </button>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {open && children}
    </div>
  )
}
