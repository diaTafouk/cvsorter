/**
 * Pays de recrutement (table pays) — gérés depuis la page Configuration.
 */
const db = require('../config/db');
const { PAYS_AES, NATIONALITES } = require('../data/referentiel');

const DEFAULTS = PAYS_AES.map((nom, i) => ({ nom, actif: true, nationalites: NATIONALITES[nom] || [], ordre: i + 1 }));

const normWord = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

async function listPays() {
  try {
    const res = await db.query('SELECT nom, actif, nationalites, ordre FROM pays ORDER BY ordre, nom');
    return res.rows;
  } catch (_) {
    return DEFAULTS; // table absente (migration 003 non jouée)
  }
}

/** { pays: [adjectifs] } pour la détection de nationalité dans le CV */
async function nationalitesMap() {
  const list = await listPays();
  return Object.fromEntries(list.map((p) => [p.nom, (p.nationalites || []).map(normWord).filter(Boolean)]));
}

async function upsertPays({ nom, actif = true, nationalites = [], ordre }) {
  const clean = String(nom || '').trim();
  if (!clean) {
    const e = new Error('Le nom du pays est obligatoire.');
    e.status = 400;
    throw e;
  }
  const res = await db.query(
    `INSERT INTO pays (nom, actif, nationalites, ordre, updated_at)
     VALUES ($1, $2, $3, COALESCE($4, (SELECT COALESCE(MAX(ordre), 0) + 1 FROM pays)), NOW())
     ON CONFLICT (nom) DO UPDATE SET actif = EXCLUDED.actif, nationalites = EXCLUDED.nationalites,
       ordre = COALESCE($4, pays.ordre), updated_at = NOW()
     RETURNING nom, actif, nationalites, ordre`,
    [clean, !!actif, JSON.stringify((nationalites || []).map((n) => String(n).trim()).filter(Boolean)), ordre ?? null]
  );
  return res.rows[0];
}

async function deletePays(nom) {
  await db.query('DELETE FROM pays WHERE nom = $1', [nom]);
}

module.exports = { listPays, nationalitesMap, upsertPays, deletePays };
