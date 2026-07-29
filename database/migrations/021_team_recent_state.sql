-- 021_team_recent_state.sql
-- 3 tablas para cachear estado reciente por equipo:
--   team_recent_form:     últimos N partidos (forma reciente)
--   team_upcoming:        próximos partidos
--   team_recent_matches:  últimos resultados (statusGroup=4)
-- Antes cada request viajaba a 365scores → 365_ONLY.
-- Ahora: dashboard sirve DB_ONLY con hydrate-on-demand (cache-with-hydration)
-- (Fase 8.4 añadirá write-back automático para DB_FIRST endpoints).

CREATE TABLE IF NOT EXISTS team_recent_form (
  competitor_id  INT PRIMARY KEY,
  num_of_games   INT NOT NULL DEFAULT 5,
  data           JSONB NOT NULL,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS team_upcoming (
  competitor_id  INT PRIMARY KEY,
  data           JSONB NOT NULL,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS team_recent_results (
  competitor_id  INT PRIMARY KEY,
  data           JSONB NOT NULL,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_form_updated_at
  ON team_recent_form (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_upcoming_updated_at
  ON team_upcoming (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_recent_results_updated_at
  ON team_recent_results (updated_at DESC);