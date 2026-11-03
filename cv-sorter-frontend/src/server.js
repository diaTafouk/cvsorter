const express = require('express');
const cors = require('cors');
const candidateRoutes = require('../routes/candidateRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes API
app.use('/api/candidates', candidateRoutes);

// Gestionnaire d'erreurs Multer
app.use((err, req, res, next) => {
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

app.listen(PORT, () => {
  console.log(`Serveur Backend démarré sur http://localhost:${PORT}`);
});