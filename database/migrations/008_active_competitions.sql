-- 008_active_competitions.sql
-- Lista curada de competiciones que el sitio expone. Cualquier endpoint
-- que reciba `?competitionId=` valida contra esta tabla antes de hacer
-- queries costosas. Mantener el Mundial 2026 como `is_featured=true`,
-- `display_order=10` para que siga siendo la home por defecto.

CREATE TABLE IF NOT EXISTS active_competitions (
  id              INT PRIMARY KEY,
  display_name    TEXT NOT NULL,
  short_name      TEXT,
  country_id      INT,
  country_name    TEXT,
  season_num      INT NOT NULL,
  season_label    TEXT,
  start_date      DATE,
  end_date        DATE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_featured     BOOLEAN NOT NULL DEFAULT FALSE,
  display_order   INT NOT NULL DEFAULT 100,
  has_brackets    BOOLEAN NOT NULL DEFAULT FALSE,
  has_groups      BOOLEAN NOT NULL DEFAULT FALSE,
  has_history     BOOLEAN NOT NULL DEFAULT TRUE,
  config          JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_active_competitions_active_order
  ON active_competitions (is_active, display_order);

CREATE INDEX IF NOT EXISTS idx_active_competitions_featured
  ON active_competitions (is_featured, display_order)
  WHERE is_active = TRUE;

-- Seed inicial: Mundial 2026 + Liga Promerica CR (2026/2027).
-- ON CONFLICT para que re-ejecuciones solo actualicen season_num.
INSERT INTO active_competitions
  (id, display_name, short_name, country_id, country_name,
   season_num, season_label, start_date, end_date,
   is_active, is_featured, display_order,
   has_brackets, has_groups, has_history)
VALUES
  (5930, 'Copa Mundial de la FIFA 2026', 'Mundial 2026', 54, 'Internacional',
   25, '2026', '2026-06-01', '2026-08-15',
   TRUE, TRUE, 10, TRUE, TRUE, TRUE),
  (5056, 'Liga Promerica', 'Liga Promerica', 153, 'Costa Rica',
   146, '2026/2027', '2026-07-19', '2026-12-20',
   TRUE, TRUE, 20, FALSE, FALSE, TRUE)
ON CONFLICT (id) DO UPDATE SET
  display_name  = EXCLUDED.display_name,
  short_name    = EXCLUDED.short_name,
  country_id    = EXCLUDED.country_id,
  country_name  = EXCLUDED.country_name,
  season_num    = EXCLUDED.season_num,
  season_label  = EXCLUDED.season_label,
  start_date    = EXCLUDED.start_date,
  end_date      = EXCLUDED.end_date,
  is_active     = EXCLUDED.is_active,
  is_featured   = EXCLUDED.is_featured,
  display_order = EXCLUDED.display_order,
  has_brackets  = EXCLUDED.has_brackets,
  has_groups    = EXCLUDED.has_groups,
  has_history   = EXCLUDED.has_history,
  updated_at    = now();
