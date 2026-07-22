/**
 * syncCompetitions.js — helper compartido por `syncService.js` para iterar
 * las competiciones activas. Reemplaza el uso de `COMPETITION_ID` global
 * por una lista curada en la tabla `active_competitions` (migración 008).
 *
 * Cada sync por competición va envuelto en `Promise.allSettled` para que
 * un fallo en una (ej. upstream rate-limit en Liga Promerica) no tumbe
 * el resto.
 */

const { pool } = require('../database/connection');

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache = { at: 0, list: [] };

async function getActiveCompetitions({ force = false } = {}) {
  const now = Date.now();
  if (!force && cache.list.length && now - cache.at < CACHE_TTL_MS) {
    return cache.list;
  }
  const { rows } = await pool.query(`
    SELECT id, display_name, season_num, season_label,
           start_date, end_date,
           has_brackets, has_groups, has_history
      FROM active_competitions
     WHERE is_active = TRUE
     ORDER BY display_order ASC, id ASC
  `);
  cache = {
    at: now,
    list: rows.map(r => ({
      id: Number(r.id),
      displayName: r.display_name,
      seasonNum: Number(r.season_num),
      seasonLabel: r.season_label,
      // 365scores acepta YYYYMMDD sin separadores. Si no hay start_date
      // configurado, usamos una ventana generosa (-30 días / +60 días).
      startDate: r.start_date
        ? r.start_date.toISOString().slice(0, 10).replace(/-/g, '')
        : null,
      endDate: r.end_date
        ? r.end_date.toISOString().slice(0, 10).replace(/-/g, '')
        : null,
      hasBrackets: r.has_brackets,
      hasGroups: r.has_groups,
      hasHistory: r.has_history,
    })),
  };
  return cache.list;
}

function invalidate() {
  cache = { at: 0, list: [] };
}

/**
 * Ejecuta `fn(comp)` para cada competición activa con aislamiento de
 * errores. Devuelve un resumen `{ total, ok, failed, errors }`.
 *
 * Si `opts.parallel` es true, ejecuta en paralelo; si no, en secuencia
 * (recomendado para no saturar el upstream).
 */
async function forEachActive(fn, opts = {}) {
  const { parallel = false, logPrefix = '[Sync]' } = opts;
  const comps = await getActiveCompetitions();
  if (!comps.length) {
    console.log(logPrefix, 'No hay competiciones activas; nada que sincronizar.');
    return { total: 0, ok: 0, failed: 0, errors: [] };
  }

  const errors = [];
  let ok = 0;
  let failed = 0;

  if (parallel) {
    const results = await Promise.allSettled(comps.map(c => fn(c)));
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const c = comps[i];
      if (r.status === 'fulfilled') {
        ok++;
      } else {
        failed++;
        const msg = r.reason?.message || String(r.reason);
        errors.push({ competitionId: c.id, error: msg });
        console.error(`${logPrefix}[comp=${c.id}] FAILED:`, msg);
      }
    }
  } else {
    for (const c of comps) {
      try {
        await fn(c);
        ok++;
      } catch (e) {
        failed++;
        const msg = e?.message || String(e);
        errors.push({ competitionId: c.id, error: msg });
        console.error(`${logPrefix}[comp=${c.id}] FAILED:`, msg);
      }
    }
  }

  return { total: comps.length, ok, failed, errors };
}

/**
 * Filtra los partidos de un rango de fechas que pertenecen a una lista
 * de competiciones activas. Usado por `syncGames` para no depender de
 * un solo `COMPETITION_ID`.
 */
function filterGamesByActiveComps(games) {
  // Se importa on-demand para evitar ciclos
  // eslint-disable-next-line global-require
  const ids = cache.list.map(c => c.id);
  return (games || []).filter(g => ids.includes(Number(g.competitionId)));
}

module.exports = {
  getActiveCompetitions,
  forEachActive,
  filterGamesByActiveComps,
  invalidate,
};
