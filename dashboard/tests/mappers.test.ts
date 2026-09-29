import { describe, it, expect } from 'vitest'
import { mapGame, mapGames } from '@/data/mappers/GameMapper'
import { mapNews, mapNewsList } from '@/data/mappers/NewsMapper'
import { AppError } from '@/infrastructure/errors/AppError'

describe('GameMapper', () => {
  const validGameRaw = {
    id: 123,
    homeTeam: { id: 1, name: 'Team A', score: 2, badgeUrl: '/a.png' },
    awayTeam: { id: 2, name: 'Team B', score: 1, badgeUrl: '/b.png' },
    statusGroup: 1,
    stage: 'Group Stage',
    startTime: '2026-06-15T18:00:00Z',
  }

  it('maps a valid game object', () => {
    const game = mapGame(validGameRaw)
    expect(game.id).toBe(123)
    expect(game.homeTeam.name).toBe('Team A')
    expect(game.awayTeam.score).toBe(1)
    expect(game.status).toBe('live')
  })

  it('maps statusGroup 2 to upcoming', () => {
    const game = mapGame({ ...validGameRaw, statusGroup: 2 })
    expect(game.status).toBe('upcoming')
  })

  it('maps statusGroup 4 to finished', () => {
    const game = mapGame({ ...validGameRaw, statusGroup: 4 })
    expect(game.status).toBe('finished')
  })

  it('throws AppError for missing required fields', () => {
    expect(() => mapGame({ id: 1 } as Record<string, unknown>)).toThrow(AppError)
  })

  it('maps groupNum, competitionId y flagUrl cuando vienen', () => {
    const game = mapGame({
      ...validGameRaw,
      competitionId: 7016,
      groupNum: 7,
      homeTeam: { id: 1, name: 'Team A', score: 2, badgeUrl: '/a.png', flagUrl: '/flag-a.png' },
      awayTeam: { id: 2, name: 'Team B', score: 1, badgeUrl: '/b.png' },
    })
    expect(game.competitionId).toBe(7016)
    expect(game.groupNum).toBe(7)
    expect(game.homeTeam.flagUrl).toBe('/flag-a.png')
    expect(game.awayTeam.flagUrl).toBeUndefined()
  })

  it('deja groupNum undefined cuando no viene', () => {
    expect(mapGame(validGameRaw).groupNum).toBeUndefined()
  })

  it('maps an array of valid games', () => {
    const games = mapGames([validGameRaw, { ...validGameRaw, id: 456 }])
    expect(games).toHaveLength(2)
    expect(games[0].id).toBe(123)
    expect(games[1].id).toBe(456)
  })

  it('throws on invalid game array', () => {
    const invalid = [{ id: 'not-a-number', homeTeam: null }] as unknown as Record<string, unknown>[]
    expect(() => mapGames(invalid)).toThrow(AppError)
  })
})

describe('NewsMapper', () => {
  const validNewsRaw = {
    id: 1,
    title: 'Mundial 2026: Noticias de hoy',
    url: 'https://example.com/news/1',
    image: '/images/news.jpg',
    publishDate: '2026-07-10',
    source: 'FIFA',
  }

  it('maps a valid news object', () => {
    const news = mapNews(validNewsRaw)
    expect(news.title).toBe('Mundial 2026: Noticias de hoy')
    expect(news.url).toBe('https://example.com/news/1')
  })

  it('maps without optional fields', () => {
    const news = mapNews({ id: 1, title: 'Test', url: 'https://example.com/t' })
    expect(news.title).toBe('Test')
    expect(news.id).toBe('1')
  })

  it('convierte id numérico a string y acepta URL relativa', () => {
    const news = mapNews({ id: 42, title: 'Relativa', url: '/noticias/42' })
    expect(news.id).toBe('42')
    expect(news.url).toBe('/noticias/42')
  })

  it('throws AppError for missing title', () => {
    expect(() => mapNews({ id: 1 } as Record<string, unknown>)).toThrow(AppError)
  })

  it('maps an array of valid news items', () => {
    const list = mapNewsList([validNewsRaw, { ...validNewsRaw, id: 2, title: 'Second' }])
    expect(list).toHaveLength(2)
    expect(list[1].title).toBe('Second')
  })

  it('descarta items rotos sin tumbar la lista', () => {
    const list = mapNewsList([
      validNewsRaw,
      { id: 'bad' },
      { ...validNewsRaw, id: 2, title: 'Second' },
    ] as unknown as Record<string, unknown>[])
    expect(list).toHaveLength(2)
    expect(list[1].title).toBe('Second')
  })
})
