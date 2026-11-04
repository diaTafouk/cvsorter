const express = require('express');
const multer = require('multer');
const router = express.Router();
const candidateController = require('../controllers/candidateController');
const criteriaController = require('../controllers/criteriaController');

// Multer : fichiers en mémoire (buffer), PDF, DOCX, photos — 15 Mo max
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
 console.log(upload)
// --- Candidats ---
router.get('/candidates', candidateController.getCandidates);
router.post('/candidates/upload', upload.array('cvs'), candidateController.uploadCandidatesBatch);
router.post('/candidates/reevaluate', candidateController.reevaluateCandidates);
router.get('/candidates/:id/file', candidateController.getCandidateFile);

// --- Référentiel & critères de présélection ---
router.get('/referentiel', criteriaController.getReferentiel);
router.get('/criteria', criteriaController.getJobCriteria);
router.post('/criteria', criteriaController.saveJobCriteria);
router.post('/criteria/:ref/lock', criteriaController.lockJobCriteria);
router.post('/criteria/:ref/restore', criteriaController.restoreJobCriteria);
router.get('/criteria/:ref/history', criteriaController.getCriteriaHistory);
router.delete('/criteria/:ref', criteriaController.deleteJobCriteria);
router.post('/sous-commissions', criteriaController.createSousCommission);
router.put('/sous-commissions/:code', criteriaController.updateSousCommission);
router.delete('/sous-commissions/:code', criteriaController.deleteSousCommission);

// --- Pays de recrutement ---
router.get('/pays', criteriaController.getPays);
router.post('/pays', criteriaController.savePays);
router.delete('/pays/:nom', criteriaController.deletePays);

// --- Langues ---
router.get('/langues', criteriaController.getLangues);
router.post('/langues', criteriaController.saveLangue);
router.delete('/langues/:code', criteriaController.deleteLangue);

// --- Conditions de recevabilité / règles d'élimination personnalisées ---
router.get('/regles', criteriaController.getRegles);
router.post('/regles', criteriaController.saveRegle);
router.put('/regles/:id', criteriaController.saveRegle);
router.delete('/regles/:id', criteriaController.deleteRegle);

// --- Routes Administrateur CRUD ---
router.get('/admin/candidates', candidateController.getAdminCandidates);
router.delete('/admin/candidates/:id', candidateController.deleteCandidateById);
router.delete('/admin/purge-all', candidateController.purgeAllCandidates);
router.delete('/candidates', candidateController.resetAndArchiveCandidates);

module.exports = router;
