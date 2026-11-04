/**
 * Extraction de l'identité du candidat (prénom et nom, email, téléphone) depuis le texte du CV.
 */
const strip = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Mots qui ne peuvent pas faire partie d'un nom (titres de section, intitulés de poste, état civil…)
const NOT_A_NAME = new Set(`
curriculum vitae cv resume projets projet experiences experience professionnelles professionnelle professionnel
formation formations competences competence profil contact contacts langues langue diplomes diplome etudes etude
objectif objectifs informations information personnelles personnel adresse email mail telephone tel portable
nationalite ne nee date lieu naissance age ans etat civil situation matrimoniale celibataire marie mariee
ingenieur technicien technicienne developpeur developpeuse journaliste assistant assistante comptable directeur
directrice chef responsable auditeur auditrice informaticien informaticienne stagiaire stage juriste conseiller
manager gestionnaire consultant consultante operateur operatrice monteur cameraman realisateur secretaire chauffeur
archiviste maquilleuse animateur animatrice presentateur presentatrice reporter infographe charge chargee agent
rue quartier bp ville republique references reference centres centre interet interets loisirs page
qualites atouts certifications certification logiciels outils connaissances activites associatives divers
licence master doctorat bac baccalaureat universite ecole institut faculte lycee
de du des la le les et en au aux pour avec sur dans par
mali burkina faso niger bamako ouagadougou niamey senegal dakar cote ivoire abidjan guinee conakry
sarl sa sas ong groupe societe entreprise banque cabinet agence ministere direction service radio television tv fm
orange moov malitel sotelma telecel onatel
employe employee polyvalent polyvalente vendeur vendeuse serveur serveuse hotesse receptionniste commercial commerciale
intitule poste occupe recherche recherchee eleve etudiant etudiante classe stage
travail equipe communication motivation curiosite organisation gestion sens capacite adaptation logique autonomie rigueur
polyvalence ponctualite dynamique creativite leadership excel word powerpoint outlook photoshop illustrator wordpress
francais anglais espagnol allemand italien arabe bambara peulh
url instagram intagram linkedin facebook twitter site web portfolio github
`.split(/\s+/).filter(Boolean));
// Particules autorisées dans un nom composé
const PARTICLES = new Set(['ag', 'ould', 'ben', 'bint', 'el', 'al', 'ibn', 'mint']);

const WORD_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'’-]*$/;

function cleanLine(l) {
  return String(l || '')
    .replace(/^\s*(curriculum\s+vit(ae|æ)|c\.?\s?v\.?)\s*[:\-–—|]?\s*/i, '') // « CV OUMAR DIA » → « OUMAR DIA »
    .replace(/[|•·●▪►]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeName(line) {
  if (!line || /[@\d:/\\()[\]{}<>=+#*_]/.test(line)) return false;
  const words = line.split(' ');
  if (words.length < 2 || words.length > 5) return false;
  let real = 0;
  for (const w of words) {
    if (!WORD_RE.test(w)) return false;
    const n = strip(w).replace(/['’-]/g, '');
    if (PARTICLES.has(n)) continue;
    if (NOT_A_NAME.has(n)) return false;
    if (n.length < 2) return false;
    // un nom commence par une majuscule (les fautes d'OCR produisent souvent des minuscules isolées)
    if (w[0] !== w[0].toUpperCase()) return false;
    if (!/[aeiouy]/.test(n)) return false;
    real++;
  }
  const letters = words.join('').replace(/[^A-Za-zÀ-ÿ]/g, '').length;
  return real >= 2 && letters >= 5;
}

function fromLabels(lines) {
  let nom = null; let prenom = null; let full = null;
  for (const raw of lines) {
    const m = /^\s*(nom\s*(?:et|&)\s*pr[ée]noms?|pr[ée]noms?\s*(?:et|&)\s*noms?|noms?\s*complet|full\s*name|name|nom|pr[ée]noms?)\s*[:：\-–]\s*(.+)$/i.exec(raw);
    if (!m) continue;
    const label = strip(m[1]).replace(/\s+/g, ' ');
    // Une même ligne peut contenir « Nom : DIA   Prénom : Oumar »
    const value = m[2].split(/\s{2,}|\s(?=pr[ée]noms?\s*:)|\s(?=nom\s*:)/i)[0].trim();
    const rest = m[2].slice(value.length);
    const other = /pr[ée]noms?\s*[:：]\s*([^\n]+)/i.exec(rest) || /nom\s*[:：]\s*([^\n]+)/i.exec(rest);
    if (/et|&|complet|full/.test(label) || label === 'name') full = value;
    else if (label.startsWith('pr')) { prenom = value; if (other) nom = other[1].trim(); }
    else { nom = value; if (other) prenom = other[1].trim(); }
  }
  if (full) return cleanLine(full);
  if (prenom && nom) return cleanLine(`${prenom} ${nom}`);
  return null;
}

function fromFileName(fileName) {
  const base = String(fileName || '')
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_.]+/g, ' ')
    .replace(/\b(cv|curriculum|vitae|resume|final|version|v\d+|copie|copy|scan)\b/gi, ' ')
    .replace(/\d+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // nom de fichier en minuscules → majuscule initiale
  const titled = base === base.toLowerCase() ? base.replace(/(^|[\s'-])([a-zà-ÿ])/g, (m, a, b) => a + b.toUpperCase()) : base;
  return looksLikeName(titled) ? titled : null;
}

function extractIdentity(text, fileName) {
  const src = String(text || '');
  const emailMatch = src.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = src.match(/(?:\(?\+\s?\d{1,3}\)?[\s.-]?(?:\d[\s.-])?)?(?<!\d)\d{2}(?:[\s.-]?\d{2}){3,4}(?!\d)/);

  const lines = src.split('\n').map((l) => l.trim()).filter(Boolean);

  let name = fromLabels(lines);
  if (!name || !looksLikeName(name)) {
    name = null;
    // Les CV en colonnes placent souvent le nom au milieu du texte extrait :
    // on examine toutes les lignes et on privilégie celles proches des coordonnées.
    const contactIdx = lines
      .map((l, i) => (/@|(\+\s?\d{3})|(?:\d{2}[\s.]?){4}|nationalit|ne\(e\)|née? le|\b\d{2}\s*ans\b|c[ée]libataire|mari[ée]/i.test(l) ? i : -1))
      .filter((i) => i >= 0);
    const near = (i) => contactIdx.some((c) => Math.abs(c - i) <= 4);
    let best = null;
    const consider = (value, i) => {
      if (!looksLikeName(value)) return;
      const score = (near(i) ? 10 : 0) + (i < 3 ? 8 : 0) - i * 0.01;
      if (!best || score > best.score) best = { value, score };
    };
    lines.forEach((l, i) => {
      const c = cleanLine(l);
      consider(c, i);
      // Prénom et NOM sur deux lignes (« Prénom » / « NOM »)
      const next = cleanLine(lines[i + 1] || '');
      if (c && next && !c.includes(' ') && !next.includes(' ')) consider(`${c} ${next}`, i);
    });
    name = best ? best.value : null;
  }
  if (!name) name = fromFileName(fileName);
  // Dernier recours : nom de fichier tel quel, marqué comme non identifié
  const identified = !!name;
  if (!name) name = `Candidat — ${String(fileName || '').replace(/\.[^/.]+$/, '')}`;

  return {
    name: name.slice(0, 120),
    nameIdentified: identified,
    email: emailMatch ? emailMatch[0] : null,
    phone: phoneMatch ? phoneMatch[0].trim() : null
  };
}

module.exports = { extractIdentity, looksLikeName };
