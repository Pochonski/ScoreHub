-- 026_add_nations_league.sql
-- Añade la UEFA Nations League (Liga de las Naciones) como competición activa.
--
-- Datos verificados del HAR de 365scores (2026-09-27, página
-- /football/league/uefa-nations-league-7016):
--   id=7016, nombre "Liga de las Naciones - UEFA", countryId=19 (Europa),
--   currentSeasonNum=5 ("2026/2027"), imageVersion=2,
--   hasBrackets=false, hasStats=true, 54 equipos en 14 grupos,
--   seasonsFilter 1..5 (2018/2019 → 2026/2027).
--
-- display_order 5.5: entre Eurocopa (5) y Copa América (6), bloque UEFA/intl.
-- has_groups=true: tiene 14 grupos y el tab "Posiciones" del dashboard se
--   gatea con has_groups (ver 024).
-- has_history=true: /web/competitions/history devuelve ediciones previas.
-- is_featured=false por defecto (no ocupa tab de la home hasta pedirlo).

INSERT INTO active_competitions
  (id, display_name, short_name, country_id, country_name,
   season_num, season_label, start_date, end_date,
   is_active, is_featured, display_order,
   has_brackets, has_groups, has_history, config)
VALUES
  (7016, 'Liga de las Naciones - UEFA', 'Nations League', 19, 'Europa',
   5, '2026/2027', '2026-09-01', '2027-06-30',
   true, false, 5.5,
   false, true, true, '{}')
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
  display_order = EXCLUDED.display_order,
  has_brackets  = EXCLUDED.has_brackets,
  has_groups    = EXCLUDED.has_groups,
  has_history   = EXCLUDED.has_history;
