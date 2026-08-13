-- ═══════════════════════════════════════════════════════════════
-- 025_drop_bet_followers_v1.sql — Auditoría 2026-Q3 Fase 6.1
--
-- Limpia la tabla legacy bet_followers (introducida en migración 003).
-- Reemplazada por bet_followers_v2 (migración 019) con FK proper a
-- apuestas(id) ON DELETE CASCADE y CHECK en mode.
--
-- Aplicable SOLO si la tabla v1 está vacía.
--
-- Pre-check (ejecutar manualmente antes de aplicar):
--   SELECT COUNT(*) FROM bet_followers;
-- Si retorna > 0, primero migrar datos a bet_followers_v2:
--   INSERT INTO bet_followers_v2 (...)
--     SELECT id, ticket_id, chat_id, mode, created_at FROM bet_followers
--     ON CONFLICT DO NOTHING;
-- y luego aplicar este drop.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

DROP TABLE IF EXISTS bet_followers CASCADE;

COMMIT;