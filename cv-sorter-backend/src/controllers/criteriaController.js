/**
 * API de configuration des critères de présélection (page « Configuration IA »)
 */
const repo = require('../services/criteriaRepository');
const paysRepo = require('../services/paysRepository');
const settings = require('../services/settingsRepository');
const {
  NIVEAUX_ETUDES, LANGUES, REGLES_PAR_DEFAUT, SEUILS_PAR_DEFAUT, CATEGORIES, POSTES
} = require('../data/referentiel');
const { DECISIONS, ENGINE_VERSION } = require('../services/preselectionEngine');

const fail = (res, error) => res.status(error.status || 500).json({ error: error.message });

const PONDERATION_KEYS = ['diplome', 'experience', 'techniques', 'langues'];

function validate(body) {
  if (!body.job_title || !String(body.job_title).trim()) return "L'intitulé du poste est obligatoire.";
  if (body.ponderations) {
    const sum = PONDERATION_KEYS.reduce((a, k) => a + Number(body.ponderations[k] || 0), 0);
    if (Math.round(sum) !== 100) return `La somme des pondérations doit être égale à 100 (actuellement ${sum}).`;
  }
  if (body.seuils) {
    const { propose, reserve } = body.seuils;
    if (Number(reserve) > Number(propose)) return 'Le seuil de réserve ne peut pas dépasser le seuil de présélection.';
  }
  for (const list of [body.competences_techniques, body.competences_comportementales]) {
    for (const c of list || []) {
      if (!c.label || !Array.isArray(c.keywords) || !c.keywords.length) {
        return `Chaque compétence doit avoir un libellé et au moins un mot-clé (« ${c.label || '?'} »).`;
      }
    }
  }
  return null;
}

// GET /api/referentiel — options pour l'interface
const getReferentiel = async (req, res) => {
  try {
    res.json({
      moteur: ENGINE_VERSION,
      sousCommissions: await repo.listSousCommissions(),
      niveaux: NIVEAUX_ETUDES,
      langues: (await settings.listLangues()).map((l) => ({ code: l.code, label: l.label, synonymes: l.synonymes })),
      regleTypes: settings.REGLE_TYPES,
      pays: (await paysRepo.listPays()).map((p) => p.nom),
      categories: CATEGORIES,
      reglesParDefaut: REGLES_PAR_DEFAUT,
      seuilsParDefaut: SEUILS_PAR_DEFAUT,
      decisions: DECISIONS,
      postesOfficiels: POSTES.map((p) => p.code)
    });
  } catch (e) { fail(res, e); }
};

// GET /api/criteria
const getJobCriteria = async (req, res) => {
  try { res.json(await repo.listCriteria()); } catch (e) { fail(res, e); }
};

// POST /api/criteria — création / modification (accepte aussi l'ancien format)
const saveJobCriteria = async (req, res) => {
  try {
    const b = { ...req.body };
    // Compatibilité ancien frontend : { jobTitle, minExperienceYears, minEducationLevel, requiredSkills }
    if (!b.job_title && b.jobTitle) b.job_title = b.jobTitle;
    if (b.minExperienceYears != null && b.min_experience_years == null) b.min_experience_years = Number(b.minExperienceYears);
    if (b.requiredSkills && !b.competences_techniques) {
      const list = Array.isArray(b.requiredSkills) ? b.requiredSkills : String(b.requiredSkills).split(',');
      b.competences_techniques = list.map((s) => s.trim()).filter(Boolean).map((s) => ({ label: s, keywords: [s], obligatoire: false, poids: 1 }));
    }
    const error = validate(b);
    if (error) return res.status(400).json({ error });
    const job = await repo.upsertCriteria(b);
    res.json({ success: true, criteria: job });
  } catch (e) { fail(res, e); }
};

// POST /api/criteria/:ref/lock  { verrouille: true|false }
const lockJobCriteria = async (req, res) => {
  try {
    const job = await repo.setLock(req.params.ref, req.body?.verrouille !== false);
    if (!job) return res.status(404).json({ error: 'Poste introuvable.' });
    res.json({ success: true, criteria: job });
  } catch (e) { fail(res, e); }
};

