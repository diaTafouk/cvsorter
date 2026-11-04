-- =====================================================================
-- MIGRATION 003 — Pays de recrutement gérés depuis l'interface
-- =====================================================================
CREATE TABLE IF NOT EXISTS pays (
  nom          VARCHAR(100) PRIMARY KEY,
  actif        BOOLEAN NOT NULL DEFAULT TRUE,
  nationalites JSONB NOT NULL DEFAULT '[]'::jsonb,  -- adjectifs recherchés dans le CV (ex : malien, malienne)
  ordre        INTEGER NOT NULL DEFAULT 0,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO pays (nom, actif, nationalites, ordre) VALUES
  ('Mali',         TRUE, '["malien","malienne"]'::jsonb, 1),
  ('Burkina Faso', TRUE, '["burkinabe","burkinabee","burkinais"]'::jsonb, 2),
  ('Niger',        TRUE, '["nigerien","nigerienne"]'::jsonb, 3)
ON CONFLICT (nom) DO NOTHING;

-- Libellé de compétence neutralisé (référence régionale)
UPDATE job_criteria
SET competences_techniques = replace(
      replace(competences_techniques::text, 'économique et sahélienne', 'économique et régionale'),
      ', "aes"', '')::jsonb
WHERE competences_techniques::text LIKE '%sahélienne%' OR competences_techniques::text LIKE '%"aes"%';
