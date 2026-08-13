/**
 * src/infrastructure/config.js — Configuración centralizada desde entorno
 * (Fase 7 + Auditoría 2026-Q3 Fase 4.1).
 *
 * Único punto de acceso a las env vars del proceso del bot. Antes se leían
 * ad-hoc en telegramBot.js, sync.js, services/*, database/connection.js;
 * centralizarlas acá da una fuente de verdad testeable y evita dispersión.
 *
 * `loadEnv()` se llama una sola vez desde los entry points (telegramBot.js, sync.js).
 * Después, cualquier `config.get('KEY')` retorna del cache.
 *
 * (Las env vars compartidas con otras apps —Supabase URL/key, ADMIN_TOKEN,
 *  DATABASE_URL— se siguen leyendo en sus módulos compartidos: supabaseClient,
 *  adminAuth, database/connection, hasta Fase 4.1b que los migrará.)
 */

const path = require('path');
const dotenv = require('dotenv');

let envLoaded = false;

function loadEnv() {
  if (envLoaded) return;
  dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });
  envLoaded = true;
}

const cache = new Map();

/**
 * Lee una env var del proceso. Lazy: la primera llamada carga .env.
 * Cachea el resultado para evitar lecturas repetidas.
 * @param {string} key
 * @param {string|undefined} [defaultValue]
 * @returns {string|undefined}
 */
function get(key, defaultValue) {
  loadEnv();
  if (!cache.has(key)) {
    const v = process.env[key];
    cache.set(key, v !== undefined ? v : defaultValue);
  }
  return cache.get(key);
}

/**
 * Lee una env var como entero. Lanza si el valor no es parseable.
 * @param {string} key
 * @param {number} [defaultValue]
 * @returns {number}
 */
function getInt(key, defaultValue) {
  const v = get(key, defaultValue);
  if (v === undefined) {
    throw new Error(`Config: ${key} is required (no default provided)`);
  }
  const n = parseInt(String(v), 10);
  if (Number.isNaN(n)) {
    throw new Error(`Config: ${key} must be an integer, got "${v}"`);
  }
  return n;
}

/**
 * Lee una env var como boolean. Acepta 'true', '1', 'yes' como true.
 * @param {string} key
 * @param {boolean} [defaultValue]
 * @returns {boolean}
 */
function getBool(key, defaultValue) {
  const v = get(key, defaultValue);
  if (typeof v === 'boolean') return v;
  return ['true', '1', 'yes'].includes(String(v).toLowerCase());
}

// Helpers tipados para los valores más usados.
//
// Auditoría 2026-Q3 Fase 4.1 + iteración: webhookSecret e isProduction NO
// se cachean porque deben reflejar el estado actual de process.env en
// runtime (los tests y el hot-reload dependen de esto).
const helpers = {
  telegramToken: () => get('TELEGRAM_BOT_TOKEN'),
  port: () => getInt('PORT', 8080),
  adminPort: () => getInt('ADMIN_PORT', 3001),
  dashboardPort: () => getInt('DASHBOARD_PORT', 3002),
  primaryCompetitionId: () => getInt('PRIMARY_COMPETITION_ID', 5930),
  primarySeason: () => getInt('PRIMARY_SEASON', 25),
  currentSeason: () => getInt('CURRENT_SEASON', 25),
  logLevel: () => get('LOG_LEVEL', 'info'),
  webhookSecret: () => process.env.WEBHOOK_SECRET, // sin cache: tests modifican en runtime
  adminToken: () => get('ADMIN_TOKEN'),
  adminStandalone: () => getBool('ADMIN_STANDALONE', false),
  enableLiveNotifier: () => getBool('ENABLE_LIVE_NOTIFIER', false),
  corsOrigins: () =>
    (get('CORS_ORIGINS', '') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  dbPoolMax: () => getInt('DB_POOL_MAX', 1),
  dbQueryRetries: () => getInt('DB_QUERY_RETRIES', 3),
  scores365Timezone: () => get('SCORES365_TIMEZONE', 'America/Costa_Rica'),
  scores365UserCountry: () => get('SCORES365_USER_COUNTRY', '153'),
  scores365Lang: () => get('SCORES365_LANG', '14'),
  scores365AppType: () => get('SCORES365_APP_TYPE', '5'),
  scores365PollMs: () => getInt('SCORES365_POLL_MS', 25000),
  scores365MinIntervalMs: () => getInt('SCORES365_MIN_INTERVAL_MS', 120),
  scores365HttpTimeoutMs: () => getInt('SCORES365_HTTP_TIMEOUT_MS', 15000),
  athleteHydrateTimeoutMs: () => getInt('ATHLETE_HYDRATE_TIMEOUT_MS', 8000),
  athleteStaleAfterMs: () => getInt('ATHLETE_STALE_AFTER_MS', 86400000),
  geminiModel: () => get('GEMINI_MODEL', 'gemini-2.5-flash'),
  ocrMinConfidence: () => parseFloat(
    process.env.OCR_MIN_CONFIDENCE ?? '0.5'
  ),
  simulateBotDryRun: () => Boolean(process.env.SIMULATE_BOT_DRY_RUN),
  nodeEnv: () => process.env.NODE_ENV || 'development', // sin cache
  isProduction: () => process.env.NODE_ENV === 'production', // sin cache
};

// Mantener retrocompatibilidad con el export anterior.
const legacy = {
  telegramToken: process.env.TELEGRAM_BOT_TOKEN,
  port: process.env.PORT || 8080,
  liveNotifierEnabled: process.env.ENABLE_LIVE_NOTIFIER === 'true',
};

module.exports = {
  loadEnv,
  get,
  getInt,
  getBool,
  helpers,
  // Retrocompat (deprecated): usar `helpers` en código nuevo.
  ...legacy,
};