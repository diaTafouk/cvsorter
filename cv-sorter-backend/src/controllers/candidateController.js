const pdfParse = require('pdf-parse-fork');
const mammoth = require('mammoth');
const db = require('../config/db');
const { evaluateCandidate, rankCandidates } = require('../services/preselectionEngine');
const criteriaRepo = require('../services/criteriaRepository');
const { extractIdentity } = require('../services/identityExtractor');
const paysRepo = require('../services/paysRepository');
const ocr = require('../services/ocrService');
const settings = require('../services/settingsRepository');

// --- 2. Extraction du texte (PDF / Word / photo) ---
// PDF texte → pdf-parse ; PDF scanné (peu ou pas de texte) → OCR ; photo (JPG, PNG…) → OCR ; Word → mammoth
const MIN_PDF_TEXT = 200; // en dessous, le PDF est considéré comme scanné

async function extractText(file) {
  const ext = file.originalname.split('.').pop().toLowerCase();
  if (ext === 'pdf') {
    let text = '';
    try { text = (await pdfParse(file.buffer)).text || ''; } catch (_) { text = ''; }
    if (text.replace(/\s/g, '').length >= MIN_PDF_TEXT) return { ext, text, ocr: null };
    const r = await ocr.ocrPdf(file.buffer);
    return { ext, text: r.text, ocr: { type: 'pdf-scanne', confiance: r.confiance, pages: r.pages } };
  }
  if (ocr.IMAGE_EXT.includes(ext)) {
    const r = await ocr.ocrImage(file.buffer);
    return { ext, text: r.text, ocr: { type: 'photo', confiance: r.confiance } };
  }
  if (ext === 'heic' || ext === 'heif') {
    throw new Error("Format HEIC (photo iPhone) non pris en charge : exportez la photo en JPG ou PNG.");
  }
  if (ext === 'docx') {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return { ext, text: result.value || '', ocr: null };
  }
  if (ext === 'doc') {
    throw new Error('Ancien format Word (.doc) non pris en charge : enregistrez le fichier en .docx ou en PDF.');
  }
  if (ext === 'txt') return { ext, text: file.buffer.toString('utf-8'), ocr: null };
  throw new Error(`Format .${ext} non pris en charge (PDF, DOCX, JPG, PNG acceptés).`);
}

// Type MIME du fichier original (pour le rouvrir dans son format)
const MIME_BY_EXT = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  tif: 'image/tiff', tiff: 'image/tiff', bmp: 'image/bmp', txt: 'text/plain; charset=utf-8'
};
const mimeOf = (ext, fallback) => MIME_BY_EXT[ext] || fallback || 'application/octet-stream';

// --- 3. Import & présélection d'un lot de CVs ---
const uploadCandidatesBatch = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "Aucun fichier n'a été téléchargé." });
    }
    const country = req.body.country || 'Mali';
    const jobRef = req.body.jobCode || req.body.jobTitle;
    const job = jobRef ? await criteriaRepo.getByTitle(jobRef) : null;
    if (!job) {
      return res.status(400).json({ error: `Poste « ${jobRef || '—'} » introuvable dans la configuration. Configurez-le d'abord dans « Configuration IA ».` });
    }
    const sousCommissions = await criteriaRepo.listSousCommissions();
    const nationalites = await paysRepo.nationalitesMap();
    const langues = await settings.languesMap();
    const regles = await settings.listRegles();

    const createdCandidates = [];
    const errors = [];
    for (const file of req.files) {
      try {
        const { ext, text, ocr: ocrInfo } = await extractText(file);
        const identity = extractIdentity(text, file.originalname);
        const evaluation = evaluateCandidate(text, job, { country, sousCommissions, nationalites, langues, reglesPerso: settings.reglesPour(regles, job), ocr: ocrInfo });

        const dbResult = await db.query(
          `INSERT INTO candidates (
             "fileName", format, "fileSize", name, email, phone, "rawContent", status, country, job_title, evaluation,
             job_code, sous_commission, score, decision, a_verifier, criteria_version, evaluated_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17, NOW())
           RETURNING *;`,
          [
            file.originalname, ext, `${(file.size / 1024).toFixed(2)} Ko`, identity.name, identity.email, identity.phone,
            text, evaluation.decision, country, job.job_title, JSON.stringify(evaluation),
            job.code, job.sous_commission, evaluation.score, evaluation.decision, evaluation.aVerifier, job.version
          ]
        );
        const created = dbResult.rows[0];
        // Fichier original conservé tel quel (PDF, Word, photo) pour l'ouvrir depuis la fiche
        try {
          await db.query(
            `INSERT INTO candidate_files (candidate_id, file_name, mime_type, size_bytes, content)
             VALUES ($1,$2,$3,$4,$5) ON CONFLICT (candidate_id) DO UPDATE
             SET file_name = EXCLUDED.file_name, mime_type = EXCLUDED.mime_type, size_bytes = EXCLUDED.size_bytes, content = EXCLUDED.content`,
            [String(created.id), file.originalname, mimeOf(ext, file.mimetype), file.size, file.buffer]
          );
          created.has_file = true;
        } catch (e) {
          console.error('Fichier CV non conservé :', e.message);
        }
        createdCandidates.push(created);
      } catch (e) {
        errors.push({ file: file.originalname, error: e.message });
      }
    }

    res.status(200).json({ success: true, candidates: createdCandidates, errors });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// --- 4. Réévaluation des CVs déjà importés avec les critères actuels ---
