import { memo } from 'react'

interface ConfidenceBarProps {
  percentage: number
  label?: string
  value?: string
  size?: 'sm' | 'md'
}

const sizeMap = {
  sm: 'h-1.5',
  md: 'h-2.5',
}

const EMOTION_META: Array<{ threshold: number; emoji: string; label: string }> = [
  { threshold: 75, emoji: '🔥', label: 'Confianza alta' },
  { threshold: 60, emoji: '📈', label: 'Confianza media-alta' },
  { threshold: 50, emoji: '➖', label: 'Confianza neutral' },
]

export const ConfidenceBar = memo(function ConfidenceBar({
  percentage,
  label,
  value,
  size = 'md',
}: ConfidenceBarProps) {
  const color =
    percentage >= 75
      ? 'bg-accent-live'
      : percentage >= 60
        ? 'bg-accent-blue'
        : percentage >= 50
          ? 'bg-accent-gold'
          : 'bg-text-dim'

  const meta = EMOTION_META.find((m) => percentage >= m.threshold) ?? { emoji: '📉', label: 'Confianza baja' }

  return (
    <div className="space-y-1">
      {(label || value != null) && (
        <div className="flex items-center justify-between">
          {label && (
            <span className="font-body text-text-primary flex items-center gap-1 text-xs font-medium">
              <span role="img" aria-label={meta.label}>
                {meta.emoji}
              </span>
              {label}
            </span>
          )}
          {value != null && <span className="text-text-muted font-mono text-xs">{value}</span>}
        </div>
      )}
      <div className={`w-full ${sizeMap[size]} bg-bg-elevated overflow-hidden rounded-full`}>
        <div
          className={`${sizeMap[size]} ${color} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  )
})
