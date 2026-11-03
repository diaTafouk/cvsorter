const express = require('express');
const router = express.Router();
const { upload } = require('../middleware/upload');
const { uploadCandidatesCV } = require('../controllers/candidateController');

// Champ "cvs" (doit correspondre au nom du champ FormData côté React)
router.post('/upload', upload.array('cvs', 20), uploadCandidatesCV);

module.exports = router;