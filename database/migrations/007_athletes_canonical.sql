-- 007_athletes_canonical.sql
-- Re-key athletes table to use canonical upstream IDs (data->>'athleteId')
-- instead of roster/member record IDs (data->>'id'), which were being stored
-- by syncAthletes() before the migration to Supabase.
--
-- Adds:
--   - canonical_id column (extracted from data) for indexed lookups by /player/:id
--   - trigram index on lower(name) for fast ILIKE search
--   - unique index on canonical_id (nullable for legacy rows that lack athleteId)
--   - BIGINT id (defensive; canonical IDs fit in INT today but upstream grew past 2^31)
--
-- Safe to re-run (idempotent).

BEGIN;

-- 1. Backup safety net before destructive re-key.
CREATE TABLE IF NOT EXISTS athletes_pre_canonical_backup AS
  SELECT * FROM athletes;

-- 2. Widen the PK column type. No FK references exist (verified 2026-07-22).
ALTER TABLE athletes
  ALTER COLUMN id TYPE BIGINT USING id::BIGINT;

-- 3. Materialized canonical_id extracted from data JSONB.
ALTER TABLE athletes
  ADD COLUMN IF NOT EXISTS canonical_id BIGINT
  GENERATED ALWAYS AS (
    NULLIF(data->>'athleteId', '')::BIGINT
  ) STORED;

-- 4. Index on canonical_id for /player/:id and search-by-canonical lookups.
CREATE UNIQUE INDEX IF NOT EXISTS idx_athletes_canonical_id
  ON athletes (canonical_id)
  WHERE canonical_id IS NOT NULL;

-- 5. Trigram index for fast name search. Requires pg_trgm (Supabase has it enabled).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_athletes_name_trgm
  ON athletes USING GIN (lower(name) gin_trgm_ops);

-- 6. Helper index for cache freshness checks during syncAthletes.
CREATE INDEX IF NOT EXISTS idx_athletes_updated_at
  ON athletes (updated_at DESC);

COMMIT;