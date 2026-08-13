#!/usr/bin/env node
/**
 * scripts/check-supabase-config.js
 *
 * Diagnóstico rápido que verifica si los env vars de Supabase JS están
 * configurados correctamente. Útil después de desplegar o cuando se
 * sospecha que el wrapper está cayendo a pg.
 *
 * Usage:
 *   node scripts/check-supabase-config.js
 *
 * Exit codes:
 *   0  → Supabase JS HTTP path activated
 *   1  → not configured, missing or malformed env vars
 *   2  → runtime error talking to Supabase or pg
 *
 * Si la salida es "NOT configured" o "HTTP query test failed", agregar
 * a Vercel:
 *   SUPABASE_URL=https://<project>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=<eyJ...>
 *
 * El service role key NO es la anon key — tiene bypass de RLS y acceso
 * completo. Tratar como secreto de máximo nivel.
 */

const { isEnabled, getClient } = require('../database/supabaseClient');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function ok(s) { return `✓ ${s}`; }
function bad(s) { return `✗ ${s}`; }

/* --- Format checks --- */

const urlLooksValid =
  /^https:\/\/([a-z0-9-]+)\.supabase\.co\/?$/.test(SUPABASE_URL.trim());

const keyLooksValid =
  /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(SUPABASE_SERVICE_ROLE_KEY);

/* --- Output --- */

console.log('--- Supabase JS Configuration Check ---');
console.log('');
console.log(`SUPABASE_URL                   : ${
  SUPABASE_URL ? (urlLooksValid ? ok(SUPABASE_URL) : bad('format invalid')) : bad('missing')
}`);
console.log(`SUPABASE_SERVICE_ROLE_KEY      : ${
  SUPABASE_SERVICE_ROLE_KEY
    ? keyLooksValid
      ? ok(`${SUPABASE_SERVICE_ROLE_KEY.slice(0, 20)}… (length ${SUPABASE_SERVICE_ROLE_KEY.length})`)
      : bad('format invalid (expected JWT like eyJ…)')
    : bad('missing')
}`);
console.log(`supabaseClient.isEnabled()     : ${isEnabled() ? ok('yes') : bad('no')}`);
console.log('');

if (!isEnabled()) {
  console.log('⚠ Supabase JS not configured');
  console.log('  → db.query() routes to queryViaPg (max=1 connection pool)');
  console.log('  → db.execAdvanced() also uses pg');
  console.log('');
  console.log('To enable:');
  console.log('  1. Vercel Dashboard → Project Settings → Environment Variables');
  console.log('  2. Add SUPABASE_URL=https://jcfulxsqayscvqgxemhv.supabase.co');
  console.log('  3. Add SUPABASE_SERVICE_ROLE_KEY=<eyJhbGciOi…> (use service_role,');
  console.log('     NOT the anon key — service_role bypasses RLS and is full admin)');
  console.log('  4. Redeploy for the new variables to take effect');
  console.log('  5. Re-run this script; /api/football/health should report');
  console.log('     dbStrategy: "http+pg-fallback"');
  process.exit(1);
}

/* --- Live HTTP roundtrip --- */

(async () => {
  let url = SUPABASE_URL.trim().replace(/\/+$/, '');
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
      console.log(bad(`HTTP query failed: ${error.message}`));
      console.log('  → check that SUPABASE_SERVICE_ROLE_KEY is the service_role, NOT anon');
      process.exit(2);
    }
    if (!Array.isArray(data)) {
      console.log(bad(`HTTP query returned unexpected payload shape: ${typeof data}`));
      process.exit(2);
    }
    console.log(ok(`HTTP roundtrip to ${url}/rest/v1 succeeded in ${elapsed}ms`));
    console.log(`  → active_competitions rows visible: ${data.length}`);
    if (data.length > 0) {
      console.log(`  → first row: id=${data[0].id} ${data[0].display_name || ''}`);
    }
    console.log('');
    console.log(ok('Supabase JS HTTP path activated'));
    console.log('  → db.query() routes to PostgREST (HTTP, no persistent connection)');
    console.log('  → db.execAdvanced() still uses pg with max=1 (CTE, multi-JOIN)');
    console.log('  → /api/football/health will show dbStats.supabaseCalls growing');
    process.exit(0);
  } catch (e) {
    console.log(bad(`HTTP roundtrip failed: ${e.message || e}`));
    console.log('  → verify the URL is reachable from this network');
    process.exit(2);
  }
})();
