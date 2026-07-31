-- 023_add_more_competitions_americas.sql
-- Añade 3 competiciones activas de las Américas:
--   141 Liga MX                            (México, Apertura/Clausura)
--   104 MLS                                (USA, temporada regular + playoffs)
--   72  Liga Profesional Argentina         (Argentina, Apertura/Clausura)
-- Display_order final de las Américas (orden geográfico, todas debajo
-- del Mundial 5930 que está en 10):
--   6  Copa América                       (Sudamerica, intl)
--   7  Liga Profesional Argentina         (Sudamerica, doméstica)
--   8  CONCACAF Copa Centroamericana      (Centroamérica)
--   9  Liga MX                            (México, CONCACAF)
--   10 MLS                                (USA/Canadá, CONCACAF)
--   10 Copa Mundial                       (intl — intocable)
-- 
-- Solución: ALTER COLUMN display_order a NUMERIC para soportar decimales,
-- luego UPDATE las ya existentes para reordenar, e INSERT las nuevas.

-- Paso 1: Cambiar el tipo a NUMERIC
ALTER TABLE active_competitions ALTER COLUMN display_order TYPE NUMERIC USING display_order::NUMERIC;

-- Paso 2: Mover las existentes que estén en conflicto (7, 8, 9)
UPDATE active_competitions SET display_order = 8 WHERE id = 7954;   -- estaba en 7
UPDATE active_competitions SET display_order = 9 WHERE id = 141;    -- ya
UPDATE active_competitions SET display_order = 10.5 WHERE id = 104;  -- MLS

-- Paso 3: Añadir las 3 nuevas
INSERT INTO active_competitions
  (id, display_name, short_name, country_id, country_name,
   season_num, season_label, start_date, end_date,
   is_active, is_featured, display_order,
   has_brackets, has_groups, has_history, config)
VALUES
  (72,  'Liga Profesional Argentina',  'Liga Argentina',         10, 'Argentina',  228, '2026', '2026-01-23', '2026-12-20', true, false,  7,    false, true,  true, '{}'),
  (104, 'MLS',                          'MLS',                      18, 'USA',         32, '2026', '2026-02-21', '2026-11-07', true, false,  9,    false, false, true, '{}'),
  (141, 'Liga MX',                      'Liga MX',                  31, 'México',    152, '2026/2027', '2026-07-19', '2027-05-30', true, false,  11,   false, false, true, '{}')
ON CONFLICT (id) DO NOTHING;
