-- =====================================================================
-- MIGRATION 001 — Paramètres de présélection
-- Idempotente : peut être rejouée sans risque (IF NOT EXISTS partout).
-- Aucune donnée existante n'est supprimée.
-- =====================================================================

-- ---------- 1. Sous-commissions (§10 des TdR) ----------
CREATE TABLE IF NOT EXISTS sous_commissions (
  code          VARCHAR(2) PRIMARY KEY,           -- A, B, C, D
  libelle       VARCHAR(150) NOT NULL,
  perimetre     TEXT,
  ponderations  JSONB NOT NULL DEFAULT '{}'::jsonb, -- pondérations de présélection (somme = 100)
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------- 2. Critères par poste (table existante étendue) ----------
CREATE TABLE IF NOT EXISTS job_criteria (
  id                    SERIAL PRIMARY KEY,
  job_title             VARCHAR(255) NOT NULL UNIQUE,
  min_experience_years  INTEGER DEFAULT 0,
  min_education_level   VARCHAR(150),
  required_skills       TEXT
);

-- Les anciennes colonnes obligatoires (min_education, required_skills…) ne doivent plus
-- bloquer les insertions : seules id et job_title restent obligatoires.
DO $$
DECLARE col RECORD;
BEGIN
  FOR col IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'job_criteria'
      AND is_nullable = 'NO' AND column_name NOT IN ('id', 'job_title')
      AND column_name NOT IN (
        SELECT kcu.column_name FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
        WHERE tc.table_name = 'job_criteria' AND tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = current_schema())
  LOOP
    EXECUTE format('ALTER TABLE job_criteria ALTER COLUMN %I DROP NOT NULL', col.column_name);
  END LOOP;
END $$;

-- Colonnes historiques : ajoutées si la table existante ne les a pas
ALTER TABLE job_criteria ADD COLUMN IF NOT EXISTS min_experience_years         INTEGER DEFAULT 0;
ALTER TABLE job_criteria ADD COLUMN IF NOT EXISTS min_education_level          VARCHAR(150);
ALTER TABLE job_criteria ADD COLUMN IF NOT EXISTS required_skills              TEXT;

ALTER TABLE job_criteria ADD COLUMN IF NOT EXISTS code                         VARCHAR(80);
ALTER TABLE job_criteria ADD COLUMN IF NOT EXISTS sous_commission              VARCHAR(2);
ALTER TABLE job_criteria ADD COLUMN IF NOT EXISTS lieu                         VARCHAR(150);
ALTER TABLE job_criteria ADD COLUMN IF NOT EXISTS nombre_postes                INTEGER DEFAULT 1;
ALTER TABLE job_criteria ADD COLUMN IF NOT EXISTS categorie                    VARCHAR(30);   -- QUOTA_AES | RESIDENT_MALI
ALTER TABLE job_criteria ADD COLUMN IF NOT EXISTS nationalites_eligibles       JSONB DEFAULT '["Mali","Burkina Faso","Niger"]'::jsonb;
ALTER TABLE job_criteria ADD COLUMN IF NOT EXISTS mission                      TEXT;
ALTER TABLE job_criteria ADD COLUMN IF NOT EXISTS min_education_rank           NUMERIC(3,1) DEFAULT 3;
ALTER TABLE job_criteria ADD COLUMN IF NOT EXISTS diplome_domaines             JSONB DEFAULT '[]'::jsonb;
ALTER TABLE job_criteria ADD COLUMN IF NOT EXISTS max_experience_years         INTEGER;
ALTER TABLE job_criteria ADD COLUMN IF NOT EXISTS experience_domaines          JSONB DEFAULT '[]'::jsonb;
ALTER TABLE job_criteria ADD COLUMN IF NOT EXISTS competences_techniques       JSONB DEFAULT '[]'::jsonb;
ALTER TABLE job_criteria ADD COLUMN IF NOT EXISTS competences_comportementales JSONB DEFAULT '[]'::jsonb;
ALTER TABLE job_criteria ADD COLUMN IF NOT EXISTS langues_requises             JSONB DEFAULT '["francais"]'::jsonb;
ALTER TABLE job_criteria ADD COLUMN IF NOT EXISTS regles_elimination           JSONB;          -- NULL = règles par défaut
ALTER TABLE job_criteria ADD COLUMN IF NOT EXISTS seuils                       JSONB;          -- NULL = §14 (70 / 60)
ALTER TABLE job_criteria ADD COLUMN IF NOT EXISTS ponderations                 JSONB;          -- NULL = celles de la sous-commission
ALTER TABLE job_criteria ADD COLUMN IF NOT EXISTS max_convoques                INTEGER;        -- §12 nombre max à convoquer
ALTER TABLE job_criteria ADD COLUMN IF NOT EXISTS source                       VARCHAR(30);    -- fiche | fiche_partielle | avis | manuel
ALTER TABLE job_criteria ADD COLUMN IF NOT EXISTS a_confirmer                  BOOLEAN DEFAULT FALSE;
ALTER TABLE job_criteria ADD COLUMN IF NOT EXISTS verrouille                   BOOLEAN DEFAULT FALSE; -- §13 : aucun critère modifié en cours de processus
ALTER TABLE job_criteria ADD COLUMN IF NOT EXISTS actif                        BOOLEAN DEFAULT TRUE;
ALTER TABLE job_criteria ADD COLUMN IF NOT EXISTS version                      INTEGER DEFAULT 1;
ALTER TABLE job_criteria ADD COLUMN IF NOT EXISTS updated_at                   TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS job_criteria_code_uidx ON job_criteria (code);
CREATE INDEX IF NOT EXISTS job_criteria_sc_idx ON job_criteria (sous_commission);

-- ---------- 3. Historique des versions de critères (traçabilité §9.3 / §13) ----------
CREATE TABLE IF NOT EXISTS criteria_history (
  id          SERIAL PRIMARY KEY,
  job_code    VARCHAR(80),
  job_title   VARCHAR(255),
  version     INTEGER,
  action      VARCHAR(30),          -- creation | modification | verrouillage | deverrouillage | restauration
  snapshot    JSONB NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS criteria_history_code_idx ON criteria_history (job_code, version);

-- ---------- 4. Candidats : colonnes de présélection ----------
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS country          VARCHAR(100);
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS job_title        VARCHAR(255);
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS evaluation       JSONB;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS job_code         VARCHAR(80);
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS sous_commission  VARCHAR(2);
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS score            NUMERIC(5,2);
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS decision         VARCHAR(40);
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS a_verifier       BOOLEAN DEFAULT FALSE;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS criteria_version INTEGER;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS evaluated_at     TIMESTAMP;

CREATE INDEX IF NOT EXISTS candidates_job_score_idx ON candidates (job_title, score DESC);
CREATE INDEX IF NOT EXISTS candidates_decision_idx ON candidates (decision);

-- ---------- 5. Archives ----------
CREATE TABLE IF NOT EXISTS archived_candidates (
  id          SERIAL PRIMARY KEY,
  original_id INT,
  name        VARCHAR(255),
  job_title   VARCHAR(255),
  country     VARCHAR(100),
  email       VARCHAR(255),
  phone       VARCHAR(100),
  evaluation  JSONB,
  deleted_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE archived_candidates ADD COLUMN IF NOT EXISTS score    NUMERIC(5,2);
ALTER TABLE archived_candidates ADD COLUMN IF NOT EXISTS decision VARCHAR(40);
