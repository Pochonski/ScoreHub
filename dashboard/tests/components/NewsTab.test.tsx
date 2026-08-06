import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const { mockUseNews } = vi.hoisted(() => ({ mockUseNews: vi.fn() }))
vi.mock('@/presentation/hooks/useNews', () => ({ useNews: mockUseNews }))
vi.mock('@/presentation/components/news/NewsFeed', () => ({
  NewsFeed: ({ news }: { news: unknown[] }) => <div data-testid="news-feed">{news.length} noticias</div>,
}))

import { NewsTab } from '@/presentation/components/competition/NewsTab'

const base = { news: [], loading: false, loadMore: vi.fn(), hasMore: false, error: null }

beforeEach(() => mockUseNews.mockReset())

describe('NewsTab', () => {
  it('siempre pasa competitionId a useNews (fix del 400)', () => {
    mockUseNews.mockReturnValue(base)
    render(<NewsTab competitionId={5930} />)
    expect(mockUseNews).toHaveBeenCalledWith(12, 5930)
  })

  it('con error → muestra ErrorState (no el feed)', () => {
    mockUseNews.mockReturnValue({ ...base, error: 'Falló la carga' })
    render(<NewsTab competitionId={5930} />)
    expect(screen.getByText(/Falló la carga/)).toBeInTheDocument()
    expect(screen.queryByTestId('news-feed')).not.toBeInTheDocument()
  })

  it('sin error → renderiza el NewsFeed con las noticias', () => {
    mockUseNews.mockReturnValue({ ...base, news: [{ id: 1 }, { id: 2 }] })
    render(<NewsTab competitionId={5930} />)
    expect(screen.getByTestId('news-feed')).toHaveTextContent('2 noticias')
  })
})
