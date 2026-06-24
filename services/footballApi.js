require('dotenv').config();
const fetch = require('node-fetch');
const cache = require('./cacheService');

const BASE_URL = 'https://free-api-live-football-data.p.rapidapi.com';
const headers = {
  'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
  'X-RapidAPI-Host': process.env.RAPIDAPI_HOST
};

/**
 * Hace request a la API con cache
 */
async function apiRequest(endpoint, params = {}) {
  const cacheKey = `${endpoint}:${JSON.stringify(params)}`;

  const cached = cache.get(cacheKey);
  if (cached) {
    if (process.env.DEBUG === 'true') console.log(`📦 Cache hit: ${endpoint}`);
    return cached;
  }

  const url = new URL(`${BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.append(k, v);
  });

  if (process.env.DEBUG === 'true') console.log(`🌐 API Request: ${endpoint}`);

  try {
    const response = await fetch(url.toString(), { headers });
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const data = await response.json();

    if (data) {
      cache.set(cacheKey, data);
    }

    return data;
  } catch (error) {
    console.error(`❌ API Error (${endpoint}):`, error.message);
    throw error;
  }
}

// ==================== BÚSQUEDAS ====================

/**
 * Búsqueda general (todo)
 */
async function searchAll(query) {
  const data = await apiRequest('/football-all-search', { search: query });
  // La API devuelve response.suggestions con { type, id, name }
  if (data?.response?.suggestions) {
    return {
      teams: data.response.suggestions.filter(s => s.type === 'team'),
      leagues: data.response.suggestions.filter(s => s.type === 'league'),
      players: data.response.suggestions.filter(s => s.type === 'player'),
      matches: data.response.suggestions.filter(s => s.type === 'match')
    };
  }
  return {};
}

/**
 * Búsqueda de equipos
 */
async function searchTeams(query) {
  const data = await apiRequest('/football-teams-search', { search: query });
  // La API devuelve response.suggestions con { type, id, name, leagueId }
  if (data?.response?.suggestions) {
    return data.response.suggestions
      .filter(s => s.type === 'team')
      .map(t => ({
        id: t.id,
        name: t.name,
        logo: `https://images.fotmob.com/teamlogos/${t.id}.png`,
        leagueId: t.leagueId,
        leagueName: t.name
      }));
  }
  return [];
}

/**
 * Búsqueda de jugadores
 */
async function searchPlayers(query) {
  const data = await apiRequest('/football-players-search', { search: query });
  // La API devuelve response.suggestions con { type, id, name, teamId, teamName }
  if (data?.response?.suggestions) {
    return data.response.suggestions
      .filter(s => s.type === 'player')
      .map(p => ({
        player_id: p.id,
        name: p.name,
        team_id: p.teamId,
        team_name: p.teamName
      }));
  }
  return [];
}

/**
 * Búsqueda de ligas
 */
async function searchLeagues(query) {
  const data = await apiRequest('/football-leagues-search', { search: query });
  // La API devuelve response.suggestions con { type: 'league', id, name, ccode }
  if (data?.response?.suggestions) {
    return data.response.suggestions
      .filter(s => s.type === 'league')
      .map(l => ({
        id: l.id,
        name: l.name,
        countryCode: l.ccode
      }));
  }
  return [];
}

/**
 * Búsqueda de partidos por equipo (usa football-matches-search)
 */
async function searchMatches(query) {
  const data = await apiRequest('/football-matches-search', { search: query });
  // La API devuelve response.suggestions con { type: 'match', id, leagueId, leagueName, homeTeamName, awayTeamName, ... }
  if (data?.response?.suggestions) {
    return data.response.suggestions
      .filter(s => s.type === 'match')
      .map(m => ({
        id: m.id,
        leagueId: m.leagueId,
        leagueName: m.leagueName,
        date: m.matchDate?.split('T')[0] || '',
        homeTeam: m.homeTeamName,
        homeTeamId: m.homeTeamId,
        awayTeam: m.awayTeamName,
        awayTeamId: m.awayTeamId,
        homeScore: m.homeTeamScore,
        awayScore: m.awayTeamScore,
        status: m.status?.reason?.short || (m.status?.finished ? 'FT' : 'NS')
      }));
  }
  return [];
}

// ==================== LIGAS ====================

/**
 * Todas las ligas de una temporada
 */
