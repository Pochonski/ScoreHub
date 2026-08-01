-- 022_add_more_competitions.sql
-- Añade 3 competiciones activas para expandir cobertura del dashboard:
--   6316 Eurocopa                          (competición UEFA naciones)
--   595  Copa América                      (selección sudamerica CONMEBOL)
--   7954 CONCACAF Copa Centroamericana     (clubes centroamerica)
-- Display_order 5-7 (debajo de Mundial 5930 que está en 10).
-- NO incluye CONCACAF Copa de Campeones (171) — excluida por decisión de producto.
-- Validadas vía endoints 365scores reales con timezoneId=77, langId=1.
-- Cada comp: has_history=True → enable syncCompetitionHistory.

INSERT INTO active_competitions
  (id, display_name, short_name, country_id, country_name,
   season_num, season_label, start_date, end_date,
   is_active, is_featured, display_order,
   has_brackets, has_groups, has_history, config)
VALUES
  (6316, 'Eurocopa',                     'Eurocopa',                19, 'Europa',     17, '2024 Alemania', '2024-06-14', '2024-07-14',  true, false,  5,  true,  true,  true, '{}'),
  (595,  'Copa América',                 'Copa América',            17, 'Sudamerica',  52, '2024',          '2024-06-20', '2024-07-14',  true, false,  6,  true,  true,  true, '{}'),
  (7954, 'CONCACAF Copa Centroamericana', 'Concacaf Centroamericana', 47, 'CONCACAF',    4, '2024',          '2024-08-26', '2024-09-10',  true, false,  7,  false, true,  true, '{}')
ON CONFLICT (id) DO NOTHING;
