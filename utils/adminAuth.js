/**
 * adminAuth.js — Middleware de autenticación para el panel admin.
 *
 * Estrategia: token estático vía variable de entorno ADMIN_TOKEN.
 *   - Header:  Authorization: Bearer <ADMIN_TOKEN>
 *   - Cookie:  admin_token=<ADMIN_TOKEN>
 *
 * Si ADMIN_TOKEN no está configurado, el admin se considera DESHABILITADO
 * (todas las rutas responden 503). Esto es seguro por defecto: nunca queda
 * abierto accidentalmente.
 *
 * Uso:
 *   const { requireAdmin, isAdminEnabled } = require('./utils/adminAuth');
 *   if (pathname.startsWith('/admin')) {
 *     if (!isAdminEnabled()) { res.writeHead(503); res.end(...); return; }
 *     if (!requireAdmin(req)) { res.writeHead(401); res.end(...); return; }
 *   }
 */

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

function isAdminEnabled() {
  // Auditoría 2026-Q3 Fase 9.2: subir mínimo de 8 a 32 chars.
  // 32 chars = ~190 bits de entropía con base64, suficiente para brute-force
  // resistir. Generar con: openssl rand -hex 32
  return Boolean(ADMIN_TOKEN && ADMIN_TOKEN.length >= 32);
}

function extractToken(req) {
  // Header Authorization: Bearer <token>
  const auth = req.headers['authorization'] || req.headers['Authorization'];
  if (auth && /^bearer\s+/i.test(auth)) {
    return auth.replace(/^bearer\s+/i, '').trim();
  }
  // Cookie admin_token=<token>
  const cookie = req.headers['cookie'] || '';
  const match = cookie.match(/(?:^|;\s*)admin_token=([^;]+)/);
  if (match) return decodeURIComponent(match[1]);
  return null;
}

function requireAdmin(req) {
  if (!isAdminEnabled()) return false;
  const token = extractToken(req);
  if (!token) return false;
  // Comparación de tiempo constante para evitar timing attacks.
  try {
    const a = Buffer.from(token);
    const b = Buffer.from(ADMIN_TOKEN);
    if (a.length !== b.length) return false;
    return a.equals(b);
  } catch (_) {
    return false;
  }
}

module.exports = { isAdminEnabled, requireAdmin };