async function getAllSeasons() {
  const data = await apiRequest('/football-league-all-seasons');
  return data?.response?.seasons || [];
}

/**
 * Lista de países
 */
async function getAllCountries() {
  const data = await apiRequest('/football-get-all-countries');
  return data?.response?.countries || [];
}

// ==================== PARTIDOS ====================

/**
 * Partidos por fecha (formato: YYYYMMDD)
 */
async function getMatchesByDate(date) {
  // date format: YYYYMMDD
  const data = await apiRequest('/football-get-matches-by-date', { date });
  // La API devuelve response.matches con estructura { id, leagueId, time, home: {id, name}, away: {id, name}, status }
  if (data?.response?.matches) {
    return data.response.matches.map(m => ({
      id: m.id,
      leagueId: m.leagueId,
      date: m.time?.split(' ')[0] || '',
      time: m.time?.split(' ')[1] || '',
      homeTeam: m.home?.name,
      homeTeamId: m.home?.id,
      awayTeam: m.away?.name,
      awayTeamId: m.away?.id,
      homeScore: m.home?.score,
      awayScore: m.away?.score,
      status: m.status?.reason?.short || '',
      tournament: m.tournamentStage
    }));
  }
  return [];
}

/**
 * Partidos por fecha y liga
 */
async function getMatchesByDateAndLeague(date, leagueId) {
  const data = await apiRequest('/football-get-matches-by-date-and-league', { date, leagueid: leagueId });
  return data?.response?.matches || [];
}

/**
 * Todos los partidos de una liga
 */
async function getAllMatchesByLeague(leagueId) {
  const data = await apiRequest('/football-get-all-matches-by-league', { leagueid: leagueId });
  // La API devuelve response.matches con estructura { id, time, home: {id, name}, away: {id, name} }
  if (data?.response?.matches) {
    return data.response.matches.map(m => ({
      id: m.id,
      date: m.time?.split(' ')[0] || '',
      time: m.time?.split(' ')[1] || '',
      homeTeam: m.home?.name,
      homeTeamId: m.home?.id,
      awayTeam: m.away?.name,
      awayTeamId: m.away?.id,
      homeScore: m.home?.score,
      awayScore: m.away?.score,
      status: m.status?.reason?.short || ''
    }));
  }
  return [];
}

// ==================== EQUIPOS ====================

/**
 * Lista de equipos locales de una liga
 */
async function getHomeTeams(leagueId) {
  const data = await apiRequest('/football-get-list-home-team', { leagueid: leagueId });
  return data?.response?.teams || [];
}

/**
 * Lista de equipos visitantes de una liga
 */
async function getAwayTeams(leagueId) {
  const data = await apiRequest('/football-get-list-away-team', { leagueid: leagueId });
  return data?.response?.teams || [];
}

/**
 * Info de equipo
 */
async function getTeamInfo(teamId) {
  const data = await apiRequest('/football-league-team', { teamid: teamId });
  // La API devuelve response.details con { id, name, latestSeason, country }
  if (data?.response?.details) {
    const d = data.response.details;
    return {
      id: d.id,
      name: d.name,
      logo: `https://images.fotmob.com/teamlogos/${d.id}.png`,
      leagueId: null,
      leagueName: null
    };
  }
  return null;
}

/**
 * Logo de equipo
 */
async function getTeamLogo(teamId) {
  return `https://images.fotmob.com/teamlogos/${teamId}.png`;
}

// ==================== JUGADORES ====================

/**
 * Detalle de jugador
 */
async function getPlayerDetail(playerId) {
  const data = await apiRequest('/football-get-player-detail', { playerid: playerId });
  return data?.response?.player || null;
}

/**
 * Logo de jugador
 */
async function getPlayerLogo(playerId) {
  return `https://images.fotmob.com/players/${playerId}.png`;
}

// ==================== DETALLE PARTIDO ====================

/**
 * Detalle completo de partido
 */
async function getMatchDetail(eventId) {
  const data = await apiRequest('/football-get-match-detail', { eventid: eventId });
  // La API devuelve response.detail con { matchId, leagueId, leagueName, homeTeam, awayTeam, ... }
  if (data?.response?.detail) {
    const m = data.response.detail;
    return {
      id: m.matchId,
      leagueId: m.leagueId,
      leagueName: m.leagueName,
      date: m.matchTimeUTCDate?.split('T')[0] || '',
      time: m.matchTimeUTC?.split(', ')[1] || '',
      homeTeam: m.homeTeam?.name,
      homeTeamId: m.homeTeam?.id,
      awayTeam: m.awayTeam?.name,
      awayTeamId: m.awayTeam?.id,
      homeScore: 0,
      awayScore: 0,
      status: m.finished ? 'FINISHED' : (m.started ? 'LIVE' : 'NS')
    };
  }
  return null;
}

