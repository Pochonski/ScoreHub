#!/usr/bin/env node
/**
 * scripts/activate-supabase-http.js — Fase 8.5
 *
 * Helper que documenta y automatiza (cuando sea posible) la activación
 * del path HTTP PostgREST de Supabase. El operador necesita:
 *
 *   1. SUPABASE_URL (ya conocido: https://jcfulxsqayscvqgxemhv.supabase.co)
 *   2. SUPABASE_SERVICE_ROLE_KEY (del dashboard de Supabase — NO se puede
 *      generar localmente, debe venir del operador).
 *
 * Este script:
 *   - Verifica el estado actual (env vars, isEnabled()).
 *   - Si SUPABASE_SERVICE_ROLE_KEY está en .env, hace roundtrip HTTP.
 *   - Emite instrucciones paso-a-paso para el dashboard de Supabase.
 *
 * Usage:
 *   node scripts/activate-supabase-http.js
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/activate-supabase-http.js
 */

require('dotenv').config();
const { isEnabled, getClient } = require('../database/supabaseClient');

const PROJECT_URL = 'https://jcfulxsqayscvqgxemhv.supabase.co';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function ok(s) { return `\x1b[32m✓ ${s}\x1b[0m`; }
function bad(s) { return `\x1b[31m✗ ${s}\x1b[0m`; }
function info(s) { return `\x1b[36mℹ ${s}\x1b[0m`; }
function step(s) { return `\x1b[1m${s}\x1b[0m`; }

async function main() {
  console.log('--- Activación de Supabase JS HTTP path (Fase 8.5) ---\n');

  // 1. Verificar URL
  console.log(`1. SUPABASE_URL`);
  if (SUPABASE_URL === PROJECT_URL) {
    console.log(`   ${ok(`configurada correctamente: ${SUPABASE_URL}`)}`);
  } else if (SUPABASE_URL) {
    console.log(`   ${bad(`valor diferente al esperado: ${SUPABASE_URL}`)}`);
    console.log(`   ${info(`esperado: ${PROJECT_URL}`)}`);
  } else {
    console.log(`   ${bad('no configurada')}`);
  }
  console.log('');

  // 2. Verificar service role key
  console.log(`2. SUPABASE_SERVICE_ROLE_KEY`);
  if (SUPABASE_SERVICE_ROLE_KEY) {
    if (SUPABASE_SERVICE_ROLE_KEY.startsWith('eyJ')) {
      console.log(`   ${ok(`configurada (${SUPABASE_SERVICE_ROLE_KEY.slice(0, 25)}..., length ${SUPABASE_SERVICE_ROLE_KEY.length})`)}`);
    } else {
      console.log(`   ${bad('formato inválido (no empieza con eyJ)')}`);
    }
  } else {
    console.log(`   ${bad('no configurada')}`);
    console.log('');
    console.log(step('   Pasos para obtenerla:'));
    console.log(`   1. Ir a https://supabase.com/dashboard/project/jcfulxsqayscvqgxemhv/settings/api`);
    console.log(`   2. En "Project API keys", buscar "service_role" (NO la "anon public")`);
    console.log(`   3. Click "Copy" en service_role → pegar en .env`);
    console.log(`   4. O bien añadir como env var en Vercel (Production + Preview)`);
    console.log('');
    console.log(step('   ⚠️  IMPORTANTE:'));
    console.log(`   - La service_role key BYPASSEA RLS — equivalente a admin.`);
    console.log(`   - NUNCA exponerla al cliente. Solo el servidor debe usarla.`);
    console.log(`   - Si se filtra, rotarla inmediatamente desde el dashboard.`);
  }
  console.log('');

  // 3. Verificar isEnabled
  console.log(`3. supabaseClient.isEnabled()`);
  if (isEnabled()) {
    console.log(`   ${ok('yes')}`);
  } else {
    console.log(`   ${bad('no')}`);
    console.log(`   ${info('Aún no se puede inicializar el cliente HTTP.')}`);
    console.log('');
    process.exit(1);
  }
  console.log('');

  // 4. Test HTTP roundtrip
  console.log(`4. HTTP roundtrip a ${PROJECT_URL}/rest/v1`);
  try {
    const start = Date.now();
    const client = getClient();
    const { data, error } = await client
      .from('active_competitions')
      .select('id, display_name')
      .order('id', { ascending: true })
      .limit(1);
    const elapsed = Date.now() - start;
    if (error) {
      console.log(`   ${bad(`HTTP query failed: ${error.message}`)}`);
      console.log(`   ${info('Verifica que la key sea service_role (no anon)')}`);
      process.exit(2);
    }
    if (!Array.isArray(data)) {
      console.log(`   ${bad('HTTP query returned unexpected payload shape')}`);
      process.exit(2);
    }
    console.log(`   ${ok(`roundtrip exitoso en ${elapsed}ms`)}`);
    console.log(`   ${info(`rows: ${data.length}, sample: id=${data[0]?.id} ${data[0]?.display_name || ''}`)}`);
  } catch (e) {
    console.log(`   ${bad(`HTTP roundtrip failed: ${e.message || e}`)}`);
    console.log(`   ${info('Verifica que la URL sea reachable desde este network')}`);
    process.exit(2);
  }
  console.log('');

  // 5. Health endpoint guidance
  console.log(`5. Validación en /api/football/health`);
  console.log(`   Después del deploy con env vars en Vercel, verificar:`);
  console.log(`   ${info('curl https://scorehub-pocho.vercel.app/api/football/health | jq .')}`);
  console.log('');
  console.log(`   Campos esperados:`);
  console.log(`   - dbStrategy: "http+pg-fallback" (ya no "pg-only")`);
  console.log(`   - dbStats.supabaseCalls > 0 (después de navegar por la web)`);
  console.log(`   - dbStats.supabasePercent >= 80`);
  console.log('');

  console.log(step('Resumen:'));
  console.log(`   ${ok('Supabase JS HTTP path activado')}`);
  console.log(`   ${info('db.query() ahora usa PostgREST (HTTP, sin conexión persistente)')}`);
  console.log(`   ${info('db.execAdvanced() sigue usando pg con max=1 (CTEs, multi-JOIN)')}`);
  console.log(`   ${info('Ver health endpoint para confirmar métricas')}`);
}

main().catch(err => {
  console.error(`\n${bad('Error inesperado:')} ${err.message}`);
  process.exit(3);
});