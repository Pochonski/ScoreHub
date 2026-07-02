// Handler de tablas de posiciones
const footballApi = require('../services/footballApi');
const { formatTabla } = require('../utils/formatters');
const { LIGAS } = require('../utils/constants');

/**
 * Obtiene tabla de posiciones de una liga
 * Acepta: string ("premier", "la liga") u objeto {id, nombre}
 */
async function getTabla(liga) {
  try {
    let ligaId;
    let ligaNombre;

    if (typeof liga === 'string') {
      // Mapeo de nombres comunes a IDs
      const lower = liga.toLowerCase().trim();
      // Primero intentar con getLeagueId de la API service
      const apiId = footballApi.getLeagueId(lower);
      if (apiId) {
        ligaId = apiId;
        ligaNombre = capitalizeFirst(liga);
      } else {
        // Mapeo de fallback para variantes coloquiales
        const fallback = matchLeagueName(lower);
        if (!fallback) {
          return `⚠️ No reconocí la liga "${liga}". Prueba: "premier", "la liga", "bundesliga", "champions", "serie a", "libertadores".`;
        }
        ligaId = fallback.id;
        ligaNombre = fallback.nombre;
      }
    } else if (liga && typeof liga === 'object') {
      ligaId = liga.id;
      ligaNombre = liga.nombre;
    }

    if (!ligaId) {
      return `⚠️ Liga no reconocida. Prueba: "premier", "la liga", "bundesliga", "champions".`;
    }

    // Si es Mundial, usar tabla general
    if (ligaId === LIGAS.MUNDIAL.id) {
      return await getTablaMundial();
    }

    const data = await footballApi.getStandings(ligaId);

    if (!data || data.length === 0) {
      return `⚠️ No hay tabla disponible para ${ligaNombre}.`;
    }

    return formatTabla(data, ligaNombre);
  } catch (error) {
    console.error('Error getTabla:', error);
    return `⚠️ No pude obtener la tabla.`;
  }
}

/**
 * Fallback: mapea nombres coloquiales de ligas a objetos {id, nombre}
 */
function matchLeagueName(name) {
  const map = {
    'premier': { id: 47, nombre: 'Premier League' },
    'premier league': { id: 47, nombre: 'Premier League' },
    'inglaterra': { id: 47, nombre: 'Premier League' },
    'laliga': { id: 87, nombre: 'La Liga' },
    'la liga': { id: 87, nombre: 'La Liga' },
    'liga': { id: 87, nombre: 'La Liga' },
    'españa': { id: 87, nombre: 'La Liga' },
    'espanol': { id: 87, nombre: 'La Liga' },
    'serie a': { id: 55, nombre: 'Serie A' },
    'italia': { id: 55, nombre: 'Serie A' },
    'bundesliga': { id: 54, nombre: 'Bundesliga' },
    'alemania': { id: 54, nombre: 'Bundesliga' },
    'ligue 1': { id: 53, nombre: 'Ligue 1' },
    'francia': { id: 53, nombre: 'Ligue 1' },
    'champions': { id: 42, nombre: 'Champions League' },
    'champions league': { id: 42, nombre: 'Champions League' },
    'libertadores': { id: 134, nombre: 'Copa Libertadores' },
    'europa league': { id: 73, nombre: 'Europa League' },
    'copa america': { id: 13, nombre: 'Copa América' },
    'mundial': { id: 77, nombre: 'Copa Mundial' },
  };
  return map[name] || null;
}

function capitalizeFirst(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Obtiene la tabla del Mundial (todos los grupos)
 */
async function getTablaMundial() {
  try {
    const grupos = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];

    let msg = `🏆 *TABLA MUNDIAL 2026*\n\n`;

    for (const grupo of grupos) {
      const leagueId = footballApi.MUNDIAL_GRUPOS[grupo];
      if (!leagueId) continue;

      const table = await footballApi.getWorldCupGroupTable(leagueId);

      if (table.length > 0) {
        msg += `📋 *GRUPO ${grupo}*\n`;

        table.forEach(t => {
          const emoji = t.rank === 1 ? '🥇' : t.rank === 2 ? '🥈' : t.rank === 3 ? '🥉' : '';
          const gd = t.goalDiff > 0 ? `+${t.goalDiff}` : t.goalDiff;
          msg += `${emoji}*${t.rank}.* ${t.name}\n`;
          msg += `   PJ:${t.played} V:${t.wins} E:${t.draws} D:${t.losses} GF:${t.goalsFor} GC:${t.goalsAgainst} *${t.points}pts*\n`;
        });

        msg += '\n';
      }
    }

    return msg.trim();
  } catch (error) {
    console.error('Error getTablaMundial:', error);
    return `⚠️ No pude obtener la tabla del Mundial.`;
  }
}

/**
 * Obtiene tabla de un grupo específico del Mundial
 */
async function getTablaGrupoMundial(grupo) {
  try {
    const leagueId = footballApi.MUNDIAL_GRUPOS[grupo.toUpperCase()];
    if (!leagueId) {
      return `⚠️ Grupo ${grupo} no encontrado.`;
    }

    const table = await footballApi.getWorldCupGroupTable(leagueId);

    if (!table || table.length === 0) {
      return `⚠️ No hay datos para el Grupo ${grupo}.`;
    }

    let msg = `📋 *GRUPO ${grupo.toUpperCase()} - MUNDIAL 2026*\n\n`;

    table.forEach(t => {
      const emoji = t.rank === 1 ? '🥇' : t.rank === 2 ? '🥈' : t.rank === 3 ? '🥉' : '';
      const gd = t.goalDiff > 0 ? `+${t.goalDiff}` : t.goalDiff;
      msg += `${emoji}*${t.rank}.* ${t.name}\n`;
      msg += `   PJ:${t.played} V:${t.wins} E:${t.draws} D:${t.losses} GF:${t.goalsFor}-${t.goalsAgainst}(${gd}) *${t.points}pts*\n`;
    });

    return msg;
  } catch (error) {
    console.error('Error getTablaGrupoMundial:', error);
    return `⚠️ No pude obtener la tabla del Grupo ${grupo}.`;
  }
}

module.exports = { getTabla, getTablaMundial, getTablaGrupoMundial };