/**
 * Score de partido
 */
async function getMatchScore(eventId) {
  const data = await apiRequest('/football-get-match-score', { eventid: eventId });
  // La API devuelve response.scores array
  if (data?.response?.scores) {
    const scores = data.response.scores;
    return {
      homeTeam: scores[0]?.name,
      homeScore: scores[0]?.score,
      awayTeam: scores[1]?.name,
      awayScore: scores[1]?.score
    };
  }
  return null;
}

/**
 * Status de partido
 */
async function getMatchStatus(eventId) {
  const data = await apiRequest('/football-get-match-status', { eventid: eventId });
  // La API devuelve response.status.status con { finished, started, scoreStr, reason }
  if (data?.response?.status?.status) {
    const s = data.response.status.status;
    return {
      finished: s.finished,
      started: s.started,
      scoreStr: s.scoreStr,
      reason: s.reason?.short || ''
    };
  }
  return null;
}

// ==================== ESTADÍSTICAS ====================

/**
 * Todas las estadísticas de un partido
 */
async function getMatchAllStats(eventId) {
  const data = await apiRequest('/football-get-match-all-stats', { eventid: eventId });
  if (data?.response?.stats) {
    const stats = {};
    data.response.stats.forEach(group => {
      if (group.stats) {
        group.stats.forEach(item => {
          if (item.stats && item.title) {
            stats[item.title] = {
              home: item.stats[0],
              away: item.stats[1],
              key: item.key
            };
          }
        });
      }
    });
    return stats;
  }
  return null;
}

/**
 * Estadísticas primer tiempo
 */
async function getMatchFirstHalfStats(eventId) {
  const data = await apiRequest('/football-get-match-firstHalf-stats', { eventid: eventId });
  return data?.response?.stats || [];
}

/**
 * Estadísticas segundo tiempo
 */
async function getMatchSecondHalfStats(eventId) {
  const data = await apiRequest('/football-get-match-secondhalf-stats', { eventid: eventId });
  return data?.response?.stats || [];
}

// ==================== CLASIFICACIONES ====================

/**
 * Tabla general de una liga
 */
async function getStandings(leagueId) {
  const data = await apiRequest('/football-get-standing-all', { leagueid: leagueId });
  // La API devuelve response.standing con { name, shortName, id, played, wins, draws, losses, pts, idx }
  if (data?.response?.standing) {
    return data.response.standing.map(t => ({
      rank: t.idx,
      name: t.name,
      shortName: t.shortName,
      teamId: t.id,
      played: t.played,
      wins: t.wins,
      draws: t.draws,
      losses: t.losses,
      goalsFor: t.scoresStr?.split('-')[0] || 0,
      goalsAgainst: t.scoresStr?.split('-')[1] || 0,
      goalDiff: t.goalConDiff,
      points: t.pts
    }));
  }
  return [];
}

/**
 * Tabla de posiciones de un grupo del Mundial (calculada desde resultados)
 * @param {number} groupLeagueId - League ID del grupo (ej: 894796 para Grupo G)
 * @returns {Promise<Array>} Array de equipos con stats
 */
