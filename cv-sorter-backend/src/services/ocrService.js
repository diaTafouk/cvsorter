/**
 * Reconnaissance de texte (OCR) 100 % locale pour les CV en photo et les PDF scannés.
 *
 * - Moteur : tesseract.js (Tesseract 5, WebAssembly) — aucun envoi de données à l'extérieur.
 * - Langues : français + anglais, modèles fournis dans le dossier ocr-data/ (pas de téléchargement).
 * - PDF scannés : pages converties en images par pdf-to-img, puis OCR page par page.
 *
 * Dépendances : npm install tesseract.js pdf-to-img
 */
const path = require('path');

const LANG_PATH = process.env.OCR_LANG_PATH || path.join(__dirname, '..', '..', 'ocr-data');
const LANGS = process.env.OCR_LANGS || 'fra+eng';
const MAX_PDF_PAGES = Number(process.env.OCR_MAX_PAGES || 5);

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tif', 'tiff', 'gif'];

let workerPromise = null;

/** Un seul « worker » Tesseract réutilisé pour tous les CV (le démarrage coûte ~1 s) */
async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      let createWorker;
      try {
        ({ createWorker } = require('tesseract.js'));
      } catch (e) {
        throw new Error("Lecture des photos indisponible : exécutez « npm install tesseract.js pdf-to-img » dans le dossier du backend.");
      }
      const worker = await createWorker(LANGS, 1, {
        langPath: LANG_PATH,
        gzip: false,          // modèles .traineddata non compressés fournis dans ocr-data/
        cacheMethod: 'none'   // lecture directe depuis ocr-data/
      });
      // PSM 3 : découpage automatique de la page (gère les CV en colonnes)
      await worker.setParameters({ tessedit_pageseg_mode: '3', preserve_interword_spaces: '1' });
      return worker;
    })().catch((err) => {
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

async function ocrImage(buffer) {
  const worker = await getWorker();
  const { data } = await worker.recognize(buffer);
  return { text: data.text || '', confiance: Math.round(data.confidence || 0) };
}

/** Convertit les pages d'un PDF scanné en images puis applique l'OCR */
async function ocrPdf(buffer) {
  let pdf;
  try {
    ({ pdf } = await import('pdf-to-img'));
  } catch (e) {
    throw new Error("Lecture des PDF scannés indisponible : exécutez « npm install pdf-to-img » dans le dossier du backend.");
  }
  const document = await pdf(buffer, { scale: 2.5 });
  const pages = [];
  const conf = [];
  let n = 0;
  for await (const image of document) {
    if (++n > MAX_PDF_PAGES) break;
    const r = await ocrImage(image);
    pages.push(r.text);
    conf.push(r.confiance);
  }
  return { text: pages.join('\n\n'), confiance: conf.length ? Math.round(conf.reduce((a, b) => a + b, 0) / conf.length) : 0, pages: n };
}

async function shutdown() {
  if (workerPromise) {
    try { (await workerPromise).terminate(); } catch (_) { /* ignoré */ }
    workerPromise = null;
  }
}

module.exports = { IMAGE_EXT, ocrImage, ocrPdf, shutdown };
