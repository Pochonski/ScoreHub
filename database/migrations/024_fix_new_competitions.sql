-- 024_fix_new_competitions.sql
-- Arregla la integración de las nuevas ligas (revisión post 022/023).
--
-- 1) has_groups=true en ligas de tabla única que SÍ tienen standings pero no
--    mostraban el tab "Posiciones" (el tab del dashboard se gatea con
--    has_groups). Afecta:
--      104  MLS               (2 conferencias — genuinamente con grupos)
--      141  Liga MX           (tabla única)
--      5056 Liga Promerica    (tabla única — regresión: antes mostraba Posiciones)
--    Consistente con las ligas europeas y Liga Argentina, que ya tienen
--    has_groups=true para exponer su tabla.
--
-- 2) Reordena Liga MX. En 023 los UPDATE del "Paso 2" para 141/104 fueron
--    no-ops (las filas aún no existían; se insertaban en el Paso 3), así que
--    Liga MX quedó en display_order 11 — DESPUÉS del Mundial (10) y separada
--    de las otras ligas de la región. La movemos a 8.5: CONCACAF (8) →
--    Liga MX (8.5) → MLS (9) → Mundial (10).

UPDATE active_competitions SET has_groups = true WHERE id IN (104, 141, 5056);

UPDATE active_competitions SET display_order = 8.5 WHERE id = 141;
