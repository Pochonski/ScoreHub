/**
 * tests/unit/teamsUseCases.test.js — Verificación de use-cases de teams (Fase 8).
 */

const {
  createGetInfoEquipo,
  createSeguirEquipo,
  createDejarSeguirEquipo,
  createGetEquiposSeguidos,
} = require('../../src/application/teams/useCases');

function makeUserRepo(overrides = {}) {
  return {
    findById: jest.fn(),
    upsert: jest.fn(),
    addFollowedTeam: jest.fn(),
    removeFollowedTeam: jest.fn(),
    listFollowedTeams: jest.fn(),
    ...overrides,
  };
}

function makeCache(overrides = {}) {
  return {
    getTeamByName: jest.fn(),
    getRecentWorldCupMatchesByTeam: jest.fn(),
    ...overrides,
  };
}

const silentLogger = { error: jest.fn(), warn: jest.fn() };

describe('createGetInfoEquipo', () => {
  test('throws if cache missing', () => {
    expect(() =>
      createGetInfoEquipo({ getFlag: jest.fn(), getConfederation: jest.fn(), getRecentForm: jest.fn() })
    ).toThrow(/cache required/);
  });

  test('returns not-found when team lookup fails', async () => {
    const cache = makeCache();
    cache.getTeamByName.mockResolvedValue(null);
    const uc = createGetInfoEquipo({
      cache, getFlag: () => '🏳️', getConfederation: () => null, getRecentForm: () => ({ played: 0 }),
      logger: silentLogger,
    });
    expect(await uc('Brasil')).toMatch(/No encontré al equipo "Brasil"/);
  });

  test('returns formatted info when team found', async () => {
    const cache = makeCache();
    cache.getTeamByName.mockResolvedValue({ id: 100, name: 'Brasil' });
    cache.getRecentWorldCupMatchesByTeam.mockResolvedValue([
      { homeCompetitor: { id: 100, name: 'Brasil', score: 2 }, awayCompetitor: { id: 200, name: 'Argentina', score: 1 }, startTime: '2025-01-01T18:00:00Z' },
    ]);
    const uc = createGetInfoEquipo({
      cache,
      getFlag: () => '🇧🇷',
      getConfederation: () => 'CONMEBOL',
      getRecentForm: (matches, id) => ({ played: matches.length, wins: 1, draws: 0, losses: 0, line: 'G' }),
      logger: silentLogger,
    });
    const out = await uc('Brasil');
    expect(out).toMatch(/🇧🇷 \*BRASIL\*/);
    expect(out).toMatch(/Selección · Confederación: \*CONMEBOL\*/);
    expect(out).toMatch(/Forma reciente/);
    expect(out).toMatch(/1G 0E 0D/);
    expect(out).toMatch(/Últimos partidos/);
  });

  test('accepts object form', async () => {
    const cache = makeCache();
    cache.getRecentWorldCupMatchesByTeam.mockResolvedValue([]);
    const uc = createGetInfoEquipo({
      cache, getFlag: () => '', getConfederation: () => null,
      getRecentForm: () => ({ played: 0 }), logger: silentLogger,
    });
    const out = await uc({ id: 100, nombre: 'Brasil' });
    expect(out).toMatch(/BRASIL/);
  });
});