async function getWorldCupGroupTable(groupLeagueId) {
  try {
    // Fechas del Mundial 2026 (junio-julio)
    const fechasMundial = [];
    for (let dia = 11; dia <= 28; dia++) {
      fechasMundial.push(`202606${dia.toString().padStart(2, '0')}`);
    }

    // Buscar partidos del grupo en todas las fechas
    const allMatches = [];
    for (const fecha of fechasMundial) {
      const data = await apiRequest('/football-get-matches-by-date', { date: fecha });
      if (data?.response?.matches) {
        const groupMatches = data.response.matches.filter(m => m.leagueId === groupLeagueId);
        allMatches.push(...groupMatches);
      }
    }

    if (allMatches.length === 0) {
      return [];
    }

    // Construir tabla
    const teams = {};

    for (const match of allMatches) {
      const homeTeam = match.home?.name;
      const awayTeam = match.away?.name;
      const homeScore = match.home?.score;
      const awayScore = match.away?.score;
      const finished = match.status?.finished;

      if (!homeTeam || !awayTeam || finished !== true) continue;

      // Inicializar equipos
      if (!teams[homeTeam]) {
        teams[homeTeam] = { name: homeTeam, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
      }
      if (!teams[awayTeam]) {
        teams[awayTeam] = { name: awayTeam, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
      }

      // Actualizar stats
      teams[homeTeam].played++;
      teams[awayTeam].played++;
      teams[homeTeam].goalsFor += homeScore;
      teams[homeTeam].goalsAgainst += awayScore;
      teams[awayTeam].goalsFor += awayScore;
      teams[awayTeam].goalsAgainst += homeScore;

      if (homeScore > awayScore) {
        teams[homeTeam].wins++;
        teams[homeTeam].points += 3;
        teams[awayTeam].losses++;
      } else if (homeScore < awayScore) {
        teams[awayTeam].wins++;
        teams[awayTeam].points += 3;
        teams[homeTeam].losses++;
      } else {
        teams[homeTeam].draws++;
        teams[homeTeam].points += 1;
        teams[awayTeam].draws++;
        teams[awayTeam].points += 1;
      }
    }

    // Convertir a array y ordenar
    const table = Object.values(teams).map((t, idx) => ({
      rank: idx + 1,
      name: t.name,
      played: t.played,
      wins: t.wins,
      draws: t.draws,
      losses: t.losses,
      goalsFor: t.goalsFor,
      goalsAgainst: t.goalsAgainst,
      goalDiff: t.goalsFor - t.goalsAgainst,
      points: t.points
    }));

    // Ordenar por puntos, luego goal diff, luego goals
    table.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
      return b.goalsFor - a.goalsFor;
    });

    // Actualizar ranks
    table.forEach((t, idx) => t.rank = idx + 1);

    return table;
  } catch (error) {
    console.error('Error getWorldCupGroupTable:', error.message);
    return [];
  }
}

/**
 * Mapa de grupos del Mundial 2026
 */
const MUNDIAL_GRUPOS = {
  'A': 894791,
  'B': 894792,
  'C': 894793,
  'D': 894794,
  'E': 894795,
  'F': 894796,
  'G': 894797,
  'H': 894798,
  'I': 894799,
  'J': 894800,
  'K': 894801,
  'L': 894790, // Este parece ser playoff
};

/**
 * Tabla local de una liga
 */
async function getHomeStandings(leagueId) {
  const data = await apiRequest('/football-get-standing-home', { leagueid: leagueId });
  if (data?.response?.standing) {
    return data.response.standing.map(t => ({
      rank: t.idx,
      name: t.name,
      teamId: t.id,
      played: t.played,
      wins: t.wins,
      draws: t.draws,
      losses: t.losses,
      points: t.pts
    }));
  }
  return [];
}

/**
 * Tabla visitante de una liga
 */
async function getAwayStandings(leagueId) {
  const data = await apiRequest('/football-get-standing-away', { leagueid: leagueId });
  if (data?.response?.standing) {
    return data.response.standing.map(t => ({
      rank: t.idx,
      name: t.name,
      teamId: t.id,
      played: t.played,
      wins: t.wins,
      draws: t.draws,
      losses: t.losses,
      points: t.pts
    }));
  }
  return [];
}

// ==================== TOP JUGADORES ====================

/**
 * Top asistentes de una liga
 */
async function getTopAssists(leagueId) {
  const data = await apiRequest('/football-get-top-players-by-assists', { leagueid: leagueId });
  return data?.response?.players || [];
}

/**
 * Top goleadores de una liga
 */
async function getTopScorers(leagueId) {
  const data = await apiRequest('/football-get-top-players-by-goals', { leagueid: leagueId });
  return data?.response?.players || [];
}

/**
 * Top rating de una liga
 */
async function getTopRating(leagueId) {
  const data = await apiRequest('/football-get-top-players-by-rating', { leagueid: leagueId });
  return data?.response?.players || [];
}

// ==================== HELPERS ====================

/**
 * Traduce nombres comunes de ligas a IDs
 */
