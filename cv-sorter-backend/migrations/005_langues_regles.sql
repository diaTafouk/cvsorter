-- =====================================================================
-- MIGRATION 005 — Langues gérées depuis l'interface
--                 + conditions de recevabilité / règles d'élimination personnalisées
-- =====================================================================

CREATE TABLE IF NOT EXISTS langues (
  code       VARCHAR(60) PRIMARY KEY,
  label      VARCHAR(120) NOT NULL,
  synonymes  JSONB NOT NULL DEFAULT '[]'::jsonb,   -- termes recherchés dans le CV (ex : bambara, bamanankan)
  ordre      INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO langues (code, label, synonymes, ordre) VALUES
  ('francais',   'Français',             '["francais","french","langue francaise"]', 1),
  ('anglais',    'Anglais',              '["anglais","english"]', 2),
  ('bamanankan', 'Bamanankan (Bambara)', '["bamanankan","bambara","bamana","bamanan"]', 3),
  ('fulfulde',   'Fulfuldé (Peul)',      '["fulfulde","peul","peulh","pulaar","fulani","fula","poular"]', 4),
  ('moore',      'Mooré',                '["moore","mossi","moore-francais"]', 5),
  ('haoussa',    'Haoussa',              '["haoussa","hausa","haussa"]', 6),
  ('arabe',      'Arabe',                '["arabe","arabic"]', 7),
  ('songhai',    'Songhaï / Zarma',      '["songhai","sonrai","songhay","zarma","djerma"]', 8),
  ('tamasheq',   'Tamasheq',             '["tamasheq","tamachek","tamashek","tamacheq"]', 9)
ON CONFLICT (code) DO NOTHING;

-- Règles ajoutées par la Commission.
-- portee : 'tous' (tous les postes) | code de sous-commission ('A'…'D') | 'poste:<code du poste>'
CREATE TABLE IF NOT EXISTS regles_personnalisees (
  id         SERIAL PRIMARY KEY,
  libelle    VARCHAR(255) NOT NULL,
  type       VARCHAR(40)  NOT NULL,    -- mot_cle_requis | mot_cle_interdit | age_maximum | experience_totale_min | experience_liee_min | diplome_min | langue_requise | note_critere_min
  valeurs    JSONB NOT NULL DEFAULT '[]'::jsonb, -- mots-clés, code de langue, critère…
  valeur     NUMERIC,                  -- seuil numérique (âge, années, note, niveau)
  mode       VARCHAR(20) NOT NULL DEFAULT 'eliminer',  -- eliminer | verifier
  portee     VARCHAR(120) NOT NULL DEFAULT 'tous',
  actif      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS regles_personnalisees_portee_idx ON regles_personnalisees (portee);
