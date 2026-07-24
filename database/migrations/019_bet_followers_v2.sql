-- 019_bet_followers_v2.sql
-- Normaliza la tabla `bet_followers` para cerrar los problemas estructurales
-- identificados por DeepSeek (Phase 3 análisis):
--
--   - `ticket_id TEXT` sin FK a `apuestas(id)` (que es INT)
--   - `chat_ids TEXT[]` (lista por ticket) que favorece race conditions
--     y rompe el modelado por chat/ticket/modo
--   - PK compuesta (ticket_id, mode) que en `getFollowByTicketId` sin modo
--     resulta ambiguo
--
-- La nueva `bet_followers_v2` es 1 fila por (apuesta, chat, modo) con FK
-- correcta. Las queries que usan getFollowByTicketId ahora pueden
-- respetar el modo explícitamente sin ambigüedad.
--
-- Pre-validación (Phase 3 + Step 1.1):
--   - bet_followers: 0 filas
--   - apuestas: 0 filas
--   No hay rows que migrar.
--
-- El prefijo `_v2` deja claro que la nueva tabla coexistirá con la vieja
-- por seguridad. Migration 020 futura podrá hacer el DROP de la vieja
-- después de validar el flujo con `_v2`.

CREATE TABLE bet_followers_v2 (
  apuesta_id         INT  NOT NULL REFERENCES apuestas(id) ON DELETE CASCADE,
  chat_id            TEXT NOT NULL,
  mode               TEXT NOT NULL DEFAULT 'all_events'
                                  CHECK (mode IN ('all_events', 'outcome_only')),
  last_notified_status JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (apuesta_id, chat_id, mode)
);

-- Lookups por chat: "qué tickets sigue este usuario".
CREATE INDEX IF NOT EXISTS idx_bf_v2_chat
  ON bet_followers_v2 (chat_id);

-- Lookups por ticket: "quién sigue este ticket".
CREATE INDEX IF NOT EXISTS idx_bf_v2_apuesta
  ON bet_followers_v2 (apuesta_id);

-- comentario breve
COMMENT ON TABLE bet_followers_v2 IS
  'One row per (apuesta, chat, mode) — replaces bet_followers normalized form. Pre-FK lineup.';
