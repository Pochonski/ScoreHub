-- 027_monitoring.sql
-- Tablas para monitoreo y alertas (Fase monitoreo-2026).
--
-- sync_health: un heartbeat por job del scheduler (escrito por
--   utils/jobGuard.wrap al terminar cada corrida). El monitor y el
--   endpoint /health leen de aquí para detectar jobs caídos/stale.
-- monitor_state: KV genérico para cooldowns de alertas (último envío
--   por clave) y evitar spam de Telegram mientras algo sigue fallando.

CREATE TABLE IF NOT EXISTS sync_health (
  job_name         TEXT PRIMARY KEY,
  last_run_at      TIMESTAMPTZ,
  last_ok          BOOLEAN NOT NULL DEFAULT true,
  last_error       TEXT,
  last_duration_ms INT,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS monitor_state (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
