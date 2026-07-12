import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AccordionSection } from '@/presentation/components/ui/Accordion'

describe('AccordionSection', () => {
  it('renderiza el título', () => {
    render(
      <AccordionSection title="Test Section">
        <p>Content</p>
      </AccordionSection>
    )
    expect(screen.getByText('Test Section')).toBeInTheDocument()
  })

  it('oculta el contenido por defecto', () => {
    render(
      <AccordionSection title="Test">
        <p>Hidden</p>
      </AccordionSection>
    )
    const region = screen.getByRole('region', { hidden: true })
    expect(region).toHaveAttribute('hidden')
  })

  it('muestra el contenido cuando defaultOpen=true', () => {
    render(
      <AccordionSection title="Test" defaultOpen>
        <p>Visible</p>
      </AccordionSection>
    )
    const region = screen.getByRole('region', { hidden: true })
    expect(region).not.toHaveAttribute('hidden')
  })

  it('toggle del contenido al hacer click', () => {
    render(
      <AccordionSection title="Test">
        <p>Content</p>
      </AccordionSection>
    )
    const button = screen.getByRole('button')
    fireEvent.click(button)
    const region = screen.getByRole('region', { hidden: true })
    expect(region).not.toHaveAttribute('hidden')
  })

  it('renderiza el badge cuando se proporciona', () => {
    render(
      <AccordionSection title="Test" badge={5}>
        <p>Content</p>
      </AccordionSection>
    )
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('tiene aria-expanded sincronizado con estado', () => {
    render(
      <AccordionSection title="Test">
        <p>Content</p>
      </AccordionSection>
    )
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
  })
})