function getLeagueId(nombre) {
  const leagues = {
    'premier': 47,
    'inglaterra': 47,
    'laliga': 87,
    'la liga': 87,
    'españa': 87,
    'serie a': 55,
    'italia': 55,
    'bundesliga': 54,
    'alemania': 54,
    'ligue 1': 53,
    'francia': 53,
    'champions': 42,
    'champions league': 42,
    'mundial': 77,
    'copa america': 13,
    'europa league': 73,
    'copa del rey': 138,
    'fa cup': 132
  };
  return leagues[nombre.toLowerCase()] || null;
}

/**
 * Mapeo de nombres de equipos/naciones a su nombre en la API
 * (Diferentes variaciones -> nombre oficial en API)
 * Las claves NO tienen acentos para facilitar la búsqueda
 *
 * COBERTURA MUNDIAL 2026 - 48 equipos
 */
const TEAM_NAME_MAP = {
  // === CONCACAF (Norteamérica) ===
  'estados unidos': 'USA',
  'eeuu': 'USA',
  'usa': 'USA',
  'united states': 'USA',
  'mexico': 'Mexico',
  'canada': 'Canada',
  'jamaica': 'Jamaica',
  'honduras': 'Honduras',
  'costa rica': 'Costa Rica',
  'panama': 'Panama',
  'guatemala': 'Guatemala',

  // === CONMEBOL (Sudamérica) ===
  'brasil': 'Brazil',
  'argentina': 'Argentina',
  'uruguay': 'Uruguay',
  'colombia': 'Colombia',
  'chile': 'Chile',
  'peru': 'Peru',
  'ecuador': 'Ecuador',
  'venezuela': 'Venezuela',
  'paraguay': 'Paraguay',
  'bolivia': 'Bolivia',

  // === UEFA (Europa) ===
  'alemania': 'Germany',
  'francia': 'France',
  'inglaterra': 'England',
  'espana': 'Spain',
  'italia': 'Italy',
  'portugal': 'Portugal',
  'holanda': 'Netherlands',
  'paises bajos': 'Netherlands',
  'belgica': 'Belgium',
  'croacia': 'Croatia',
  'suiza': 'Switzerland',
  'polonia': 'Poland',
  'dinamarca': 'Denmark',
  'suecia': 'Sweden',
  'noruega': 'Norway',
  'austria': 'Austria',
  'gales': 'Wales',
  'escocia': 'Scotland',
  'irlanda': 'Ireland',
  'republica checa': 'Czech Republic',
  'rep checa': 'Czech Republic',
  'hungria': 'Hungary',
  'rumania': 'Romania',
  'serbia': 'Serbia',
  'eslovaquia': 'Slovakia',
  'finlandia': 'Finland',
  'grecia': 'Greece',
  'ucrania': 'Ukraine',
  'rusia': 'Russia',
  'islandia': 'Iceland',
  'turquia': 'Turkey',

  // === AFC (Asia) ===
  'japon': 'Japan',
  'jp': 'Japan',
  'corea': 'South Korea',
  'corea del sur': 'South Korea',
  'south korea': 'South Korea',
  'arabia': 'Saudi Arabia',
  'arabia saudita': 'Saudi Arabia',
  'iran': 'Iran',
  'australia': 'Australia',
  'qatar': 'Qatar',
  'emiratos': 'United Arab Emirates',
  'emiratos arabes': 'United Arab Emirates',
  'irak': 'Iraq',
  'jordania': 'Jordan',
  'oman': 'Oman',

  // === CAF (África) ===
  'marruecos': 'Morocco',
  'senegal': 'Senegal',
  'ghana': 'Ghana',
  'camerun': 'Cameroon',
  'nigeria': 'Nigeria',
  'egipto': 'Egypt',
  'argelia': 'Algeria',
  'tunez': 'Tunisia',
  'sudafrica': 'South Africa',
  'zambia': 'Zambia',
  'rd congo': 'DR Congo',
  'mali': 'Mali',
  'uganda': 'Uganda',

  // === OFC (Oceanía) ===
  'nueva zelanda': 'New Zealand',
  'fiji': 'Fiji',
};

/**
 * Normaliza nombre de equipo para búsqueda
 */
function normalizeTeamName(nombre) {
  const lower = nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return TEAM_NAME_MAP[lower] || lower;
}

/**
 * Busca equipo dinámicamente por nombre
 * Prioriza equipos nacionales y filtra femenina/juvenil
 */
