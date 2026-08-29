/**
 * tests/integration/useCases-team.test.js (T2b)
 *
 * Integration test para teamsUseCases contra DB captura + cache mockeado.
 * Cubre infoEquipo, seguirEquipo, dejarSeguirEquipo, getEquiposSeguidos
 * con sus branches de error.
 */

process.env.NODE_ENV = 'test';

jest.mock('../../database/connection', () => {
  const c = require('./helpers/dbCapture');
  return { pool: c.pool, withTransaction: c.withTransaction, pgQueryRetry: c.pgQueryRetry, testConnection: jest.fn().mockResolvedValue(true) };
});
jest.mock('../../database/db', () => require('./helpers/dbCapture').db);

const capture = require('./helpers/dbCapture');
const {
  createGetInfoEquipo,
  createSeguirEquipo,
  createDejarSeguirEquipo,
  createGetEquiposSeguidos,
} = require('../../src/application/teams/useCases');

function makeCache(overrides = {}) {
  return {
    getTeamByName: jest.fn(),
    getRecentWorldCupMatchesByTeam: jest.fn(),
    ...overrides,
  };
}

function makeUserRepo(overrides = {}) {
  return {
    addFollowedTeam: jest.fn(),
    removeFollowedTeam: jest.fn(),
    listFollowedTeams: jest.fn(),
    ...overrides,
  };
}

function makeTeamContext() {
  return {
    getFlag: () => '🏳️',
    getConfederation: () => 'CONMEBOL',
    getRecentForm: () => ({ played: 5, wins: 3, draws: 1, losses: 1, line: 'GGGED' }),
  };
}

const silentLogger = { error: jest.fn(), warn: jest.fn() };

beforeEach(() => { capture.reset(); });

describe('createGetInfoEquipo', () => {
  test('devuelve info cuando el equipo existe', async () => {
    const cache = makeCache({
      getTeamByName: jest.fn().mockResolvedValue({ id: 100, name: 'Brasil' }),
      getRecentWorldCupMatchesByTeam: jest.fn().mockResolvedValue([
        { homeCompetitor: { id: 100, name: 'Brasil', score: 2 }, awayCompetitor: { id: 200, name: 'Argentina', score: 1 }, startTime: '2026-01-01T18:00:00Z' },
      ]),
    });
    const uc = createGetInfoEquipo({
      cache, ...makeTeamContext(), logger: silentLogger,
    });
    const out = await uc('Brasil');
    expect(out).toMatch(/🇧🇷|🏳️/); // banderín
    expect(out).toMatch(/BRASIL/);
    expect(out).toMatch(/Forma reciente/);
    expect(out).toMatch(/3G 1E 1D/);
  });

  test('devuelve error cuando el equipo no existe', async () => {
    const cache = makeCache({ getTeamByName: jest.fn().mockResolvedValue(null) });
    const uc = createGetInfoEquipo({
      cache, ...makeTeamContext(), logger: silentLogger,
    });
    const out = await uc('Brasil');
    expect(out).toMatch(/No encontré al equipo/);
  });

  test('devuelve error cuando no hay partidos', async () => {
    const cache = makeCache({
      getTeamByName: jest.fn().mockResolvedValue({ id: 100, name: 'Brasil' }),
      getRecentWorldCupMatchesByTeam: jest.fn().mockResolvedValue([]),
    });
    const uc = createGetInfoEquipo({
      cache, ...makeTeamContext(), logger: silentLogger,
    });
    const out = await uc('Brasil');
    expect(out).toMatch(/sin datos/);
  });

  test('acepta object form', async () => {
    const cache = makeCache({ getRecentWorldCupMatchesByTeam: jest.fn().mockResolvedValue([]) });
    const uc = createGetInfoEquipo({
      cache, ...makeTeamContext(), logger: silentLogger,
    });
    const out = await uc({ id: 100, nombre: 'Brasil' });
    expect(out).toMatch(/BRASIL/);
  });
});

describe('createSeguirEquipo', () => {
  test('inserta seguido vía userRepository (no SQL directo)', async () => {
    const cache = makeCache({
      getTeamByName: jest.fn().mockResolvedValue({ id: 100, name: 'Brasil' }),
    });
    const userRepo = makeUserRepo();
    const dbIsAvailable = jest.fn().mockResolvedValue(true);
    const uc = createSeguirEquipo({ userRepository: userRepo, dbIsAvailable, cache, logger: silentLogger });
    const out = await uc('u1', 'Brasil');
    expect(userRepo.addFollowedTeam).toHaveBeenCalledWith('u1', 100, 'Brasil');
    expect(capture.getWrites()).toEqual([]); // sin SQL directo, repo lo hace
  });

  test('rechaza cuando db no está disponible', async () => {
    const userRepo = makeUserRepo();
    const dbIsAvailable = jest.fn().mockResolvedValue(false);
    const cache = makeCache();
    const uc = createSeguirEquipo({ userRepository: userRepo, dbIsAvailable, cache, logger: silentLogger });
    const out = await uc('u1', 'Brasil');
    expect(out).toMatch(/Base de datos no disponible/);
    expect(userRepo.addFollowedTeam).not.toHaveBeenCalled();
  });

  test('rechaza cuando el equipo no existe', async () => {
    const cache = makeCache({ getTeamByName: jest.fn().mockResolvedValue(null) });
    const userRepo = makeUserRepo();
    const dbIsAvailable = jest.fn().mockResolvedValue(true);
    const uc = createSeguirEquipo({ userRepository: userRepo, dbIsAvailable, cache, logger: silentLogger });
    const out = await uc('u1', 'Brasil');
    expect(out).toMatch(/No encontré al equipo/);
  });
});

describe('createDejarSeguirEquipo', () => {
  test('remueve vía userRepository', async () => {
    const cache = makeCache({
      getTeamByName: jest.fn().mockResolvedValue({ id: 100, name: 'Brasil' }),
    });
    const userRepo = makeUserRepo();
    const dbIsAvailable = jest.fn().mockResolvedValue(true);
    const uc = createDejarSeguirEquipo({ userRepository: userRepo, dbIsAvailable, cache, logger: silentLogger });
    const out = await uc('u1', 'Brasil');
    expect(userRepo.removeFollowedTeam).toHaveBeenCalledWith('u1', 100);
    expect(out).toMatch(/Has dejado de seguir a Brasil/);
  });
});

describe('createGetEquiposSeguidos', () => {
  test('lista vacía', async () => {
    const userRepo = makeUserRepo({ listFollowedTeams: jest.fn().mockResolvedValue([]) });
    const dbIsAvailable = jest.fn().mockResolvedValue(true);
    const uc = createGetEquiposSeguidos({ userRepository: userRepo, dbIsAvailable, logger: silentLogger });
    const out = await uc('u1');
    expect(typeof out).toBe('string');
  });

  test('lista populada', async () => {
    const userRepo = makeUserRepo({
      listFollowedTeams: jest.fn().mockResolvedValue([
        { userId: 'u1', teamId: 100, teamName: 'Brasil' },
        { userId: 'u1', teamId: 200, teamName: 'Argentina' },
      ]),
    });
    const dbIsAvailable = jest.fn().mockResolvedValue(true);
    const uc = createGetEquiposSeguidos({ userRepository: userRepo, dbIsAvailable, logger: silentLogger });
    const out = await uc('u1');
    expect(out).toMatch(/Brasil/);
    expect(out).toMatch(/Argentina/);
  });
});
