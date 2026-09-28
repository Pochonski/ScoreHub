interface SkeletonProps {
  className?: string
  variant?: 'text' | 'card' | 'hero' | 'circle'
}

export function Skeleton({ className = '', variant = 'text' }: SkeletonProps) {
  const baseClass = 'skeleton'

  const variantClasses: Record<string, string> = {
    text: 'h-4 w-full',
    card: 'h-32 w-full rounded-xl',
    hero: 'h-64 w-full rounded-2xl',
    circle: 'h-12 w-12 rounded-full',
  }

  return (
    <div
      className={`${baseClass} ${variantClasses[variant]} ${className}`}
      role="status"
      aria-label="Cargando..."
    />
  )
}

export function MatchCardSkeleton() {
  return (
    <div
      className="bg-bg-card skeleton space-y-3 rounded-xl p-4"
      role="status"
      aria-label="Cargando partido..."
    >
      <div className="flex items-center justify-between">
        <div className="bg-bg-elevated h-10 w-10 rounded-full" />
        <div className="bg-bg-elevated h-8 w-16 rounded" />
        <div className="bg-bg-elevated h-10 w-10 rounded-full" />
      </div>
      <div className="flex items-center justify-between">
        <div className="bg-bg-elevated h-4 w-20 rounded" />
        <div className="bg-bg-elevated h-4 w-16 rounded" />
        <div className="bg-bg-elevated h-4 w-20 rounded" />
      </div>
    </div>
  )
}

export function HeroSkeleton() {
  // Padding alineado con el HeroMatch real (py-6 sm:py-8) para evitar layout shift.
  return (
    <div className="space-y-6 px-4 py-6 sm:py-8" role="status" aria-label="Cargando partido destacado...">
      <div className="bg-bg-card skeleton flex items-center justify-center gap-4 rounded-2xl py-8 sm:gap-8 sm:py-12">
        <div className="bg-bg-elevated h-16 w-16 rounded-full sm:h-20 sm:w-20" />
        <div className="bg-bg-elevated h-12 w-20 rounded sm:h-16 sm:w-24" />
        <div className="bg-bg-elevated h-16 w-16 rounded-full sm:h-20 sm:w-20" />
      </div>
      <div className="flex justify-center gap-4">
        <div className="bg-bg-elevated h-4 w-24 rounded" />
        <div className="bg-bg-elevated h-4 w-24 rounded" />
      </div>
    </div>
  )
}

export function StandingsSkeleton() {
  return (
    <div
      className="bg-bg-card skeleton space-y-2 rounded-xl p-4"
      role="status"
      aria-label="Cargando tabla..."
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="bg-bg-elevated h-6 w-6 rounded" />
          <div className="bg-bg-elevated h-6 w-6 rounded-full" />
          <div className="bg-bg-elevated h-4 flex-1 rounded" />
          <div className="bg-bg-elevated h-4 w-8 rounded" />
        </div>
      ))}
    </div>
  )
}
