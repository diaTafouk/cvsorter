const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

/**
 * Service d'extraction du texte selon l'extension
 */
const extractTextFromBuffer = async (buffer, mimetype, filename) => {
  const ext = filename.split('.').pop().toLowerCase();

  if (ext === 'pdf' || mimetype === 'application/pdf') {
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (ext === 'docx' || mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (ext === 'doc' || mimetype === 'application/msword') {
    throw new Error('Les anciens fichiers .doc ne sont pas supportés par Mammoth. Veuillez les convertir en .docx ou .pdf.');
  }

  throw new Error('Format non pris en charge.');
};

/**
 * Extraction basique d'informations structurées
 */
const extractMetadata = (text, filename) => {
  // Détection d'email
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  
  // Détection de numéro de téléphone (formats internationaux / FR)
  const phoneMatch = text.match(/(?:(?:\+|00)\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{2,4}[\s.-]?\d{2,4}[\s.-]?\d{2,4}/);

  // Nom approximatif basé sur le nom du fichier
  const cleanName = filename
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]/g, ' ')
    .trim();

  return {
    candidateName: cleanName,
    email: emailMatch ? emailMatch[0] : null,
    phone: phoneMatch ? phoneMatch[0] : null,
    previewText: text.substring(0, 300).replace(/\s+/g, ' ').trim() + '...'
  };
};

/**
 * Contrôleur HTTP principal d'upload
 */
const uploadCandidatesCV = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Aucun fichier n\'a été transmis.' });
    }

    const processedCandidates = [];
    const errors = [];

    for (const file of req.files) {
      try {
        // 1. Extraction du texte brut
        const rawText = await extractTextFromBuffer(file.buffer, file.mimetype, file.originalname);
        
        // 2. Parsing basique des champs (Email, Téléphone, etc.)
        const metadata = extractMetadata(rawText, file.originalname);

        // 3. Structure du candidat retournée au Front-end
        processedCandidates.push({
          id: Date.now() + Math.random().toString(36).substring(2, 9),
          fileName: file.originalname,
          format: file.originalname.split('.').pop().toUpperCase(),
          fileSize: `${(file.size / (1024 * 1024)).toFixed(2)} Mo`,
          name: metadata.candidateName,
          email: metadata.email,
          phone: metadata.phone,
          rawContent: rawText,
          preview: metadata.previewText,
          uploadDate: new Date().toLocaleDateString('fr-FR')
        });
      } catch (fileError) {
        errors.push({
          fileName: file.originalname,
          message: fileError.message
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: `${processedCandidates.length} CV(s) traité(s) avec succès.`,
      candidates: processedCandidates,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Erreur Serveur:', error);
    return res.status(500).json({ error: 'Une erreur serveur est survenue lors du traitement des CVs.' });
  }
};

module.exports = {
  uploadCandidatesCV
};