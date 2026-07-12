import { useState } from 'react'
import { useStandings } from '@/presentation/hooks/useStandings'
import { GroupStandings } from '@/presentation/components/standings/GroupStandings'
import { StandingsSkeleton } from '@/presentation/components/ui/Skeleton'

function AccordionSection({
  title,
  defaultOpen,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen ?? true)
  return (
    <div className="bg-bg-card border-border-card overflow-hidden rounded-xl border">
      <button
        onClick={() => setOpen(!open)}
        className="hover:bg-bg-elevated/20 focus-visible flex w-full items-center justify-between px-5 py-4 text-left transition-colors"
        aria-expanded={open}
      >
        <span className="font-display text-text-primary text-lg font-semibold">{title}</span>
        <span
          className={`text-text-dim shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 5l4 4 4-4" />
          </svg>
        </span>
      </button>
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-border-card/50 border-t">{children}</div>
        </div>
      </div>
    </div>
  )
}

export function StandingsTab() {
  const { groups, loading, error } = useStandings()

  if (loading) return <StandingsSkeleton />

  if (error) {
    return (
      <div className="bg-bg-card rounded-xl p-6 text-center">
        <p className="font-body text-text-muted text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <AccordionSection key={group.name} title={group.name} defaultOpen>
          <GroupStandings groups={[group]} hideHeader />
        </AccordionSection>
      ))}
    </div>
  )
}
