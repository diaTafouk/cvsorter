/**
 * Accès PostgreSQL aux critères de présélection (job_criteria, sous_commissions, criteria_history)
 */
const db = require('../config/db');
const { POSTES, SOUS_COMMISSIONS, labelNiveau } = require('../data/referentiel');

// Colonnes JSONB éditables
const JSON_COLS = [
  'nationalites_eligibles', 'diplome_domaines', 'experience_domaines', 'competences_techniques',
  'competences_comportementales', 'langues_requises', 'regles_elimination', 'seuils', 'ponderations'
];
const SCALAR_COLS = [
  'job_title', 'sous_commission', 'lieu', 'nombre_postes', 'categorie', 'mission', 'min_education_rank',
  'min_education_level', 'min_experience_years', 'max_experience_years', 'max_convoques', 'source',
  'a_confirmer', 'actif'
];

const slugify = (s) =>
  String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

/** Normalise une ligne DB pour le moteur et le frontend */
function mapRow(r) {
  if (!r) return null;
  const legacySkills = typeof r.required_skills === 'string'
    ? r.required_skills.split(',').map((s) => s.trim()).filter(Boolean)
    : Array.isArray(r.required_skills) ? r.required_skills : [];
  const techniques = Array.isArray(r.competences_techniques) && r.competences_techniques.length
    ? r.competences_techniques
    : legacySkills.map((s) => ({ label: s, keywords: [s], obligatoire: false, poids: 1 }));
  return {
    id: r.id ?? r.code,
    code: r.code || slugify(r.job_title),
    ref: r.code || r.job_title, // identifiant d'URL (les anciens postes n'ont pas de code)
    job_title: r.job_title,
    title: r.job_title, // compatibilité avec l'ancien frontend
    sous_commission: r.sous_commission || null,
    lieu: r.lieu || null,
    nombre_postes: r.nombre_postes ?? 1,
    categorie: r.categorie || null,
    nationalites_eligibles: r.nationalites_eligibles || ['Mali', 'Burkina Faso', 'Niger'],
    mission: r.mission || '',
    min_education_rank: r.min_education_rank != null ? Number(r.min_education_rank) : 3,
    min_education_level: r.min_education_level || labelNiveau(r.min_education_rank ?? 3),
    diplome_domaines: r.diplome_domaines || [],
    min_experience_years: Number(r.min_experience_years || 0),
    max_experience_years: r.max_experience_years != null ? Number(r.max_experience_years) : null,
    experience_domaines: r.experience_domaines || [],
    competences_techniques: techniques,
    competences_comportementales: r.competences_comportementales || [],
    langues_requises: r.langues_requises || ['francais'],
    regles_elimination: r.regles_elimination || null,
    seuils: r.seuils || null,
    ponderations: r.ponderations || null,
    max_convoques: r.max_convoques != null ? Number(r.max_convoques) : null,
    source: r.source || 'manuel',
    a_confirmer: !!r.a_confirmer,
    verrouille: !!r.verrouille,
    actif: r.actif !== false,
    version: r.version || 1,
    updated_at: r.updated_at || null
  };
}

async function listCriteria() {
  const res = await db.query('SELECT * FROM job_criteria ORDER BY sous_commission NULLS LAST, job_title');
  return res.rows.map(mapRow);
}

async function getByTitle(title) {
  const res = await db.query('SELECT * FROM job_criteria WHERE job_title = $1 OR code = $1 LIMIT 1', [title]);
  return mapRow(res.rows[0]);
}

async function getByCode(code) {
  const res = await db.query('SELECT * FROM job_criteria WHERE code = $1 OR (code IS NULL AND job_title = $1) LIMIT 1', [code]);
  return mapRow(res.rows[0]);
}

async function addHistory(job, action) {
  await db.query(
    'INSERT INTO criteria_history (job_code, job_title, version, action, snapshot) VALUES ($1,$2,$3,$4,$5)',
    [job.code, job.job_title, job.version, action, JSON.stringify(job)]
  );
}

/**
 * Création / mise à jour d'un poste. Refusée si le poste est verrouillé (§13 :
 * « aucun critère non préalablement validé ne peut être introduit en cours de processus »).
 */
