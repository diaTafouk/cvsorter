/**
 * Applique les migrations SQL puis charge le référentiel des postes.
 *
 *   npm run db:migrate          → crée/complète les tables, ajoute les postes manquants
 *                                 (les postes déjà personnalisés ne sont PAS écrasés)
 *   npm run db:seed:force       → réécrit aussi les postes existants non verrouillés
 *                                 avec la fiche officielle du référentiel
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { POSTES, SOUS_COMMISSIONS } = require('../src/data/referentiel');

const force = process.argv.includes('--force');

// Correctifs de critères à propager aux bases existantes
const PATCHES = [
  {
    id: '2026-10-29-journalistes-langues',
    label: 'journalistes en langue nationale : pratique journalistique exigée',
    codes: ['journaliste-fulfulde', 'journaliste-bamanankan', 'journaliste-bilingue-moore', 'journaliste-bilingue-haoussa'],
    fields: ['competences_techniques']
  },
  {
    id: '2026-10-29-assistante-direction',
    label: 'assistante de direction : domaines d’expérience précisés',
    codes: ['assistante-direction'],
    fields: ['experience_domaines']
  },
  {
    id: '2026-11-03-termes-precis-informaticien-monteur',
    label: 'informaticien et monteurs : mots-clés précisés (faux amis écartés)',
    codes: ['informaticien', 'monteur'],
    fields: ['experience_domaines', 'competences_techniques']
  }
];
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    const dir = path.join(__dirname, '..', 'migrations');
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
      process.stdout.write(`→ Migration ${file} ... `);
      await client.query(fs.readFileSync(path.join(dir, file), 'utf8'));
      console.log('OK');
    }

    await client.query('BEGIN');
    // Sous-commissions par défaut : créées UNE seule fois. Ensuite elles se gèrent depuis l'interface
    // (ajout, modification, suppression) et la migration ne les recrée ni ne les écrase plus.
    await client.query(`CREATE TABLE IF NOT EXISTS referentiel_patches (id VARCHAR(100) PRIMARY KEY, applied_at TIMESTAMP DEFAULT NOW())`);
    const scSeeded = await client.query("SELECT 1 FROM referentiel_patches WHERE id = 'seed-sous-commissions'");
    if (!scSeeded.rows.length) {
      for (const [i, sc] of SOUS_COMMISSIONS.entries()) {
        await client.query(
          `INSERT INTO sous_commissions (code, libelle, perimetre, ponderations, ordre)
           VALUES ($1,$2,$3,$4,$5) ON CONFLICT (code) DO NOTHING`,
          [sc.code, sc.libelle, sc.perimetre, JSON.stringify(sc.ponderations), i + 1]
        );
      }
      await client.query("INSERT INTO referentiel_patches (id) VALUES ('seed-sous-commissions')");
      console.log(`→ ${SOUS_COMMISSIONS.length} sous-commissions par défaut créées`);
    } else {
      console.log('→ Sous-commissions : gérées depuis l\'interface (non modifiées)');
    }

    // Type réel de la colonne historique required_skills (TEXT, TEXT[] ou JSONB)
    const typeRes = await client.query(
      "SELECT data_type FROM information_schema.columns WHERE table_name = 'job_criteria' AND column_name = 'required_skills'"
    );
    const skillsType = typeRes.rows[0]?.data_type || 'text';
    const legacySkills = (labels) =>
      skillsType === 'ARRAY' ? labels : skillsType === 'jsonb' || skillsType === 'json' ? JSON.stringify(labels) : labels.join(', ');

    let created = 0; let updated = 0; let skipped = 0;
    for (const p of POSTES) {
      const existing = await client.query('SELECT code, verrouille FROM job_criteria WHERE code = $1 OR job_title = $2', [p.code, p.job_title]);
      const row = existing.rows[0];
      const payload = [
        p.code, p.job_title, p.sous_commission, p.lieu, p.nombre_postes, p.categorie,
        JSON.stringify(p.nationalites_eligibles), p.mission, p.min_education_rank, p.min_education_level,
        JSON.stringify(p.diplome_domaines), p.min_experience_years, p.max_experience_years,
        JSON.stringify(p.experience_domaines), JSON.stringify(p.competences_techniques),
        JSON.stringify(p.competences_comportementales), JSON.stringify(p.langues_requises),
        p.source, p.a_confirmer, legacySkills(p.competences_techniques.map((t) => t.label))
      ];
      const colList = `code, job_title, sous_commission, lieu, nombre_postes, categorie, nationalites_eligibles, mission,
        min_education_rank, min_education_level, diplome_domaines, min_experience_years, max_experience_years,
        experience_domaines, competences_techniques, competences_comportementales, langues_requises, source, a_confirmer, required_skills`;

      if (!row) {
        await client.query(
          `INSERT INTO job_criteria (${colList}, version, actif, verrouille, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20, 1, TRUE, FALSE, NOW())`,
          payload
        );
        await client.query(
          'INSERT INTO criteria_history (job_code, job_title, version, action, snapshot) VALUES ($1,$2,1,$3,$4)',
          [p.code, p.job_title, 'creation', JSON.stringify(p)]
        );
        created++;
      } else if ((force && !row.verrouille) || !row.code) {
        const sets = colList.split(',').map((c, i) => `${c.trim()} = $${i + 1}`).join(', ');
        await client.query(
          `UPDATE job_criteria SET ${sets}, version = COALESCE(version,1) + 1, updated_at = NOW()
           WHERE code = $1 OR job_title = $2`,
          payload
        );
        updated++;
      } else skipped++;
    }
    // Correctifs ciblés du référentiel (appliqués une seule fois, jamais sur un poste verrouillé)
    await client.query(`CREATE TABLE IF NOT EXISTS referentiel_patches (id VARCHAR(100) PRIMARY KEY, applied_at TIMESTAMP DEFAULT NOW())`);
    for (const patch of PATCHES) {
      const done = await client.query('SELECT 1 FROM referentiel_patches WHERE id = $1', [patch.id]);
      if (done.rows.length) continue;
      let n = 0;
      for (const code of patch.codes) {
        const ref = POSTES.find((p) => p.code === code);
        if (!ref) continue;
        const sets = patch.fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
        const vals = patch.fields.map((f) => JSON.stringify(ref[f]));
        const r = await client.query(
          `UPDATE job_criteria SET ${sets}, version = COALESCE(version,1) + 1, updated_at = NOW()
           WHERE code = $1 AND COALESCE(verrouille, FALSE) = FALSE`,
          [code, ...vals]
        );
        n += r.rowCount || 0;
      }
      await client.query('INSERT INTO referentiel_patches (id) VALUES ($1)', [patch.id]);
      console.log(`→ Correctif « ${patch.label} » : ${n} poste(s) mis à jour`);
    }

    await client.query('COMMIT');
    console.log(`→ Postes : ${created} créés, ${updated} mis à jour, ${skipped} conservés (déjà personnalisés${force ? ' ou verrouillés' : ''})`);
    console.log('✔ Base de données prête pour la présélection.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('✖ Échec de la migration :', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