describe('createSeguirEquipo', () => {
  test('throws if userRepository missing', () => {
    expect(() => createSeguirEquipo({})).toThrow(/userRepository required/);
  });

  test('returns db-down when dbIsAvailable false', async () => {
    const uc = createSeguirEquipo({
      userRepository: makeUserRepo(), dbIsAvailable: async () => false, cache: makeCache(),
      logger: silentLogger,
    });
    expect(await uc('u1', 'Brasil')).toMatch(/Base de datos no disponible/);
  });

  test('skips db check when dbIsAvailable not provided', async () => {
    const userRepo = makeUserRepo();
    userRepo.addFollowedTeam.mockResolvedValue();
    const cache = makeCache();
    cache.getTeamByName.mockResolvedValue({ id: 100, name: 'Brasil' });
    const uc = createSeguirEquipo({ userRepository: userRepo, cache, logger: silentLogger });
    await uc('u1', 'Brasil');
    expect(userRepo.addFollowedTeam).toHaveBeenCalledWith('u1', 100, 'Brasil');
  });

  test('adds followed team via repository', async () => {
    const userRepo = makeUserRepo();
    userRepo.addFollowedTeam.mockResolvedValue();
    const cache = makeCache();
    cache.getTeamByName.mockResolvedValue({ id: 100, name: 'Brasil' });
    const uc = createSeguirEquipo({
      userRepository: userRepo, dbIsAvailable: async () => true, cache, logger: silentLogger,
    });
    const out = await uc('u1', 'Brasil');
    expect(out).toMatch(/Brasil/);
    expect(userRepo.addFollowedTeam).toHaveBeenCalledWith('u1', 100, 'Brasil');
  });

  test('accepts object form', async () => {
    const userRepo = makeUserRepo();
    userRepo.addFollowedTeam.mockResolvedValue();
    const uc = createSeguirEquipo({
      userRepository: userRepo, dbIsAvailable: async () => true, cache: makeCache(), logger: silentLogger,
    });
    await uc('u1', { id: 100, nombre: 'Brasil' });
    expect(userRepo.addFollowedTeam).toHaveBeenCalledWith('u1', 100, 'Brasil');
  });
});

describe('createDejarSeguirEquipo', () => {
  test('throws if userRepository missing', () => {
    expect(() => createDejarSeguirEquipo({})).toThrow(/userRepository required/);
  });

  test('returns db-down when dbIsAvailable false', async () => {
    const uc = createDejarSeguirEquipo({
      userRepository: makeUserRepo(), dbIsAvailable: async () => false, cache: makeCache(),
      logger: silentLogger,
    });
    expect(await uc('u1', 'Brasil')).toMatch(/Base de datos no disponible/);
  });

  test('removes via repository', async () => {
    const userRepo = makeUserRepo();
    userRepo.removeFollowedTeam.mockResolvedValue();
    const cache = makeCache();
    cache.getTeamByName.mockResolvedValue({ id: 100, name: 'Brasil' });
    const uc = createDejarSeguirEquipo({
      userRepository: userRepo, dbIsAvailable: async () => true, cache, logger: silentLogger,
    });
    const out = await uc('u1', 'Brasil');
    expect(out).toMatch(/Has dejado de seguir a Brasil/);
    expect(userRepo.removeFollowedTeam).toHaveBeenCalledWith('u1', 100);
  });
});

describe('createGetEquiposSeguidos', () => {
  test('throws if userRepository missing', () => {
    expect(() => createGetEquiposSeguidos({})).toThrow(/userRepository required/);
  });

  test('returns db-down when dbIsAvailable false', async () => {
    const uc = createGetEquiposSeguidos({
      userRepository: makeUserRepo(), dbIsAvailable: async () => false, logger: silentLogger,
    });
    const out = await uc('u1');
    expect(typeof out).toBe('string');
  });

  test('returns formatted list', async () => {
    const userRepo = makeUserRepo();
    userRepo.listFollowedTeams.mockResolvedValue([
      { userId: 'u1', teamId: 100, teamName: 'Brasil' },
      { userId: 'u1', teamId: 200, teamName: 'Argentina' },
    ]);
    const uc = createGetEquiposSeguidos({
      userRepository: userRepo, dbIsAvailable: async () => true, logger: silentLogger,
    });
    const out = await uc('u1');
    expect(out).toMatch(/Brasil/);
    expect(out).toMatch(/Argentina/);
  });

  test('handles empty list', async () => {
    const userRepo = makeUserRepo();
    userRepo.listFollowedTeams.mockResolvedValue([]);
    const uc = createGetEquiposSeguidos({
      userRepository: userRepo, dbIsAvailable: async () => true, logger: silentLogger,
    });
    const out = await uc('u1');
    expect(typeof out).toBe('string');
  });
});
