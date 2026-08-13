/**
 * tests/unit/db-sql-guards.test.js — Auditoría 2026-Q3 Fase 8.5
 *
 * Fuzzing contra los guards SQL-injection en database/db.js:
 * - assertIdent: valida table/column names con regex estricto
 * - assertSelectList: valida listas de columnas (separadas por coma)
 *
 * Estas son las líneas más críticas de seguridad del archivo y no tenían
 * tests directos antes de esta fase.
 */

process.env.NODE_ENV = 'test';

const { _internal: { assertIdent, assertSelectList } } = require('../../database/db');

describe('database/db.assertIdent — SQL injection guard', () => {
  test('identifiers válidos pasan', () => {
    expect(() => assertIdent('users')).not.toThrow();
    expect(() => assertIdent('user_id')).not.toThrow();
    expect(() => assertIdent('_private')).not.toThrow();
    expect(() => assertIdent('public.users')).not.toThrow();
    expect(() => assertIdent('schema_name.table_name')).not.toThrow();
  });

  test('identifier vacío lanza', () => {
    expect(() => assertIdent('')).toThrow(/Unsafe SQL identifier/);
  });

  test('identifier no-string lanza', () => {
    expect(() => assertIdent(null)).toThrow();
    expect(() => assertIdent(undefined)).toThrow();
    expect(() => assertIdent(123)).toThrow();
    expect(() => assertIdent({})).toThrow();
  });

  test('identifier con SQL injection attempts lanza', () => {
    const attempts = [
      'users; DROP TABLE users;',
      "users' OR 1=1--",
      'users/*comment*/',
      'users--comment',
      'users OR 1=1',
      '123users', // no empieza con letra/underscore
      'users;DROP',
      'users,other',
      'users(other)',
      "users'test'",
    ];
    for (const attempt of attempts) {
      expect(() => assertIdent(attempt)).toThrow(/Unsafe SQL identifier/);
    }
  });

  test('identifier con caracteres unicode/special lanza', () => {
    expect(() => assertIdent('users\u0000')).toThrow();
    expect(() => assertIdent('users;DROP TABLE x;')).toThrow();
    expect(() => assertIdent('users with space')).toThrow();
  });
});

describe('database/db.assertSelectList — SQL select list guard', () => {
  test('"*" pasa (allowlist explícita)', () => {
    expect(assertSelectList('*')).toBe('*');
    expect(assertSelectList(null)).toBe('*');
    expect(assertSelectList(undefined)).toBe('*');
  });

  test('lista válida de columnas pasa', () => {
    expect(() => assertSelectList('id, name, email')).not.toThrow();
    expect(() => assertSelectList('id,name,email')).not.toThrow();
    expect(() => assertSelectList('  id  ,  name  ')).not.toThrow();
  });

  test('columnas con SQL injection lanzan', () => {
    const attempts = [
      'id, name; DROP TABLE users',
      'id, 1=1',
      'id, name--comment',
      'id, name UNION SELECT',
      "id, name' OR '1",
    ];
    for (const attempt of attempts) {
      expect(() => assertSelectList(attempt)).toThrow(/Unsafe SQL/);
    }
  });

  test('select no-string lanza', () => {
    expect(() => assertSelectList(123)).toThrow();
    expect(() => assertSelectList({})).toThrow();
    expect(() => assertSelectList([])).toThrow();
  });
});