const reevaluateCandidates = async (req, res) => {
  try {
    const { jobTitle } = req.body || {};
    const params = [];
    let where = '';
    if (jobTitle) { where = 'WHERE job_title = $1'; params.push(jobTitle); }
    const rows = (await db.query(`SELECT id, "rawContent", "fileName", name, email, phone, country, job_title, evaluation->'ocr' AS ocr FROM candidates ${where}`, params)).rows;
    const sousCommissions = await criteriaRepo.listSousCommissions();
    const nationalites = await paysRepo.nationalitesMap();
    const langues = await settings.languesMap();
    const regles = await settings.listRegles();
    const cache = {};
    let updated = 0;
    const skipped = [];
    for (const c of rows) {
      if (!(c.job_title in cache)) cache[c.job_title] = await criteriaRepo.getByTitle(c.job_title);
      const job = cache[c.job_title];
      if (!job) { skipped.push({ id: c.id, raison: 'poste non configuré' }); continue; }
      const evaluation = evaluateCandidate(c.rawContent || '', job, { country: c.country, sousCommissions, nationalites, langues, reglesPerso: settings.reglesPour(regles, job), ocr: c.ocr || null });
      // Ré-extraction de l'identité (améliorations continues de la détection du nom)
      const id = extractIdentity(c.rawContent || '', c.fileName || '');
      await db.query(
        'UPDATE candidates SET name = $1, email = $2, phone = $3 WHERE id = $4',
        [id.nameIdentified ? id.name : c.name, id.email || c.email, id.phone || c.phone, c.id]
      );
      await db.query(
        `UPDATE candidates SET evaluation = $1, status = $2, score = $3, decision = $4, a_verifier = $5,
           criteria_version = $6, job_code = $7, sous_commission = $8, evaluated_at = NOW(), "updatedAt" = NOW() WHERE id = $9`,
        [JSON.stringify(evaluation), evaluation.decision, evaluation.score, evaluation.decision, evaluation.aVerifier, job.version, job.code, job.sous_commission, c.id]
      );
      updated++;
    }
    res.status(200).json({ success: true, updated, skipped });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// --- 5. Liste des candidats avec rang par poste (§17), ex æquo et convocation (§12) ---
const getCandidates = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.*, (f.candidate_id IS NOT NULL) AS has_file, f.mime_type AS file_mime
       FROM candidates c LEFT JOIN candidate_files f ON f.candidate_id = c.id::text
       ORDER BY c."createdAt" DESC`
    ).catch(() => db.query('SELECT * FROM candidates ORDER BY "createdAt" DESC')); // avant la migration 007
    const jobs = await criteriaRepo.listCriteria().catch(() => []);
    const byTitle = Object.fromEntries(jobs.map((j) => [j.job_title, j]));
    const ranked = rankCandidates(result.rows, byTitle).map((c) => {
      const { rawContent, ...rest } = c; // texte brut tronqué dans la liste (allège la réponse)
      return { ...rest, extractedText: (rawContent || '').slice(0, 1500) };
    });
    res.status(200).json(ranked);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// --- 5 bis. Fichier CV original ---
// GET /api/candidates/:id/file            → ouverture dans le navigateur (PDF, photo) ; Word s'ouvre dans Word
// GET /api/candidates/:id/file?download=1 → téléchargement
const getCandidateFile = async (req, res) => {
  try {
    const r = await db.query(
      'SELECT file_name, mime_type, content FROM candidate_files WHERE candidate_id = $1',
      [String(req.params.id)]
    );
    const f = r.rows[0];
    if (!f) {
      return res.status(404).send("Fichier original non disponible : ce CV a été importé avant la conservation des fichiers. Réimportez-le pour pouvoir l'ouvrir.");
    }
    const name = f.file_name || 'cv';
    const ascii = name.normalize('NFD').replace(/[^\x20-\x7e]/g, '').replace(/["\\]/g, '') || 'cv';
    const mode = req.query?.download ? 'attachment' : 'inline';
    res.setHeader('Content-Type', f.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `${mode}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(f.content);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// --- 4. ROUTES D'ADMINISTRATION POUR LA PAGE DATABASE CRUD ---

// Récupérer les candidats actifs + archivés
const getAdminCandidates = async (req, res) => {
  try {
    // S'assurer que la table d'archives existe
    await db.query(`
      CREATE TABLE IF NOT EXISTS archived_candidates (
        id SERIAL PRIMARY KEY,
        original_id TEXT,
        name VARCHAR(255),
        job_title VARCHAR(255),
        country VARCHAR(100),
        email VARCHAR(255),
        phone VARCHAR(100),
        evaluation JSONB,
        deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const activeRes = await db.query('SELECT * FROM candidates ORDER BY "createdAt" DESC;');
    const archivedRes = await db.query('SELECT * FROM archived_candidates ORDER BY deleted_at DESC;');

    res.status(200).json({
      active: activeRes.rows || [],
      archived: archivedRes.rows || []
    });
  } catch (error) {
    console.error('Erreur DB Admin Get:', error);
    res.status(500).json({ error: error.message });
  }
};

// Supprimer un candidat individuel
const deleteCandidateById = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM candidates WHERE id = $1;', [id]);
    await db.query('DELETE FROM candidate_files WHERE candidate_id = $1', [String(id)]).catch(() => {});
    res.status(200).json({ success: true, message: `Candidat ID ${id} supprimé.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Purge totale PostgreSQL
const purgeAllCandidates = async (req, res) => {
  try {
    await db.query('DELETE FROM candidates;');
    await db.query('DELETE FROM archived_candidates;');
    await db.query('DELETE FROM candidate_files;').catch(() => {});
    res.status(200).json({ success: true, message: 'Purge totale de PostgreSQL effectuée.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// --- Réinitialisation : archive les CVs analysés puis vide le tableau de bord ---
// DELETE /api/candidates            → tous les dossiers
// DELETE /api/candidates?jobTitle=X → seulement les dossiers d'un poste
async function resetAndArchiveCandidates(req, res) {
  try {
    const jobTitle = req.query?.jobTitle || null;
    const where = jobTitle ? 'WHERE job_title = $1' : '';
    const params = jobTitle ? [jobTitle] : [];

    const archived = await db.query(
      `WITH moved AS (
         DELETE FROM candidates ${where}
         RETURNING id, name, job_title, country, email, phone, evaluation, "rawContent", score, decision
       )
       INSERT INTO archived_candidates
         (original_id, name, job_title, country, email, phone, evaluation, extracted_text, score, decision, deleted_at)
       SELECT id::text, COALESCE(name, 'Inconnu'), COALESCE(job_title, 'Non spécifié'), country,
              email, phone, evaluation, "rawContent", score, decision, NOW()
       FROM moved
       RETURNING id`,
      params
    );

    return res.status(200).json({
      success: true,
      archived: archived.rows.length,
      message: `${archived.rows.length} dossier(s) archivé(s)${jobTitle ? ` pour le poste « ${jobTitle} »` : ''}.`
    });
  } catch (error) {
    console.error('Erreur réinitialisation:', error);
    return res.status(500).json({ error: error.message });
  }
}

// Toujours placer le module.exports tout en bas du fichier
module.exports = {
  uploadCandidatesBatch,
  reevaluateCandidates,
  getCandidates,
  getCandidateFile,
  getAdminCandidates,
  deleteCandidateById,
  purgeAllCandidates,
  resetAndArchiveCandidates
};
