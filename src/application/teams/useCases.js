/**
 * src/application/teams/useCases.js — Use-cases de equipos (Fase 8).
 *
 * Reemplazan los métodos de `handlers/teamHandler.js`:
 *   - getInfoEquipo        → createGetInfoEquipo
 *   - seguirEquipo         → createSeguirEquipo
 *   - dejarSeguirEquipo    → createDejarSeguirEquipo
 *   - getEquiposSeguidos   → createGetEquiposSeguidos
 *
 * Los 3 últimos usan `IUserRepository` (Fase 1) en lugar de `db.execAdvanced`
 * directo sobre la tabla `equipos_seguidos`. `getInfoEquipo` sólo lee desde
 * el cache de 365scores y helpers de contexto (no toca DB).
 *
 * `dbAvailable` se inyecta como `dbIsAvailable()` callback — el container
 * ya tiene `testConnection` configurado en `database/connection.js`.
 */

const { formatEquipoSeguido, formatMisEquipos, formatMatchLine } = require('../../../utils/formatters');

/* ────────────────────────────────────────────────────────────────────────── */
/* /info <equipo>                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

function createGetInfoEquipo({ cache, getFlag, getConfederation, getRecentForm, logger = console }) {
  if (!cache) throw new Error('createGetInfoEquipo: cache required');

  return async function getInfoEquipo(equipo) {
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
        msg += '📈 *Forma reciente:* sin datos\n\n';
      }
      const played = (rawMatches || [])
        .filter((m) => m.homeCompetitor?.score != null && m.homeCompetitor?.score >= 0 && m.awayCompetitor?.score != null && m.awayCompetitor?.score >= 0)
        .sort((a, b) => new Date(b.startTime || b.date) - new Date(a.startTime || a.date));
      if (played.length > 0) {
        msg += '📅 *Últimos partidos:*\n';
        played.slice(0, 3).forEach((m) => {
          msg += formatMatchLine(m, teamId).line + '\n';
        });
      } else {
        msg += '📅 *Últimos partidos:* sin datos\n';
      }
      msg += '\n👤 *Roster:* No tengo el roster completo, prueba con `/buscar <jugador>` para stats individuales.';
      return msg;
    } catch (error) {
      logger.error?.({ err: error }, 'Error getInfoEquipo');
      const name = typeof equipo === 'object' ? equipo.nombre : equipo;
      return `⚠️ No pude obtener información de ${name}.`;
    }
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* /seguir <equipo>                                                            */
/* ────────────────────────────────────────────────────────────────────────── */

function createSeguirEquipo({ userRepository, dbIsAvailable, cache, logger = console }) {
  if (!userRepository) throw new Error('createSeguirEquipo: userRepository required');

  return async function seguirEquipo(userId, equipo) {
    if (dbIsAvailable && !(await dbIsAvailable())) {
      return '⚠️ Base de datos no disponible. No puedo seguir equipos.';
    }
    try {
      let teamId = typeof equipo === 'object' ? equipo.id : null;
      let teamName = typeof equipo === 'object' ? equipo.nombre : equipo;
      if (!teamId) {
        const team = await cache.getTeamByName(teamName);
        if (!team) return `⚠️ No encontré al equipo "${teamName}".`;
        teamId = team.id;
        teamName = team.name;
      }
      await userRepository.addFollowedTeam(String(userId), teamId, teamName);
      return formatEquipoSeguido(teamName);
    } catch (error) {
      logger.error?.({ err: error }, 'Error seguirEquipo');
      return `⚠️ No pude seguir a ${typeof equipo === 'object' ? equipo.nombre : equipo}.`;
    }
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* /dejarseguir <equipo>                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

function createDejarSeguirEquipo({ userRepository, dbIsAvailable, cache, logger = console }) {
  if (!userRepository) throw new Error('createDejarSeguirEquipo: userRepository required');

  return async function dejarSeguirEquipo(userId, equipo) {
    if (dbIsAvailable && !(await dbIsAvailable())) {
      return '⚠️ Base de datos no disponible. No puedo dejar de seguir equipos.';
    }
    try {
      let teamId = typeof equipo === 'object' ? equipo.id : null;
      let teamName = typeof equipo === 'object' ? equipo.nombre : equipo;
      if (!teamId) {
        const team = await cache.getTeamByName(teamName);
        if (!team) return `⚠️ No encontré al equipo "${teamName}".`;
        teamId = team.id;
        teamName = team.name;
      }
      await userRepository.removeFollowedTeam(String(userId), teamId);
      return `✅ Has dejado de seguir a ${teamName}.`;
    } catch (error) {
      logger.error?.({ err: error }, 'Error dejarSeguirEquipo');
      return `⚠️ No pude dejar de seguir a ${typeof equipo === 'object' ? equipo.nombre : equipo}.`;
    }
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* /misequipos                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

function createGetEquiposSeguidos({ userRepository, dbIsAvailable, logger = console }) {
  if (!userRepository) throw new Error('createGetEquiposSeguidos: userRepository required');

  return async function getEquiposSeguidos(userId) {
    if (dbIsAvailable && !(await dbIsAvailable())) return formatMisEquipos([]);
    try {
      const followed = await userRepository.listFollowedTeams(String(userId));
      if (!followed.length) return formatMisEquipos([]);
      const rows = followed.map((f) => ({ id_equipo: f.teamId, nombre_equipo: f.teamName }));
      return formatMisEquipos(rows);
    } catch (error) {
      logger.error?.({ err: error }, 'Error getEquiposSeguidos');
      return formatMisEquipos([]);
    }
  };
}

module.exports = {
  createGetInfoEquipo,
  createSeguirEquipo,
  createDejarSeguirEquipo,
  createGetEquiposSeguidos,
};
