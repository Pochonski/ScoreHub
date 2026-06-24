// Handler de tablas de posiciones
const footballApi = require('../services/footballApi');
const { formatTabla } = require('../utils/formatters');
const { LIGAS } = require('../utils/constants');

/**
 * Obtiene tabla de posiciones de una liga
 */
async function getTabla(liga) {
  try {
    // Si es Mundial, usar tabla de grupo
    if (liga.id === LIGAS.MUNDIAL.id) {
      return await getTablaMundial();
    }

    // Para otras ligas, usar standings normal
    const data = await footballApi.getStandings(liga.id);

    if (!data || data.length === 0) {
      return `⚠️ No hay tabla disponible para ${liga.nombre}.`;
    }

    return formatTabla(data, liga.nombre);
  } catch (error) {
    console.error('Error getTabla:', error);
    return `⚠️ No pude obtener la tabla de ${liga.nombre}.`;
  }
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
        msg += '```\n';
        msg += ' Pos | Equipo           | PJ | V | E | D |  GF-GC  | Pts\n';
        msg += '------|------------------|----|---|---|---|---------|-----\n';

        table.forEach(t => {
          const nombre = t.name.padEnd(17);
          msg += ` ${String(t.rank).padStart(2)}  | ${nombre} | ${String(t.played).padStart(2)} | ${String(t.wins).padStart(1)} | ${String(t.draws).padStart(1)} | ${String(t.losses).padStart(1)} |  ${String(t.goalsFor).padStart(2)}-${String(t.goalsAgainst).padStart(2)}  | ${String(t.points).padStart(3)}\n`;
        });

        msg += '```\n\n';
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
    msg += '```\n';
    msg += ' Pos | Equipo           | PJ | V | E | D |  GF-GC  | Pts\n';
    msg += '------|------------------|----|---|---|---|---------|-----\n';

    table.forEach(t => {
      const nombre = t.name.padEnd(17);
      msg += ` ${String(t.rank).padStart(2)}  | ${nombre} | ${String(t.played).padStart(2)} | ${String(t.wins).padStart(1)} | ${String(t.draws).padStart(1)} | ${String(t.losses).padStart(1)} |  ${String(t.goalsFor).padStart(2)}-${String(t.goalsAgainst).padStart(2)}  | ${String(t.points).padStart(3)}\n`;
    });

    msg += '```\n';

    return msg;
  } catch (error) {
    console.error('Error getTablaGrupoMundial:', error);
    return `⚠️ No pude obtener la tabla del Grupo ${grupo}.`;
  }
}

module.exports = { getTabla, getTablaMundial, getTablaGrupoMundial };
