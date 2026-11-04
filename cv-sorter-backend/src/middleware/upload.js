const multer = require('multer');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const ext = file.originalname.split('.').pop().toLowerCase();

  if (['pdf', 'doc', 'docx'].includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Le fichier ${file.originalname} n'est pas un PDF ou Word valide.`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
});

module.exports = upload;