async function upsertCriteria(input, { action = 'modification', force = false } = {}) {
  const code = input.code || slugify(input.job_title);
  const existing = (await getByCode(code)) || (input.job_title ? await getByTitle(input.job_title) : null);
  if (existing && existing.verrouille && !force) {
    const err = new Error(`Les critères du poste « ${existing.job_title} » sont verrouillés (processus en cours). Déverrouillez-les d'abord.`);
    err.status = 423;
    throw err;
  }
  const data = { ...(existing || {}), ...input, code };
  if (data.min_education_rank != null) data.min_education_level = labelNiveau(data.min_education_rank);
  const version = existing ? (existing.version || 1) + 1 : 1;

  const cols = ['code', ...SCALAR_COLS, ...JSON_COLS, 'version'];
  const vals = cols.map((c) => {
    if (c === 'version') return version;
    if (c === 'code') return code;
    const v = data[c] === undefined ? null : data[c];
    return JSON_COLS.includes(c) && v !== null ? JSON.stringify(v) : v;
  });
  // required_skills (colonne historique) : on y recopie les libellés pour compatibilité
  const legacy = (data.competences_techniques || []).map((t) => t.label).join(', ');

  let row;
  if (existing) {
    const sets = cols.map((c, i) => `${c} = $${i + 1}`).join(', ');
    const res = await db.query(
      `UPDATE job_criteria SET ${sets}, updated_at = NOW() WHERE code = $${cols.length + 1} OR job_title = $${cols.length + 2} RETURNING *`,
      [...vals, existing.code, existing.job_title]
    );
    row = res.rows[0];
  } else {
    const ph = cols.map((_, i) => `$${i + 1}`).join(', ');
    const res = await db.query(
      `INSERT INTO job_criteria (${cols.join(', ')}, updated_at) VALUES (${ph}, NOW()) RETURNING *`,
      vals
    );
    row = res.rows[0];
    action = 'creation';
  }
  try {
    await db.query('UPDATE job_criteria SET required_skills = $1 WHERE code = $2', [legacy, code]);
  } catch (_) {
    try { await db.query('UPDATE job_criteria SET required_skills = $1 WHERE code = $2', [legacy.split(', ').filter(Boolean), code]); } catch (__) { /* colonne absente : ignoré */ }
  }

  const job = mapRow(row);
  await addHistory(job, action);
  return job;
}

async function setLock(code, verrouille) {
  const res = await db.query(
    'UPDATE job_criteria SET verrouille = $1, updated_at = NOW() WHERE code = $2 OR (code IS NULL AND job_title = $2) RETURNING *',
    [!!verrouille, code]
  );
  const job = mapRow(res.rows[0]);
  if (job) await addHistory(job, verrouille ? 'verrouillage' : 'deverrouillage');
  return job;
}

async function deleteCriteria(code) {
  await db.query('DELETE FROM job_criteria WHERE code = $1 OR (code IS NULL AND job_title = $1)', [code]);
}

async function history(code) {
  const res = await db.query(
    'SELECT id, job_code, job_title, version, action, created_at FROM criteria_history WHERE job_code = $1 ORDER BY id DESC LIMIT 50',
    [code]
  );
  return res.rows;
}

/** Restaure la fiche officielle du référentiel pour un poste */
async function restoreOfficial(code) {
  const ref = POSTES.find((p) => p.code === code);
  if (!ref) {
    const err = new Error('Ce poste ne fait pas partie du référentiel officiel.');
    err.status = 404;
    throw err;
  }
  return upsertCriteria({ ...ref }, { action: 'restauration' });
}

async function listSousCommissions() {
  try {
    const res = await db.query('SELECT * FROM sous_commissions ORDER BY COALESCE(ordre, 0), code');
    return res.rows; // liste vide possible si toutes ont été supprimées
  } catch (_) { /* table absente : valeurs par défaut */ }
  return SOUS_COMMISSIONS;
}

const scError = (message, status = 400, details) => Object.assign(new Error(message), { status, details });
const PKEYS = ['diplome', 'experience', 'techniques', 'langues'];
const DEFAULT_POND = { diplome: 25, experience: 35, techniques: 35, langues: 5 };

/** Code libre (lettres, chiffres, tiret) ; à défaut, la prochaine lettre libre (E, F, …) */
async function nextFreeCode() {
  const used = new Set((await db.query('SELECT code FROM sous_commissions')).rows.map((r) => r.code));
  for (let c = 65; c <= 90; c++) if (!used.has(String.fromCharCode(c))) return String.fromCharCode(c);
  let n = 1;
  while (used.has(`SC${n}`)) n++;
  return `SC${n}`;
}

