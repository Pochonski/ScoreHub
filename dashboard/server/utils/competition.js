/**
 * competition.js — helper compartido para resolver la competición activa
 * a partir del query string. Usado por todos los controllers que filtran
 * por `competition_id`. Lee de la tabla `active_competitions` que es
 * mantenida por la migración 008.
 *
 * Convenciones:
 *  - Default `competitionId`: `PRIMARY_COMPETITION_ID` env (fallback 5930).
 *  - Validación: si el competitionId no está en `active_competitions
 *    WHERE is_active=TRUE`, responde 404.
 *  - Cache de la lista activa: 5 minutos (TTL en memoria).
 *
 * Uso:
 *   const { competitionId, seasonNum, comp } = await resolveCompetition(req, res);
 *   if (!competitionId) return; // 404 ya enviado
 */

const db = require('../../../database/db');

const DEFAULT_COMP_ID = parseInt(process.env.PRIMARY_COMPETITION_ID || '5930', 10);
const DEFAULT_SEASON = parseInt(process.env.PRIMARY_SEASON || '25', 10);

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache = { at: 0, byId: new Map(), list: [] };

async function loadActiveCompetitions(force = false) {
  const now = Date.now();
  if (!force && cache.list.length && now - cache.at < CACHE_TTL_MS) {
    return cache;
  }
  const rows = await db.execAdvanced(`
    SELECT id, display_name, short_name, country_id, country_name,
           season_num, season_label, start_date, end_date,
           is_active, is_featured, display_order,
           has_brackets, has_groups, has_history, config
      FROM active_competitions
     WHERE is_active = TRUE
     ORDER BY display_order ASC, id ASC
  `);
  const list = rows.map(r => ({
    id: Number(r.id),
    displayName: r.display_name,
    shortName: r.short_name,
    countryId: r.country_id != null ? Number(r.country_id) : null,
    countryName: r.country_name,
    seasonNum: Number(r.season_num),
    seasonLabel: r.season_label,
    startDate: r.start_date,
    endDate: r.end_date,
    isFeatured: r.is_featured,
    displayOrder: r.display_order,
    hasBrackets: r.has_brackets,
    hasGroups: r.has_groups,
    hasHistory: r.has_history,
    config: r.config,
  }));
  const byId = new Map(list.map(c => [c.id, c]));
  cache = { at: now, list, byId };
  return cache;
}

function invalidateCompetitionCache() {
  cache = { at: 0, list: [], byId: new Map() };
}

// Hot-paths can opt-in to bypass cache by reading from DB directly.
function _peekCache() { return cache; }

/**
 * Parsea y valida el `competitionId` desde la request. Si no se pasa en
 * query, usa el default (PRIMARY_COMPETITION_ID). Si el id no está en
 * `active_competitions` activos, responde 404.
 *
 * Acepta:
 *   ?competitionId=5930          (preferred, query)
 *   ?competition=5930            (alias)
 *   X-Competition-Id: 5930       (header, optional)
 *   params.id                    (Express path param, opcional)
 *
 * Retorna `{ competitionId, seasonNum, comp }` o `null` si respondió 404.
 */
async function resolveCompetition(req, res, { allowNone = false, fallback } = {}) {
  const raw = req.query.competitionId
            ?? req.query.competition
            ?? req.headers['x-competition-id']
            ?? (req.params && req.params.id ? parseInt(req.params.id, 10) : null)
            ?? null;
  const requested = raw != null && raw !== '' ? parseInt(raw, 10) : (fallback ?? DEFAULT_COMP_ID);

  if (!Number.isFinite(requested)) {
    if (allowNone) return null;
    res.status(400).json({ error: 'competitionId inválido' });
    return null;
  }

  const { byId, list } = await loadActiveCompetitions();
  const comp = byId.get(requested) || null;
  if (!comp) {
    if (allowNone) return null;
    res.status(404).json({
      error: 'Competición no disponible',
      competitionId: requested,
      available: list.map(c => ({ id: c.id, displayName: c.displayName })),
    });
    return null;
  }

  return {
    competitionId: comp.id,
    seasonNum: comp.seasonNum,
    comp,
  };
}

/**
 * Devuelve todos los IDs activos. Útil para queries "todas las
 * competiciones" (ej. home multi-comp con ?competitionIds=).
 */
async function getActiveCompetitionIds() {
  const { list } = await loadActiveCompetitions();
  return list.map(c => c.id);
}

/**
 * Devuelve la lista completa de competiciones activas (cacheada 5min).
 */
async function getActiveCompetitions() {
  const { list } = await loadActiveCompetitions();
  return list;
}

/**
 * Resuelve una lista de IDs (?competitionIds=5930,5056). Si no se pasa,
 * devuelve todos los activos. Cada ID se valida contra `active_competitions`.
 */
async function resolveCompetitionIds(req, res) {
  const raw = req.query.competitionIds || req.query.competitionId;
  if (!raw) {
    return getActiveCompetitionIds();
  }
  const ids = String(raw)
    .split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(Number.isFinite);
  const { byId } = await loadActiveCompetitions();
  const valid = ids.filter(id => byId.has(id));
  if (valid.length === 0) {
    res.status(400).json({ error: 'competitionIds inválidos', provided: ids });
    return null;
  }
  return valid;
}

module.exports = {
  resolveCompetition,
  resolveCompetitionIds,
  getActiveCompetitions,
  getActiveCompetitionIds,
  loadActiveCompetitions,
  invalidateCompetitionCache,
  _peekCache,
};
