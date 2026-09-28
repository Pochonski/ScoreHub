import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PlayerNode } from '@/presentation/components/stats/TeamOfWeekPitch'

const player = { athleteId: 41824, name: 'Alexander Nübel', position: 'Portero', rating: 7.5 }

describe('PlayerNode', () => {
  it('llama onSelect con el athleteId al hacer click', () => {
    const onSelect = vi.fn()
    render(<PlayerNode player={player} onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: /Nübel/ }))
    expect(onSelect).toHaveBeenCalledWith(41824)
  })

  it('llama onSelect con Enter', () => {
    const onSelect = vi.fn()
    render(<PlayerNode player={player} onSelect={onSelect} />)
    fireEvent.keyDown(screen.getByRole('button', { name: /Nübel/ }), { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith(41824)
  })

  it('no es interactivo sin athleteId', () => {
    const onSelect = vi.fn()
    const { container } = render(
      <PlayerNode player={{ name: 'Sin ID', position: 'Delantero' }} onSelect={onSelect} />
    )
    expect(container.querySelector('[role="button"]')).toBeNull()
    fireEvent.click(screen.getByText('Sin ID'))
    expect(onSelect).not.toHaveBeenCalled()
  })
})