// POST /api/criteria/:ref/restore — revenir à la fiche officielle
const restoreJobCriteria = async (req, res) => {
  try { res.json({ success: true, criteria: await repo.restoreOfficial(req.params.ref) }); } catch (e) { fail(res, e); }
};

// DELETE /api/criteria/:ref
const deleteJobCriteria = async (req, res) => {
  try {
    const job = await repo.getByCode(req.params.ref);
    if (job?.verrouille) return res.status(423).json({ error: 'Poste verrouillé : suppression impossible.' });
    await repo.deleteCriteria(req.params.ref);
    res.json({ success: true });
  } catch (e) { fail(res, e); }
};

// GET /api/criteria/:ref/history
const getCriteriaHistory = async (req, res) => {
  try { res.json(await repo.history(req.params.ref)); } catch (e) { fail(res, e); }
};

// PUT /api/sous-commissions/:code  { ponderations }
const updateSousCommission = async (req, res) => {
  try {
    const b = req.body || {};
    if (b.ponderations) {
      const sum = PONDERATION_KEYS.reduce((a, k) => a + Number(b.ponderations[k] || 0), 0);
      if (Math.round(sum) !== 100) return res.status(400).json({ error: `La somme des pondérations doit être égale à 100 (actuellement ${sum}).` });
    }
    res.json({ success: true, sousCommission: await repo.updateSousCommission(req.params.code, b) });
  } catch (e) { fail(res, e); }
};

// POST /api/sous-commissions  { code?, libelle, perimetre?, ponderations? }
const createSousCommission = async (req, res) => {
  try { res.json({ success: true, sousCommission: await repo.createSousCommission(req.body || {}) }); } catch (e) { fail(res, e); }
};

// DELETE /api/sous-commissions/:code?reassign=<code>|NONE
const deleteSousCommission = async (req, res) => {
  try {
    res.json({ success: true, ...(await repo.deleteSousCommission(req.params.code, { reassign: req.query?.reassign || null })) });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message, ...(e.details || {}) });
  }
};

// --- Pays de recrutement ---
const getPays = async (req, res) => {
  try { res.json(await paysRepo.listPays()); } catch (e) { fail(res, e); }
};
const savePays = async (req, res) => {
  try { res.json({ success: true, pays: await paysRepo.upsertPays(req.body || {}) }); } catch (e) { fail(res, e); }
};
const deletePays = async (req, res) => {
  try { await paysRepo.deletePays(req.params.nom); res.json({ success: true }); } catch (e) { fail(res, e); }
};

// --- Langues ---
const getLangues = async (req, res) => { try { res.json(await settings.listLangues()); } catch (e) { fail(res, e); } };
const saveLangue = async (req, res) => { try { res.json({ success: true, langue: await settings.saveLangue(req.body || {}) }); } catch (e) { fail(res, e); } };
const deleteLangue = async (req, res) => {
  try {
    const force = ['1', 'true', 'oui'].includes(String(req.query?.force || ''));
    res.json({ success: true, ...(await settings.deleteLangue(req.params.code, { force })) });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message, ...(e.details || {}) });
  }
};

// --- Conditions de recevabilité / règles personnalisées ---
const getRegles = async (req, res) => { try { res.json(await settings.listRegles()); } catch (e) { fail(res, e); } };
const saveRegle = async (req, res) => {
  try { res.json({ success: true, regle: await settings.saveRegle({ ...(req.body || {}), id: req.params?.id ? Number(req.params.id) : req.body?.id }) }); } catch (e) { fail(res, e); }
};
const deleteRegle = async (req, res) => { try { await settings.deleteRegle(Number(req.params.id)); res.json({ success: true }); } catch (e) { fail(res, e); } };

module.exports = {
  getPays, savePays, deletePays,
  getLangues, saveLangue, deleteLangue,
  getRegles, saveRegle, deleteRegle,
  getReferentiel, getJobCriteria, saveJobCriteria, lockJobCriteria, restoreJobCriteria,
  deleteJobCriteria, getCriteriaHistory, updateSousCommission,
  createSousCommission, deleteSousCommission
};
