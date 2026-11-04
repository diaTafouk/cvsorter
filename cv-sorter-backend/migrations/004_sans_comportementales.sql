-- =====================================================================
-- MIGRATION 004 — Les compétences comportementales ne sont plus notées
-- (elles relèvent de l'entretien physique, dernière étape du recrutement)
-- =====================================================================
UPDATE sous_commissions SET ponderations = CASE code
    WHEN 'A' THEN '{"diplome":25,"experience":35,"techniques":35,"langues":5}'::jsonb
    WHEN 'B' THEN '{"diplome":20,"experience":30,"techniques":35,"langues":15}'::jsonb
    WHEN 'C' THEN '{"diplome":25,"experience":30,"techniques":40,"langues":5}'::jsonb
    WHEN 'D' THEN '{"diplome":25,"experience":35,"techniques":35,"langues":5}'::jsonb
    ELSE ponderations - 'comportementales' END,
  updated_at = NOW()
WHERE ponderations ? 'comportementales';

-- Pondérations propres à un poste : le poids comportemental est reporté sur les compétences techniques
UPDATE job_criteria
SET ponderations = (ponderations - 'comportementales')
  || jsonb_build_object('techniques', COALESCE((ponderations->>'techniques')::numeric, 0) + COALESCE((ponderations->>'comportementales')::numeric, 0))
WHERE ponderations IS NOT NULL AND ponderations ? 'comportementales';
