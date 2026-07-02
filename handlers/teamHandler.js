// Handler de información de equipos - Mundial 2026
const footballApi = require('../services/footballApi');
const { formatEquipoSeguido, formatMisEquipos, formatMatchLine } = require('../utils/formatters');
const { getFlag, getConfederation, getRecentForm } = require('../utils/teamContext');
const { pool, testConnection } = require('../database/connection');

// Flag de disponibilidad de DB (compartido con messageHandler)
let dbAvailable = false;
let dbCheckPromise = null;

async function initDb() {
  if (dbCheckPromise) return dbAvailable;
  dbCheckPromise = testConnection().then(ok => {
    dbAvailable = ok;
    return dbAvailable;
  });
  return dbCheckPromise;
}

/**
 * Info de un equipo — respuesta rica con confederación, forma, partidos y jugadores
 */
async function getInfoEquipo(equipo) {
  try {
    // Handle string u objeto
    let teamId = typeof equipo === 'object' ? equipo.id : null;
    let teamName = typeof equipo === 'object' ? equipo.nombre : equipo;
    const buscarDinamico = typeof equipo === 'object' ? equipo.buscarDinamico : true;

    if (!teamId || buscarDinamico) {
      const team = await footballApi.buscarEquipoDinamico(teamName);
      if (!team) {
        return `⚠️ No encontré al equipo "${teamName}".`;
      }
      teamId = team.id;
      teamName = team.name;
    }

    // Buscar en paralelo
    const [rawMatches, players] = await Promise.all([
      footballApi.getTeamMatches(teamId, 20),
      footballApi.getTeamPlayers(teamId),
    ]);

    const flag = getFlag(teamName);
    const conf = getConfederation(teamName);
    const confText = conf ? ` · Confederación: *${conf}*` : '';
    const teamType = teamName.length > 20 ? '' : 'Selección'; // heurística simple

    let msg = `${flag} *${teamName.toUpperCase()}*\n`;
    msg += `${teamType ? teamType : 'Equipo'}${confText}\n\n`;

    // Forma reciente (W-D-L) sobre los últimos 5 partidos JUGADOS
    const form = getRecentForm(rawMatches, teamId, 5);
    if (form.played > 0) {
      const pct = Math.round((form.wins * 100) / form.played);
      msg += `📈 *Forma reciente (últimos ${form.played}):*\n`;
      msg += `${form.line}  —  ${form.wins}G ${form.draws}E ${form.losses}D (${pct}% victorias)\n\n`;
    } else {
      msg += `📈 *Forma reciente:* sin datos\n\n`;
    }

    // Últimos partidos JUGADOS (filtrados, ordenados DESC, formato enriquecido)
    const played = (rawMatches || [])
      .filter(m => m.homeScore != null && m.awayScore != null)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (played.length > 0) {
      msg += `📅 *Últimos partidos:*\n`;
      const top = played.slice(0, 3);
      top.forEach(m => {
        msg += formatMatchLine(m, teamId).line + '\n';
      });
    } else {
      msg += `📅 *Últimos partidos:* sin datos\n`;
    }

    // Jugadores destacados (top 8, sin posición porque la API no la devuelve fiable)
    if (players && players.length > 0) {
      msg += `\n👤 *Jugadores destacados:*\n`;
      players.slice(0, 8).forEach(p => {
        msg += `• ${p.name}\n`;
      });
    }

    return msg;
  } catch (error) {
    console.error('Error getInfoEquipo:', error);
    const name = typeof equipo === 'object' ? equipo.nombre : equipo;
    return `⚠️ No pude obtener información de ${name}.`;
  }
}

/**
 * Seguir a un equipo (persiste en DB)
 */
async function seguirEquipo(userId, equipo) {
  await initDb();
  if (!dbAvailable) {
    return `⚠️ Base de datos no disponible. No puedo seguir equipos.`;
  }

  try {
    // Handle string equipo (from parser/telegram)
    let teamId = typeof equipo === 'object' ? equipo.id : null;
    let teamName = typeof equipo === 'object' ? equipo.nombre : equipo;
    const buscarDinamico = typeof equipo === 'object' ? equipo.buscarDinamico : true;

    if (!teamId || buscarDinamico) {
      const team = await footballApi.buscarEquipoDinamico(teamName);
      if (!team) {
        return `⚠️ No encontré al equipo "${teamName}".`;
      }
      teamId = team.id;
      teamName = team.name;
    }

    // Insertar en DB (ignora si ya existe)
    await pool.query(
      `INSERT INTO equipos_seguidos (id_usuario, id_equipo, nombre_equipo)
       VALUES ($1, $2, $3)
       ON CONFLICT (id_usuario, id_equipo) DO NOTHING`,
      [userId, teamId, teamName]
    );

    return formatEquipoSeguido(teamName);
  } catch (error) {
    console.error('Error seguirEquipo:', error);
    return `⚠️ No pude seguir a ${typeof equipo === 'object' ? equipo.nombre : equipo}.`;
  }
}

/**
 * Dejar de seguir a un equipo (borra de DB)
 */
async function dejarSeguirEquipo(userId, equipo) {
  await initDb();
  if (!dbAvailable) {
    return `⚠️ Base de datos no disponible. No puedo dejar de seguir equipos.`;
  }

  try {
    // Handle string equipo (from parser/telegram)
    let teamId = typeof equipo === 'object' ? equipo.id : null;
    let teamName = typeof equipo === 'object' ? equipo.nombre : equipo;
    const buscarDinamico = typeof equipo === 'object' ? equipo.buscarDinamico : true;

    if (!teamId || buscarDinamico) {
      const team = await footballApi.buscarEquipoDinamico(teamName);
      if (!team) {
        return `⚠️ No encontré al equipo "${teamName}".`;
      }
      teamId = team.id;
      teamName = team.name;
    }

    await pool.query(
      `DELETE FROM equipos_seguidos WHERE id_usuario = $1 AND (id_equipo = $2 OR nombre_equipo ILIKE $3)`,
      [userId, teamId, teamName]
    );

    return `✅ Has dejado de seguir a ${teamName}.`;
  } catch (error) {
    console.error('Error dejarSeguirEquipo:', error);
    return `⚠️ No pude dejar de seguir a ${typeof equipo === 'object' ? equipo.nombre : equipo}.`;
  }
}

/**
 * Lista de equipos seguidos por usuario (desde DB)
 */
async function getEquiposSeguidos(userId) {
  await initDb();
  if (!dbAvailable) {
    return formatMisEquipos([]);
  }

  try {
    const res = await pool.query(
      `SELECT id_equipo, nombre_equipo FROM equipos_seguidos WHERE id_usuario = $1 ORDER BY fecha_seguimiento DESC`,
      [userId]
    );

    if (res.rows.length === 0) {
      return formatMisEquipos([]);
    }

    return formatMisEquipos(res.rows);
  } catch (error) {
    console.error('Error getEquiposSeguidos:', error);
    return formatMisEquipos([]);
  }
}

module.exports = {
  getInfoEquipo,
  seguirEquipo,
  dejarSeguirEquipo,
  getEquiposSeguidos
};