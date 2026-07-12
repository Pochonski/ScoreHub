import { memo } from 'react'

interface FormDotProps {
  result: string
  size?: 'sm' | 'md'
}

const sizeMap = {
  sm: 'w-1.5 h-1.5',
  md: 'w-2.5 h-2.5',
}

export const FormDot = memo(function FormDot({ result, size = 'sm' }: FormDotProps) {
  const color = result === 'W' ? 'bg-accent-live' : result === 'D' ? 'bg-accent-gold' : 'bg-accent-red'

  const title = result === 'W' ? 'Victoria' : result === 'D' ? 'Empate' : 'Derrota'

  return (
    <span
      className={`${sizeMap[size]} rounded-full ${color} inline-block`}
      title={title}
      aria-label={title}
    />
  )
})
