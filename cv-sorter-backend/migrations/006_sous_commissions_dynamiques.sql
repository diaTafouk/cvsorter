-- =====================================================================
-- MIGRATION 006 — Sous-commissions ajoutées / supprimées depuis l'interface
-- Les codes ne sont plus limités à 2 caractères.
-- =====================================================================
ALTER TABLE sous_commissions ALTER COLUMN code TYPE VARCHAR(20);
ALTER TABLE job_criteria ALTER COLUMN sous_commission TYPE VARCHAR(20);
ALTER TABLE candidates ALTER COLUMN sous_commission TYPE VARCHAR(20);
ALTER TABLE sous_commissions ADD COLUMN IF NOT EXISTS ordre INTEGER DEFAULT 0;
UPDATE sous_commissions SET ordre = ASCII(code) WHERE ordre = 0 OR ordre IS NULL;
