// Handler de información de equipos - Mundial 2026
const cache = require('../services/mundialCache');
const { formatEquipoSeguido, formatMisEquipos, formatMatchLine } = require('../utils/formatters');
const { getFlag, getConfederation, getRecentForm } = require('../utils/teamContext');
const { pool, testConnection } = require('../database/connection');
const { getCountryFlagUrl } = require('../services/images');

let dbAvailable = false;
let dbCheckPromise = null;
async function initDb() {
  if (dbCheckPromise) return dbAvailable;
  dbCheckPromise = testConnection().then((ok) => {
    dbAvailable = ok;
    return dbAvailable;
  });
  return dbCheckPromise;
}

async function getInfoEquipo(equipo) {
  try {
    let teamId = typeof equipo === 'object' ? equipo.id : null;
    let teamName = typeof equipo === 'object' ? equipo.nombre : equipo;
    if (!teamId) {
      const team = await cache.getTeamByName(teamName);
      if (!team) return `⚠️ No encontré al equipo "${teamName}".`;
      teamId = team.id;
      teamName = team.name;
    }
    const rawMatches = await cache.getRecentWorldCupMatchesByTeam(teamId);
    const flag = getFlag(teamName);
    const conf = getConfederation(teamName);
    const confText = conf ? ` · Confederación: *${conf}*` : '';
    const teamType = teamName.length > 20 ? '' : 'Selección';
    let msg = `${flag} *${teamName.toUpperCase()}*\n`;
    msg += `${teamType ? teamType : 'Equipo'}${confText}\n\n`;
    const form = getRecentForm(rawMatches, teamId, 5);
    if (form.played > 0) {
      const pct = Math.round((form.wins * 100) / form.played);
      msg += `📈 *Forma reciente (últimos ${form.played}):*\n`;
      msg += `${form.line}  —  ${form.wins}G ${form.draws}E ${form.losses}D (${pct}% victorias)\n\n`;
    } else {
      msg += `📈 *Forma reciente:* sin datos\n\n`;
    }
    const played = (rawMatches || [])
      .filter((m) => m.homeCompetitor?.score != null && m.homeCompetitor?.score >= 0 && m.awayCompetitor?.score != null && m.awayCompetitor?.score >= 0)
      .sort((a, b) => new Date(b.startTime || b.date) - new Date(a.startTime || a.date));
    if (played.length > 0) {
      msg += `📅 *Últimos partidos:*\n`;
      played.slice(0, 3).forEach((m) => {
        msg += formatMatchLine(m, teamId).line + '\n';
      });
    } else {
      msg += `📅 *Últimos partidos:* sin datos\n`;
    }
    msg += `\n👤 *Roster:* No tengo el roster completo, prueba con \`/buscar <jugador>\` para stats individuales.`;
    return msg;
  } catch (error) {
    console.error('Error getInfoEquipo:', error);
    const name = typeof equipo === 'object' ? equipo.nombre : equipo;
    return `⚠️ No pude obtener información de ${name}.`;
  }
}

async function seguirEquipo(userId, equipo) {
  await initDb();
  if (!dbAvailable) return `⚠️ Base de datos no disponible. No puedo seguir equipos.`;
  try {
    let teamId = typeof equipo === 'object' ? equipo.id : null;
    let teamName = typeof equipo === 'object' ? equipo.nombre : equipo;
    if (!teamId) {
      const team = await cache.getTeamByName(teamName);
      if (!team) return `⚠️ No encontré al equipo "${teamName}".`;
      teamId = team.id;
      teamName = team.name;
    }
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

async function dejarSeguirEquipo(userId, equipo) {
  await initDb();
  if (!dbAvailable) return `⚠️ Base de datos no disponible. No puedo dejar de seguir equipos.`;
  try {
    let teamId = typeof equipo === 'object' ? equipo.id : null;
    let teamName = typeof equipo === 'object' ? equipo.nombre : equipo;
    if (!teamId) {
      const team = await cache.getTeamByName(teamName);
      if (!team) return `⚠️ No encontré al equipo "${teamName}".`;
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

async function getEquiposSeguidos(userId) {
  await initDb();
  if (!dbAvailable) return formatMisEquipos([]);
  try {
    const res = await pool.query(
      `SELECT id_equipo, nombre_equipo FROM equipos_seguidos WHERE id_usuario = $1 ORDER BY fecha_seguimiento DESC`,
      [userId]
    );
    if (res.rows.length === 0) return formatMisEquipos([]);
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
  getEquiposSeguidos,
};