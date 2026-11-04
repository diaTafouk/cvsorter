/**
 * Langues (table langues) et règles personnalisées (table regles_personnalisees),
 * gérées depuis la page Configuration.
 */
const db = require('../config/db');
const { LANGUES } = require('../data/referentiel');

const err = (message, status = 400) => Object.assign(new Error(message), { status });
const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const cleanList = (l) => Array.from(new Set((Array.isArray(l) ? l : []).map((x) => String(x).trim()).filter(Boolean)));

// ---------------------------------------------------------------- LANGUES
const DEFAULT_LANGUES = Object.entries(LANGUES).map(([code, l], i) => ({ code, label: l.label, synonymes: l.synonymes, ordre: i + 1 }));

async function listLangues() {
  try {
    const r = await db.query('SELECT code, label, synonymes, ordre FROM langues ORDER BY ordre, label');
    return r.rows;
  } catch (_) {
    return DEFAULT_LANGUES; // migration 005 non jouée
  }
}

/** { code: { label, synonymes } } utilisé par le moteur */
async function languesMap() {
  const list = await listLangues();
  return Object.fromEntries(list.map((l) => [l.code, { label: l.label, synonymes: l.synonymes?.length ? l.synonymes : [l.label] }]));
}

async function saveLangue({ code, label, synonymes }) {
  if (!label || !String(label).trim()) throw err('Le nom de la langue est obligatoire.');
  const c = code || slug(label);
  if (!c) throw err('Nom de langue invalide.');
  const syn = cleanList(synonymes);
  if (!syn.length) syn.push(String(label).trim());
  const r = await db.query(
    `INSERT INTO langues (code, label, synonymes, ordre, updated_at)
     VALUES ($1, $2, $3, (SELECT COALESCE(MAX(ordre), 0) + 1 FROM langues), NOW())
     ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, synonymes = EXCLUDED.synonymes, updated_at = NOW()
     RETURNING code, label, synonymes, ordre`,
    [c, String(label).trim(), JSON.stringify(syn)]
  );
  return r.rows[0];
}

/**
 * Suppression d'une langue.
 * Sans force : refusée (409) si la langue est exigée par des postes ou des règles, avec la liste.
 * Avec force : la langue est retirée des postes non verrouillés et les règles « langue exigée » qui
 * la visent sont supprimées ; refusée si un poste verrouillé l'exige.
 */
async function deleteLangue(code, { force = false } = {}) {
  const used = await db.query(
    'SELECT code, job_title, COALESCE(verrouille, FALSE) AS verrouille FROM job_criteria WHERE langues_requises @> $1::jsonb',
    [JSON.stringify([code])]
  );
  let rules = { rows: [] };
  try {
    rules = await db.query("SELECT id, libelle FROM regles_personnalisees WHERE type = 'langue_requise' AND valeurs @> $1::jsonb", [JSON.stringify([code])]);
  } catch (_) { /* table absente */ }

  if (!force && (used.rows.length || rules.rows.length)) {
    const e = err(
      `Cette langue est exigée par ${used.rows.length} poste(s)${rules.rows.length ? ` et ${rules.rows.length} règle(s)` : ''}.`,
      409
    );
    e.details = { postes: used.rows.map((r) => r.job_title), regles: rules.rows.map((r) => r.libelle) };
    throw e;
  }
  const locked = used.rows.filter((r) => r.verrouille);
  if (locked.length) {
    throw err(`Impossible : langue exigée par des postes verrouillés (${locked.map((r) => r.job_title).join(', ')}).`, 423);
  }
  for (const r of used.rows) {
    await db.query(
      `UPDATE job_criteria
       SET langues_requises = COALESCE((SELECT jsonb_agg(x) FROM jsonb_array_elements(langues_requises) x WHERE x <> to_jsonb($1::text)), '[]'::jsonb),
           version = COALESCE(version, 1) + 1, updated_at = NOW()
       WHERE code = $2`,
      [code, r.code]
    );
  }
  for (const r of rules.rows) await db.query('DELETE FROM regles_personnalisees WHERE id = $1', [r.id]);
  await db.query('DELETE FROM langues WHERE code = $1', [code]);
  return { postesModifies: used.rows.length, reglesSupprimees: rules.rows.length };
}