async function createSousCommission({ code, libelle, perimetre, ponderations }) {
  if (!libelle || !String(libelle).trim()) throw scError('Le libellé de la sous-commission est obligatoire.');
  const c = code && String(code).trim() ? String(code).trim().toUpperCase() : await nextFreeCode();
  if (!/^[A-Z0-9-]{1,20}$/.test(c)) throw scError('Code invalide : lettres, chiffres ou tiret, 20 caractères au plus.');
  const exists = await db.query('SELECT 1 FROM sous_commissions WHERE code = $1', [c]);
  if (exists.rows.length) throw scError(`Le code « ${c} » est déjà utilisé.`, 409);
  const p = { ...DEFAULT_POND, ...(ponderations || {}) };
  const sum = PKEYS.reduce((a, k) => a + Number(p[k] || 0), 0);
  if (Math.round(sum) !== 100) throw scError(`La somme des pondérations doit être égale à 100 (actuellement ${sum}).`);
  const res = await db.query(
    `INSERT INTO sous_commissions (code, libelle, perimetre, ponderations, ordre)
     VALUES ($1, $2, $3, $4, (SELECT COALESCE(MAX(ordre), 0) + 1 FROM sous_commissions)) RETURNING *`,
    [c, String(libelle).trim(), perimetre || '', JSON.stringify(Object.fromEntries(PKEYS.map((k) => [k, Number(p[k] || 0)])))]
  );
  return res.rows[0];
}

async function updateSousCommission(code, { ponderations, libelle, perimetre }) {
  const cur = (await db.query('SELECT * FROM sous_commissions WHERE code = $1', [code])).rows[0];
  if (!cur) throw scError('Sous-commission introuvable.', 404);
  const res = await db.query(
    'UPDATE sous_commissions SET ponderations = $1, libelle = $2, perimetre = $3, updated_at = NOW() WHERE code = $4 RETURNING *',
    [
      JSON.stringify(ponderations || cur.ponderations),
      libelle && String(libelle).trim() ? String(libelle).trim() : cur.libelle,
      perimetre !== undefined ? perimetre : cur.perimetre,
      code
    ]
  );
  return res.rows[0];
}

/**
 * Suppression d'une sous-commission.
 * Si des postes y sont rattachés : refus (409, liste des postes), sauf si `reassign` est fourni :
 *   reassign = code d'une autre sous-commission → les postes y sont déplacés
 *   reassign = 'NONE' → les postes passent « hors référentiel »
 * Les postes verrouillés bloquent la suppression. Les règles de portée = cette sous-commission
 * suivent les postes (même cible) ou sont supprimées si les postes passent hors référentiel.
 */
async function deleteSousCommission(code, { reassign = null } = {}) {
  const cur = (await db.query('SELECT * FROM sous_commissions WHERE code = $1', [code])).rows[0];
  if (!cur) throw scError('Sous-commission introuvable.', 404);
  const postes = (await db.query('SELECT code, job_title, COALESCE(verrouille, FALSE) AS verrouille FROM job_criteria WHERE sous_commission = $1 ORDER BY job_title', [code])).rows;
  if (postes.length && !reassign) {
    throw scError(`${postes.length} poste(s) sont rattachés à cette sous-commission.`, 409, { postes: postes.map((p) => p.job_title) });
  }
  const locked = postes.filter((p) => p.verrouille);
  if (locked.length) throw scError(`Impossible : postes verrouillés (${locked.map((p) => p.job_title).join(', ')}).`, 423);
  let target = null;
  if (reassign && reassign !== 'NONE') {
    if (reassign === code) throw scError('Choisissez une autre sous-commission.');
    const t = (await db.query('SELECT code FROM sous_commissions WHERE code = $1', [reassign])).rows[0];
    if (!t) throw scError('Sous-commission de destination introuvable.', 404);
    target = t.code;
  }
  await db.query('UPDATE job_criteria SET sous_commission = $1, version = COALESCE(version, 1) + 1, updated_at = NOW() WHERE sous_commission = $2', [target, code]);
  await db.query('UPDATE candidates SET sous_commission = $1 WHERE sous_commission = $2', [target, code]);
  let regles = 0;
  try {
    const r = target
      ? await db.query('UPDATE regles_personnalisees SET portee = $1, updated_at = NOW() WHERE portee = $2', [target, code])
      : await db.query('DELETE FROM regles_personnalisees WHERE portee = $1', [code]);
    regles = r.rowCount || 0;
  } catch (_) { /* table absente */ }
  await db.query('DELETE FROM sous_commissions WHERE code = $1', [code]);
  return { postesDeplaces: postes.length, vers: target, regles };
}

module.exports = {
  mapRow, slugify, listCriteria, getByTitle, getByCode, upsertCriteria, setLock,
  deleteCriteria, history, restoreOfficial, listSousCommissions, updateSousCommission,
  createSousCommission, deleteSousCommission
};
