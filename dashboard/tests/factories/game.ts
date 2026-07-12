import type { Game } from '@/domain/entities/Game'

export function createMockGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 1,
    statusGroup: 2,
    status: 'upcoming',
    homeTeam: { id: 1, name: 'Brasil', score: 0, badgeUrl: '/brazil.png' },
    awayTeam: { id: 2, name: 'Argentina', score: 0, badgeUrl: '/argentina.png' },
    startTime: new Date(Date.now() + 86400000).toISOString(),
    stage: 'Grupo A',
    stageName: 'Fase de grupos',
    competitionId: 5930,
    groupNum: 1,
    ...overrides,
  } as Game
}

export function createLiveGame(overrides: Partial<Game> = {}): Game {
  return createMockGame({
    statusGroup: 1,
    status: 'live',
    minute: 45,
    homeTeam: { id: 1, name: 'Brasil', score: 2, badgeUrl: '/brazil.png' },
    awayTeam: { id: 2, name: 'Argentina', score: 1, badgeUrl: '/argentina.png' },
    statusText: "45'",
    ...overrides,
  })
}

export function createFinishedGame(overrides: Partial<Game> = {}): Game {
  return createMockGame({
    statusGroup: 4,
    status: 'finished',
    homeTeam: { id: 1, name: 'Brasil', score: 3, badgeUrl: '/brazil.png' },
    awayTeam: { id: 2, name: 'Argentina', score: 1, badgeUrl: '/argentina.png' },
    ...overrides,
  })
}