// ---------------------------------------------------------------- RÈGLES PERSONNALISÉES
const REGLE_TYPES = {
  mot_cle_requis: { label: 'Le CV doit mentionner au moins un de ces termes', besoin: 'valeurs', exemple: 'permis de conduire, carte de presse' },
  mot_cle_interdit: { label: 'Le CV ne doit mentionner aucun de ces termes', besoin: 'valeurs', exemple: 'radié, condamnation' },
  age_maximum: { label: 'Âge maximum (ans)', besoin: 'valeur', exemple: '45' },
  experience_totale_min: { label: 'Expérience totale minimale (ans)', besoin: 'valeur', exemple: '2' },
  experience_liee_min: { label: 'Expérience liée au poste minimale (ans)', besoin: 'valeur', exemple: '1' },
  diplome_min: { label: "Niveau d'études minimum", besoin: 'niveau', exemple: 'Bac+3' },
  langue_requise: { label: 'Langue exigée', besoin: 'langue', exemple: 'Anglais' },
  note_critere_min: { label: "Note minimale sur un critère de la grille (/100)", besoin: 'critere', exemple: 'Compétences techniques ≥ 40' }
};

function validateRegle(r) {
  if (!r.libelle || !String(r.libelle).trim()) throw err('Le libellé de la règle est obligatoire.');
  const t = REGLE_TYPES[r.type];
  if (!t) throw err('Type de règle inconnu.');
  if (!['eliminer', 'verifier'].includes(r.mode)) throw err('Mode invalide (éliminatoire ou à vérifier).');
  if (t.besoin === 'valeurs' && !cleanList(r.valeurs).length) throw err('Indiquez au moins un terme à rechercher.');
  if (['valeur', 'niveau', 'critere'].includes(t.besoin) && (r.valeur === null || r.valeur === undefined || r.valeur === '' || isNaN(Number(r.valeur)))) throw err('Indiquez une valeur numérique.');
  if (t.besoin === 'langue' && !cleanList(r.valeurs).length) throw err('Choisissez la langue exigée.');
  if (t.besoin === 'critere' && !['diplome', 'experience', 'techniques', 'langues'].includes(cleanList(r.valeurs)[0])) throw err('Choisissez le critère de la grille.');
}

async function assertPorteeModifiable(portee) {
  if (!String(portee || '').startsWith('poste:')) return;
  const code = portee.slice(6);
  const r = await db.query('SELECT verrouille, job_title FROM job_criteria WHERE code = $1', [code]);
  if (r.rows[0]?.verrouille) throw err(`Les critères du poste « ${r.rows[0].job_title} » sont verrouillés.`, 423);
}

async function listRegles() {
  try {
    const r = await db.query('SELECT * FROM regles_personnalisees ORDER BY portee, id');
    return r.rows.map((x) => ({ ...x, valeur: x.valeur !== null ? Number(x.valeur) : null }));
  } catch (_) {
    return [];
  }
}

async function saveRegle(input) {
  const r = { mode: 'eliminer', portee: 'tous', actif: true, ...input, valeurs: cleanList(input.valeurs) };
  validateRegle(r);
  await assertPorteeModifiable(r.portee);
  const vals = [String(r.libelle).trim(), r.type, JSON.stringify(r.valeurs), r.valeur === '' || r.valeur == null ? null : Number(r.valeur), r.mode, r.portee, !!r.actif];
  if (r.id) {
    const old = await db.query('SELECT portee FROM regles_personnalisees WHERE id = $1', [r.id]);
    if (!old.rows.length) throw err('Règle introuvable.', 404);
    await assertPorteeModifiable(old.rows[0].portee);
    const res = await db.query(
      `UPDATE regles_personnalisees SET libelle=$1, type=$2, valeurs=$3, valeur=$4, mode=$5, portee=$6, actif=$7, updated_at=NOW()
       WHERE id=$8 RETURNING *`, [...vals, r.id]);
    return res.rows[0];
  }
  const res = await db.query(
    `INSERT INTO regles_personnalisees (libelle, type, valeurs, valeur, mode, portee, actif)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`, vals);
  return res.rows[0];
}

async function deleteRegle(id) {
  const old = await db.query('SELECT portee FROM regles_personnalisees WHERE id = $1', [id]);
  if (old.rows.length) await assertPorteeModifiable(old.rows[0].portee);
  await db.query('DELETE FROM regles_personnalisees WHERE id = $1', [id]);
}

/** Règles applicables à un poste : tous les postes + sa sous-commission + le poste lui-même */
function reglesPour(regles, job) {
  return (regles || []).filter((r) => r.actif !== false && (
    r.portee === 'tous' ||
    (job?.sous_commission && r.portee === job.sous_commission) ||
    (job?.code && r.portee === `poste:${job.code}`)
  ));
}

module.exports = {
  listLangues, languesMap, saveLangue, deleteLangue,
  REGLE_TYPES, listRegles, saveRegle, deleteRegle, reglesPour
};
