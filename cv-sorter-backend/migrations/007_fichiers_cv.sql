-- =====================================================================
-- MIGRATION 007 — Conservation du fichier CV original (PDF, DOCX, photo)
-- Le fichier importé est gardé tel quel pour être rouvert depuis la fiche du candidat.
-- candidate_id en texte : compatible avec un identifiant entier ou UUID.
-- =====================================================================
CREATE TABLE IF NOT EXISTS candidate_files (
  candidate_id TEXT PRIMARY KEY,
  file_name    TEXT,
  mime_type    VARCHAR(150),
  size_bytes   INTEGER,
  content      BYTEA NOT NULL,
  created_at   TIMESTAMP DEFAULT NOW()
);
