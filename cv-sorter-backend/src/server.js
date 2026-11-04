const express = require('express');
const cors = require('cors');
require('dotenv').config();

const candidateRoutes = require('./routes/candidateRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// Routes de l'API
app.use('/api', candidateRoutes);

// Interface web compilée (npm run build dans cv-sorter-frontend) servie par le backend :
// une seule adresse / un seul port à publier (tunnel Cloudflare, serveur en ligne).
// Emplacement modifiable par FRONTEND_DIST dans le .env.
const path = require('path');
const fs = require('fs');
const FRONTEND_DIST = path.resolve(process.env.FRONTEND_DIST || path.join(__dirname, '..', '..', 'cv-sorter-frontend', 'dist'));
const hasFrontend = fs.existsSync(path.join(FRONTEND_DIST, 'index.html'));
if (hasFrontend) {
  app.use(express.static(FRONTEND_DIST, { index: 'index.html' }));
}
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
  if (hasFrontend) return res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  if (req.path === '/') return res.send('API CV Sorter backend en marche ! (interface non compilée : lancez « npm run build » dans cv-sorter-frontend)');
  next();
});

// Démarrage du serveur
// HOST=127.0.0.1 dans le .env : accessible uniquement depuis ce Mac et via le tunnel (recommandé)
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`Backend connecté et en écoute sur http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(hasFrontend ? `Interface web servie depuis ${FRONTEND_DIST}` : 'Interface web non compilée : seule l\'API est disponible.');
});
// Les routes candidats / critères / administration sont définies dans src/routes/candidateRoutes.js

// Dans vos variables d'environnement (.env) ou directement dans le serveur :
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '1234'; // <--- Mot de passe configuré directement

// Endpoint de vérification du mot de passe
app.post('/api/admin/verify-password', (req, res) => {
  const { password } = req.body;

  if (password === ADMIN_PASSWORD) {
    return res.status(200).json({ success: true, token: 'auth-granted-session' });
  } else {
    return res.status(401).json({ success: false, error: 'Mot de passe incorrect.' });
  }
});