async function buscarEquipoDinamico(nombre) {
  try {
    // Normalizar nombre (brasil -> Brazil)
    const normalizedSearch = normalizeTeamName(nombre);

    // Buscar con el nombre normalizado
    let teams = await searchTeams(normalizedSearch);
    if (!teams || teams.length === 0) {
      // Si no hay resultados, intentar con el original
      teams = await searchTeams(nombre);
    }
    if (!teams || teams.length === 0) {
      return null;
    }

    // Filtrar: excluir femenina, juvenil, paralímpico
    const filteredTeams = teams.filter(t => {
      const lowerName = t.name.toLowerCase();
      return !lowerName.includes('(w)') &&
             !lowerName.includes('women') &&
             !lowerName.includes('u17') &&
             !lowerName.includes('u20') &&
             !lowerName.includes('u23') &&
             !lowerName.includes('paralympic') &&
             !lowerName.includes('academy');
    });

    // Retornar el primero filtrado
    return filteredTeams[0] || teams[0];
  } catch (error) {
    console.error('Error buscarEquipoDinamico:', error.message);
    return null;
  }
}

/**
 * Partidos de hoy (usando fecha actual)
 */
async function getTodayMatches() {
  const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
  return getMatchesByDate(today);
}

// ==================== EQUIPOS Y PARTIDOS ====================

/**
 * Partidos recientes de un equipo
 * @param {string} teamId - ID del equipo
 * @param {number} limit - Límite de partidos (default 10)
 */
async function getTeamMatches(teamId, limit = 10) {
  try {
    // Obtener info del equipo para buscar por nombre
    const teamInfo = await getTeamInfo(teamId);
    if (!teamInfo) {
      return [];
    }

    // Buscar partidos usando el nombre del equipo
    const allMatches = await searchMatches(teamInfo.name);

    // Filtrar partidos del equipo y tomar los más recientes
    const teamMatches = allMatches
      .filter(m =>
        m.homeTeamId === teamId || m.awayTeamId === teamId
      )
      .slice(0, limit);

    return teamMatches;
  } catch (error) {
    console.error('Error getTeamMatches:', error.message);
    return [];
  }
}

/**
 * Jugadores de un equipo (búsqueda por nombre)
 * @param {string} teamId - ID del equipo
 */
async function getTeamPlayers(teamId) {
  try {
    // Obtener info del equipo
    const teamInfo = await getTeamInfo(teamId);
    if (!teamInfo) {
      return [];
    }

    // Buscar jugadores por nombre del equipo
    const players = await searchPlayers(teamInfo.name);

    // Filtrar jugadores relevantes (por nombre de equipo o posición)
    if (players && players.length > 0) {
      return players.slice(0, 15).map(p => ({
        id: p.player_id,
        name: p.name || p.player_name,
        position: p.position || 'Unknown'
      }));
    }

    return [];
  } catch (error) {
    console.error('Error getTeamPlayers:', error.message);
    return [];
  }
}

/**
 * Alias para obtener estadísticas de un partido (nombre usado por otros módulos)
 * @param {string} eventId - ID del evento/partido
 */
async function getMatchStats(eventId) {
  return getMatchAllStats(eventId);
}

// ==================== EXPORTS ====================

module.exports = {
  // Búsquedas
  searchAll,
  searchTeams,
  searchPlayers,
  searchLeagues,
  searchMatches,

  // Ligas
  getAllSeasons,
  getAllCountries,

  // Partidos
  getMatchesByDate,
  getMatchesByDateAndLeague,
  getAllMatchesByLeague,
  getTodayMatches,

  // Equipos
  getHomeTeams,
  getAwayTeams,
  getTeamInfo,
  getTeamLogo,
  getTeamMatches,
  getTeamPlayers,

  // Jugadores
  getPlayerDetail,
  getPlayerLogo,

  // Detalle partido
  getMatchDetail,
  getMatchScore,
  getMatchStatus,

  // Estadísticas
  getMatchAllStats,
  getMatchStats,
  getMatchFirstHalfStats,
  getMatchSecondHalfStats,

  // Clasificaciones
  getStandings,
  getHomeStandings,
  getAwayStandings,
  getWorldCupGroupTable,
  MUNDIAL_GRUPOS,

  // Top jugadores
  getTopAssists,
  getTopScorers,
  getTopRating,

  // Helpers
  getLeagueId,
  normalizeTeamName,
  buscarEquipoDinamico
};
