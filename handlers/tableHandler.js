// Handler de tablas de posiciones
const cache = require('../services/mundialCache');
const { getCompetitionName } = require('../services/competitionName');
const { PRIMARY_COMPETITION_ID: COMPETITION_ID } = require('../services/config');
const { formatTabla, formatGroupTable } = require('../utils/formatters');

const LIGAS_SOPORTADAS = {
  'mundial': { id: COMPETITION_ID, nombre: null },
  'mundial 2026': { id: COMPETITION_ID, nombre: null },
  'world cup': { id: COMPETITION_ID, nombre: null },
  'wc': { id: COMPETITION_ID, nombre: null },
  'copa del mundo': { id: COMPETITION_ID, nombre: null },
};

const MENSAJE_NO_SOPORTADO = (liga) => `⚠️ Solo soporto tablas de la competencia actual por ahora. La liga "${liga}" no está disponible en mi fuente actual.`;

async function getTabla(liga) {
  try {
    let ligaKey, ligaNombre;
    if (typeof liga === 'string') {
      const lower = liga.toLowerCase().trim();
      const alias = LIGAS_SOPORTADAS[lower];
      if (alias) {
        ligaKey = alias.id;
        ligaNombre = alias.nombre;
      } else {
        return MENSAJE_NO_SOPORTADO(liga);
      }
    } else if (liga && typeof liga === 'object') {
      ligaKey = liga.id;
      ligaNombre = liga.nombre;
    }
    if (!ligaKey) {
      return `⚠️ Liga no reconocida. Prueba: "mundial", "world cup", "wc", "copa del mundo".`;
    }
    if (ligaKey === LIGAS_SOPORTADAS.mundial.id) {
      return await getTablaMundial(ligaNombre);
    }
    return MENSAJE_NO_SOPORTADO(ligaNombre || ligaKey);
  } catch (error) {
    console.error('Error getTabla:', error);
    return `⚠️ No pude obtener la tabla.`;
  }
}

async function getTablaMundial(ligaNombre) {
  try {
    const standings = await cache.getWorldCupStandings();
    if (!standings || standings.length === 0) {
      return `⚠️ No hay datos de tabla disponibles.`;
    }
    const gruposMap = {};
    for (const standing of standings) {
      const grupoLetra = standing.name?.match(/Group\s+([A-L])/i)?.[1]?.toUpperCase();
      if (!grupoLetra) continue;
      const equipos = (standing.teams || []).map((t) => ({
        rank: t.idx,
        name: t.name,
        shortName: t.shortName,
        teamId: t.id,
        played: t.played,
        wins: t.wins,
        draws: t.draws,
        losses: t.losses,
        goalsFor: parseInt((t.scoresStr || '0-0').split('-')[0]) || 0,
        goalsAgainst: parseInt((t.scoresStr || '0-0').split('-')[1]) || 0,
        goalDiff: t.goalConDiff,
        points: t.pts,
      })).sort((a, b) => (a.rank || 99) - (b.rank || 99));
      gruposMap[grupoLetra] = equipos;
    }
    const grupos = Object.keys(gruposMap).sort();
    if (grupos.length === 0) {
      return `⚠️ No encontré datos por grupo en la respuesta.`;
    }
    const compName = ligaNombre || await getCompetitionName(COMPETITION_ID);
    let msg = `🏆 *TABLA ${compName}*\n\n`;
    for (const g of grupos) {
      msg += formatGroupTable(gruposMap[g], g) + '\n\n';
    }
    return msg.trim();
  } catch (error) {
    console.error('Error getTablaMundial:', error);
    return `⚠️ No pude obtener la tabla.`;
  }
}

async function getTablaGrupoMundial(grupo) {
  try {
    const grupoUpper = grupo.toUpperCase();
    if (!/^[A-L]$/.test(grupoUpper)) {
      return `⚠️ Grupo inválido. Usa: A, B, C, D, E, F, G, H, I, J, K, L.`;
    }
    const standings = await cache.getWorldCupStandings();
    if (!standings || standings.length === 0) {
      return `⚠️ No hay datos de tabla disponibles.`;
    }
    for (const standing of standings) {
      const grupoLetra = standing.name?.match(/Group\s+([A-L])/i)?.[1]?.toUpperCase();
      if (grupoLetra === grupoUpper) {
        const equipos = (standing.teams || []).map((t) => ({
          rank: t.idx,
          name: t.name,
          shortName: t.shortName,
          teamId: t.id,
          played: t.played,
          wins: t.wins,
          draws: t.draws,
          losses: t.losses,
          goalsFor: parseInt((t.scoresStr || '0-0').split('-')[0]) || 0,
          goalsAgainst: parseInt((t.scoresStr || '0-0').split('-')[1]) || 0,
          goalDiff: t.goalConDiff,
          points: t.pts,
        })).sort((a, b) => (a.rank || 99) - (b.rank || 99));
        if (equipos.length === 0) {
          return `⚠️ No hay datos para el Grupo ${grupoUpper}.`;
        }
        return formatGroupTable(equipos, grupoUpper);
      }
    }
    return `⚠️ Grupo ${grupoUpper} no encontrado.`;
  } catch (error) {
    console.error('Error getTablaGrupoMundial:', error);
    return `⚠️ No pude obtener la tabla del Grupo ${grupo}.`;
  }
}

module.exports = { getTabla, getTablaMundial, getTablaGrupoMundial };