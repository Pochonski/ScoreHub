/**
 * tests/unit/adminAuth.test.js — Auditoría 2026-Q3 Fase 8.2
 *
 * Tests del módulo utils/adminAuth.js.
 */

process.env.NODE_ENV = 'test';

describe('utils/adminAuth — token auth + flow gates', () => {
  let originalToken;

  beforeEach(() => {
    jest.resetModules();
    originalToken = process.env.ADMIN_TOKEN;
  });

  afterEach(() => {
    if (originalToken === undefined) delete process.env.ADMIN_TOKEN;
    else process.env.ADMIN_TOKEN = originalToken;
  });

  function loadAdminAuth() {
    return require('../../utils/adminAuth');
  }

  test('isAdminEnabled retorna false si ADMIN_TOKEN no está seteado', () => {
    delete process.env.ADMIN_TOKEN;
    const auth = loadAdminAuth();
    expect(auth.isAdminEnabled()).toBe(false);
  });

  test('isAdminEnabled retorna false si ADMIN_TOKEN mide < 32 chars', () => {
  process.env.ADMIN_TOKEN = 'short';
  const auth = loadAdminAuth();
  expect(auth.isAdminEnabled()).toBe(false);
});

test('isAdminEnabled retorna true si ADMIN_TOKEN mide >= 32 chars', () => {
  process.env.ADMIN_TOKEN = 'a'.repeat(32);
  const auth = loadAdminAuth();
  expect(auth.isAdminEnabled()).toBe(true);
});

test('requireAdmin retorna false si no hay token en ADMIN_TOKEN', () => {
  process.env.ADMIN_TOKEN = 'a'.repeat(32);
  const auth = loadAdminAuth();
  expect(auth.requireAdmin({ headers: {} })).toBe(false);
});

test('requireAdmin retorna true con Bearer header correcto', () => {
  const token = 'a'.repeat(32);
  process.env.ADMIN_TOKEN = token;
  const auth = loadAdminAuth();
  const req = { headers: { authorization: `Bearer ${token}` } };
  expect(auth.requireAdmin(req)).toBe(true);
});

test('requireAdmin retorna false con Bearer header incorrecto', () => {
  process.env.ADMIN_TOKEN = 'a'.repeat(32);
  const auth = loadAdminAuth();
  const req = { headers: { authorization: 'Bearer wrongtoken' } };
  expect(auth.requireAdmin(req)).toBe(false);
});

test('requireAdmin acepta admin_token cookie', () => {
  const token = 'a'.repeat(32);
  process.env.ADMIN_TOKEN = token;
  const auth = loadAdminAuth();
  const req = { headers: { cookie: `admin_token=${token}; other=value` } };
  expect(auth.requireAdmin(req)).toBe(true);
});

test('requireAdmin acepta admin_token cookie URL-encoded', () => {
  const token = 'a'.repeat(32);
  process.env.ADMIN_TOKEN = token;
  const auth = loadAdminAuth();
  const req = { headers: { cookie: `admin_token=${token}` } };
  expect(auth.requireAdmin(req)).toBe(true);
});

test('requireAdmin retorna false con Authorization mal formado', () => {
  process.env.ADMIN_TOKEN = 'a'.repeat(32);
  const auth = loadAdminAuth();
  const req = { headers: { authorization: 'Basic sometoken' } };
  expect(auth.requireAdmin(req)).toBe(false);
});

test('requireAdmin retorna false si Bearer tiene longitud distinta', () => {
  process.env.ADMIN_TOKEN = 'a'.repeat(32);
  const auth = loadAdminAuth();
  const req = { headers: { authorization: 'Bearer short' } };
  expect(auth.requireAdmin(req)).toBe(false);
});
});