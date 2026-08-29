/**
 * tests/unit/repositories.test.js — Verificación estructural de la capa de repos (Fase 8).
 *
 * Mockea `database/db.js` con respuestas controladas y comprueba:
 *  - El proxy del port lanza con métodos faltantes
 *  - Los DTOs vienen en camelCase con la forma del dominio
 *  - Las queries correctas van por `db.query` (Supabase HTTP) vs `db.execAdvanced` (pg)
 *
 * No requiere conexión a DB. Corre con `npx jest tests/unit/repositories.test.js`.
 */

jest.mock('../../database/db', () => {
  const mockQuery = jest.fn();
  const mockExecAdvanced = jest.fn();
  const mockInsert = jest.fn();
  const mockUpsert = jest.fn();
  const mockRemove = jest.fn();
  return {
    query: mockQuery,
    execAdvanced: mockExecAdvanced,
    insert: mockInsert,
    upsert: mockUpsert,
    remove: mockRemove,
    __mocks: { mockQuery, mockExecAdvanced, mockInsert, mockUpsert, mockRemove },
  };
});

const db = require('../../database/db');
const { PgMatchRepository } = require('../../src/infrastructure/persistence/PgMatchRepository');
const { PgCompetitionRepository } = require('../../src/infrastructure/persistence/PgCompetitionRepository');
const { PgCompetitorRepository } = require('../../src/infrastructure/persistence/PgCompetitorRepository');
const { PgUserRepository } = require('../../src/infrastructure/persistence/PgUserRepository');
const { createMatchRepository } = require('../../src/domain/ports/IMatchRepository');
const { createCompetitionRepository } = require('../../src/domain/ports/ICompetitionRepository');
const { createCompetitorRepository } = require('../../src/domain/ports/ICompetitorRepository');
const { createUserRepository } = require('../../src/domain/ports/IUserRepository');

const { mockQuery, mockExecAdvanced, mockInsert, mockUpsert, mockRemove } = db.__mocks;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Port Proxy enforcement', () => {
  test('createMatchRepository throws on missing methods', () => {
    const repo = createMatchRepository({ findById: () => null }); // intentionally incomplete
    expect(() => repo.findByCompetitionAndDate(1, '2026-01-01')).toThrow(/is not implemented/);
  });

  test('createUserRepository throws on missing methods', () => {
    const repo = createUserRepository({ findById: () => null });
    expect(() => repo.upsert('x', 'y')).toThrow(/is not implemented/);
  });

  test('createCompetitionRepository throws on missing methods', () => {
    const repo = createCompetitionRepository({});
    expect(() => repo.findById(1)).toThrow(/is not implemented/);
  });
});

describe('PgMatchRepository', () => {
  const repo = createMatchRepository(new PgMatchRepository());

  test('findById uses db.query (Supabase HTTP) and returns DTO', async () => {
    mockQuery.mockResolvedValueOnce({
      data: {
        id: 12345,
        competition_id: 7,
        status_group: 3,
        status_text: 'LIVE',
        start_time: '2026-01-01T18:00:00Z',
        home_competitor_id: 100,
        away_competitor_id: 200,
        home_score: 2,
        away_score: 1,
        stage: 1,
        season_num: 2026,
        data: { homeCompetitor: { name: 'Brasil' }, awayCompetitor: { name: 'Argentina' } },
      },
      error: null,
    });

    const dto = await repo.findById(12345);

    expect(mockQuery).toHaveBeenCalledWith('games', expect.objectContaining({ eq: { id: 12345 } }));
    expect(dto).toMatchObject({
      id: 12345,
      competitionId: 7,
      statusGroup: 3,
      homeCompetitor: { id: 100, name: 'Brasil', score: 2 },
      awayCompetitor: { id: 200, name: 'Argentina', score: 1 },
      rawData: expect.objectContaining({ homeCompetitor: { name: 'Brasil' } }),
    });
  });

  test('findById returns null on missing row', async () => {
    mockQuery.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });
    expect(await repo.findById(999)).toBeNull();
  });

  test('findByCompetitionAndDate uses db.execAdvanced for DATE filter', async () => {
    mockExecAdvanced.mockResolvedValueOnce([
      {
        id: 1,
        competition_id: 7,
        start_time: '2026-01-01T18:00:00Z',
        home_competitor_id: 100,
        away_competitor_id: 200,
        home_score: 0,
        away_score: 0,
        data: {},
      },
    ]);

    const result = await repo.findByCompetitionAndDate(7, '2026-01-01');

    expect(mockExecAdvanced).toHaveBeenCalledWith(
      expect.stringContaining('DATE(start_time AT TIME ZONE'),
      [7, '2026-01-01']
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 1, competitionId: 7 });
  });
});

describe('PgCompetitionRepository', () => {
  const repo = createCompetitionRepository(new PgCompetitionRepository());

  test('findById returns DTO with name fallback chain', async () => {
    mockQuery.mockResolvedValueOnce({
      data: { id: 42, data: { displayName: 'Copa América' }, updated_at: '2026-01-01' },
      error: null,
    });

    const dto = await repo.findById(42);
    expect(dto).toMatchObject({ id: 42, name: 'Copa América', data: { displayName: 'Copa América' } });
  });

  test('findActiveIds filters and returns number array', async () => {
    mockQuery.mockResolvedValueOnce({
      data: [
        { competition_id: 7 },
        { competition_id: 8 },
        { competition_id: null },
      ],
      error: null,
    });

    const ids = await repo.findActiveIds();
    expect(ids).toEqual([7, 8]);
  });
});

describe('PgCompetitorRepository', () => {
  const repo = createCompetitorRepository(new PgCompetitorRepository());

  test('findById prefers column name over JSONB', async () => {
    mockQuery.mockResolvedValueOnce({
      data: {
        id: 100,
        competition_id: 7,
        name: 'Brasil',
        data: { name: 'Brazil (legacy)' },
        updated_at: '2026-01-01',
      },
      error: null,
    });

    const dto = await repo.findById(100);
    expect(dto.name).toBe('Brasil');
    expect(dto.data).toEqual({ name: 'Brazil (legacy)' });
  });
});

describe('PgUserRepository', () => {
  const repo = createUserRepository(new PgUserRepository());

  test('addFollowedTeam swallows duplicate-key errors (idempotent)', async () => {
    mockInsert.mockResolvedValueOnce({ data: null, error: { code: '23505' } });
    await expect(repo.addFollowedTeam('user1', 100, 'Brasil')).resolves.toBeUndefined();
    expect(mockInsert).toHaveBeenCalledWith(
      'equipos_seguidos',
      [{ id_usuario: 'user1', id_equipo: 100, nombre_equipo: 'Brasil' }],
      expect.objectContaining({ onConflict: 'id_usuario,id_equipo' })
    );
  });

  test('addFollowedTeam throws on non-duplicate errors', async () => {
    mockInsert.mockResolvedValueOnce({ data: null, error: { code: '42P01', message: 'undefined_table' } });
    await expect(repo.addFollowedTeam('user1', 100, 'Brasil')).rejects.toBeDefined();
  });

  test('upsert returns UserDTO', async () => {
    mockUpsert.mockResolvedValueOnce({
      data: { id: 'user1', alias: 'fan', estado: 'registrado' },
      error: null,
    });

    const dto = await repo.upsert('user1', 'fan');
    expect(dto).toEqual({
      id: 'user1',
      alias: 'fan',
      fechaRegistro: undefined,
      estado: 'registrado',
    });
  });
});
