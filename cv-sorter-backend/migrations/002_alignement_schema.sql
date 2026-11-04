-- =====================================================================
-- MIGRATION 002 — Alignement sur le schéma réel (ids candidats en UUID texte)
-- Idempotente.
-- =====================================================================

-- archived_candidates.original_id doit accepter les UUID texte de candidates.id
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = current_schema() AND table_name = 'archived_candidates'
               AND column_name = 'original_id' AND data_type <> 'text') THEN
    ALTER TABLE archived_candidates ALTER COLUMN original_id TYPE TEXT USING original_id::text;
  END IF;
END $$;

ALTER TABLE archived_candidates ADD COLUMN IF NOT EXISTS extracted_text TEXT;

-- Colonne historique job_criteria.min_education : recopie du libellé du niveau requis
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = current_schema() AND table_name = 'job_criteria' AND column_name = 'min_education') THEN
    UPDATE job_criteria SET min_education = min_education_level
    WHERE min_education IS NULL AND min_education_level IS NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS candidates_created_idx ON candidates ("createdAt" DESC);
