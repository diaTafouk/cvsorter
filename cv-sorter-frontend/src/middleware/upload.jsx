const multer = require('multer');

// Stockage en mémoire tampon (Buffer)
const storage = multer.memoryStorage();

// Filtrage strict sur les types MIME et extensions PDF / Word
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  const isAllowedExt = file.originalname.match(/\.(pdf|doc|docx)$/i);

  if (allowedMimeTypes.includes(file.mimetype) || isAllowedExt) {
    cb(null, true);
  } else {
    cb(new Error(`Le fichier ${file.originalname} n'est ni un PDF ni un document Word valide.`), false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // Limite à 10 Mo par fichier
  }
});