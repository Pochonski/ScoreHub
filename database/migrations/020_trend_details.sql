-- 020_trend_details.sql
-- Tabla para cachear el detalle de trends (consulta por trendId).
-- El endpoint 365scores /web/trends/details/{trendId} devuelve trend + games.
-- Antes se llamaba upstream en cada request al dashboard → 365_ONLY.
-- Ahora: syncTrendDetails() puebla esta tabla cada 30min desde los
-- trend_ids conocidos (vía `trends` table).

CREATE TABLE IF NOT EXISTS trend_details (
  trend_id    INT PRIMARY KEY,
  data        JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trend_details_updated_at
  ON trend_details (updated_at DESC);