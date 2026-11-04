/**
 * MOTEUR DE PRÉSÉLECTION DOCUMENTAIRE DES CANDIDATURES
 * ------------------------------------------------------------------
 * Étape 1 du processus (§11 « Vérification de recevabilité et présélection ») :
 *   1. Recevabilité    : conditions générales §7 + règles d'élimination §14
 *   2. Grille uniforme : diplôme, expérience, compétences techniques,
 *                        langues (§12). Les compétences comportementales relèvent
 *                        de l'entretien physique : elles ne sont pas notées ici.
 *   3. Seuils §14      : ≥ 70 présélectionné · 60–69,99 liste de réserve · < 60 non retenu
 *   4. Classement §17  : par poste, départage des ex æquo
 *
 * Le moteur est déterministe et explicable : chaque point attribué est
 * justifié par un extrait (« preuve ») du CV, pour la traçabilité exigée
 * par les TdR (§9.3, §10).
 */
const {
  LANGUES, NATIONALITES, REGLES_PAR_DEFAUT, SEUILS_PAR_DEFAUT, SOUS_COMMISSIONS, labelNiveau
} = require('../data/referentiel');

const ENGINE_VERSION = 'preselection-v2';

const DECISIONS = {
  PRESELECTIONNE: 'Présélectionné',
  RESERVE: 'Liste de réserve',
  NON_RETENU: 'Non retenu',
  NON_RECEVABLE: 'Non recevable'
};

// =====================================================================
// 1. NORMALISATION
// =====================================================================
/** minuscules, sans accents, tirets unifiés — conserve - / . pour les dates */
function normalize(text) {
  return String(text || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’`´]/g, "'")
    .replace(/[–—−‐]/g, '-')
    .replace(/\r/g, '')
    .replace(/[ \t ]+/g, ' ');
}

/** version « mots » : ponctuation → espaces (pour la recherche de mots-clés) */
function toWords(normText) {
  return normText.replace(/['’\-_/,;:()[\]{}"«»•·●▪►✓*|]/g, ' ').replace(/[ \t]+/g, ' ');
}

// =====================================================================
// 1 bis. FAUX AMIS : expressions courantes qui contiennent un mot-clé technique sans rapport
// avec le métier (« montage de business plans », « Banque africaine de développement »,
// « sauvegarde des intérêts »…). Elles sont neutralisées avant la recherche des compétences
// et de l'expérience liée au poste, pour éviter qu'un profil hors métier soit noté sur ces mots.
// =====================================================================
const S = "[\\s'\\-]+"; // séparateur souple (espaces, apostrophes, tirets)
const P = (src) => new RegExp(src.replace(/ /g, S), 'g');
const FAUX_AMIS = [
  // montage financier / de projets / de dossiers ≠ montage vidéo
  P("montages? (?:et (?:a )?l'?instruction )?(?:(?:de|des|du|d'?) ?(?:l'? ?)?)?(?:business|busisness|projets?|dossiers?|financiers?|financements?|plans?|budgets?|dao|programmes?|partenariats?|credits?|operations?|requetes?|demandes?|propositions?|offres?|marches?|contentieux|fonds|prets?|garanties?|subventions?|entreprises?|societes?|structures?|juridiques?|institutionnels?)"),
  // développement économique, rural, des PME, Banque/Agence … de développement ≠ développement logiciel
  P("developpements? (?:rural|ruraux|durable|economique|local|social|communautaire|international|agricole|humain|personnel|organisationnel|institutionnel|commercial|territorial|des pme|des pmi|des entreprises|des competences|des capacites|des cultures|de l'? ?education|de l'? ?entreprise|du secteur|des affaires|des relations|des partenariats|des ressources|des exportations|des activites|des marches|de la petite enfance)"),
  P("(?:pour le|du|au|de|d'?) ?developpement(?! (?:logiciel|logiciels|web|informatique|d'? ?applications?|applicatif|mobile|de logiciels?|de sites?|front|back|full|d'? ?outils? informatiques?|de bases? de donnees))"),
  // sauvegarde des intérêts / du patrimoine ≠ sauvegarde informatique
  P("sauvegardes? (?:des|du|de la|de l'?) ?(?:interets?|patrimoine|environnement|droits?|emplois?|biodiversite|paix|acquis|valeurs?|ressources|forets?)"),
  // assistance technique de coopération ≠ support informatique
  P("(?:conventions?|missions?|contrats?|bureaux?|projets?|programmes?|cellules?|unites?|charge|chargee|experts?) (?:en |de l'? ?|d'? ?|d )?assistance technique"),
  P("assistance technique aupres"),
  // programmation financière / budgétaire ≠ programmation informatique
  P("(?:documents? de )?programmations? (?:financieres?|budgetaires?|des depenses|des activites|des investissements|pluriannuelles?|triennales?|annuelles?|des marches|des credits|operationnelles?)"),
  // supports de communication / de cours ≠ support informatique
  P("supports? (?:de|du|des|d'?) ?(?:communication|cours|formation|presentation|sensibilisation|visibilite|marketing|plaidoyer|vulgarisation)"),
  P("supports? pedagogiques?"),
  // réseau commercial / de distribution / d'agences ≠ réseau informatique
  P("reseaux? (?:commercial|commerciaux|de distribution|d'? ?agences?|bancaire|de partenaires|associatif|de vente|de clients?|d'? ?entreprises?|de femmes|de jeunes|des femmes|des jeunes)"),
  // serveur de restaurant ≠ serveur vidéo
  P("serveu(?:r|se)s? (?:en|de|dans un|dans une) (?:restauration|restaurant|bar|hotel|hotellerie|cafe)")
];
function neutralize(normText) {
  let t = normText;
  // Passage en MAJUSCULES : l'extrait reste lisible dans la fiche, mais les mots-clés (recherchés en
  // minuscules) ne s'y appliquent plus.
  for (const re of FAUX_AMIS) { re.lastIndex = 0; t = t.replace(re, (m) => m.toUpperCase()); }
  return t;
}

const normKeyword = (kw) => toWords(normalize(kw)).trim();
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const kwCache = new Map();
/** Regex mot entier, tolère le pluriel (s/x/es). */
function keywordRegex(kw) {
  const k = normKeyword(kw);
  if (!kwCache.has(k)) {
    const body = escapeRe(k).replace(/ /g, '\\s+');
    kwCache.set(k, new RegExp(`(?<![a-z0-9])${body}(?:s|x|es)?(?![a-z0-9])`, 'm'));
  }
  return kwCache.get(k);
}

/** Retourne le 1er mot-clé trouvé + un extrait de contexte */
function findKeyword(wordsText, keywords) {
  for (const kw of keywords || []) {
    if (!kw || !String(kw).trim()) continue;
    const m = keywordRegex(kw).exec(wordsText);
    if (m) {
      // extrait = la ligne du CV contenant le mot-clé (bornée à ~120 caractères)
      const ls = wordsText.lastIndexOf('\n', m.index) + 1;
      let le = wordsText.indexOf('\n', m.index);
      if (le === -1) le = wordsText.length;
      const start = Math.max(ls, m.index - 60);
      const end = Math.min(le, m.index + m[0].length + 60);
      return { keyword: kw, extrait: wordsText.slice(start, end).replace(/\s+/g, ' ').trim() };
    }
  }
  return null;
}

// =====================================================================
// 2. DÉCOUPAGE EN SECTIONS
// =====================================================================
const HEADINGS = [
  ['experience', /^((resume|synthese|recapitulatif|resume de carriere)\s+(de\s+l\s+|des\s+)?(experiences?|carriere|parcours)(\s+professionnelles?)?|fonctions?\s+(occupees|exercees|anterieures)|postes?\s+(occupes|anterieurs)|((projets?|parcours|stages?|emplois?)\s+(et\s+)?)?experiences?(\s+(professionnelles?|et\s+projets?|projets?))?|parcours professionnel|emplois?( occupes)?|carriere|historique professionnel|work experience|professional experience|postes occupes)\b/],
  ['formation', /^(formations?( academiques?| et diplomes| universitaires?)?|diplomes?( obtenus)?|etudes( et diplomes)?|cursus( scolaire| universitaire| academique)?|parcours (academique|scolaire|universitaire)|education|titres et diplomes)\b/],
  ['langues', /^(langues?( parlees| etrangeres)?|competences linguistiques|languages)\b/],
  ['autre', /^(competences|aptitudes|centres? d interets?|loisirs|references|informations personnelles|etat civil|qualites|certifications|projets|publications|divers|atouts|savoir|profil|objectifs?|connaissances|logiciels|outils|stages?|seminaires|activites)\b/]
];

function splitSections(normText) {
  const sections = { entete: [], experience: [], formation: [], langues: [], autre: [] };
  let current = 'entete';
  for (const rawLine of normText.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const head = toWords(line).trim();
    if (head.length <= 55 && !/\d/.test(head)) {
      const found = HEADINGS.find(([, re]) => {
        const m = re.exec(head);
        // un titre de section est court : peu de texte après le mot-clé
        return m && head.length - m[0].length <= 25;
      });
      if (found) { current = found[0]; continue; }
    }
    sections[current].push(line);
  }
  return Object.fromEntries(Object.entries(sections).map(([k, v]) => [k, v.join('\n')]));
}

// =====================================================================
// 3. NIVEAU D'ÉTUDES
// =====================================================================
const DEGREE_PATTERNS = [
  { rank: 8, label: 'Doctorat', re: /(?<![a-z])(doctorat|ph\s?d|these de doctorat)(?![a-z])/ },
  // « maîtrise » seul est ambigu (« maîtrise des outils… ») : retenu si « maîtrise en/ès … » ou dans la section Formation
  { rank: 4, label: 'Bac+4 (Maîtrise / Master 1)', re: /(?<![a-z])(maitrise\s+(en|es)(?![a-z])|master\s?(1|i)(?![0-9i])|m1(?![0-9])|bac\s*\+\s*4)/ },
  { rank: 4, label: 'Bac+4 (Maîtrise)', re: /(?<![a-z])maitrise(?!\s+(des|du|de la|de l|d un|d une|de son|de ses|parfaite|courante))(?![a-z])/, formationOnly: true },
  { rank: 5, label: 'Bac+5 (Master / DESS / DEA)', re: /(?<![a-z])(diplome d etudes superieures specialisees|diplome d etudes approfondies|master(?!\s?(1|i)(?![0-9i]))(?!\s?class)|mastere(?![a-z])|dess(?![a-z])|dea(?![a-z])|m2(?![0-9])|bac\s*\+\s*5|diplome d ingenieur|ingenieur de conception)/ },
  { rank: 5, label: 'Bac+5 (Ingénieur)', re: /(?<![a-z])ingenieur(?![a-z])/, formationOnly: true },
  { rank: 3, label: 'Bac+3 (Licence)', re: /(?<![a-z])(licence|bachelor|bac\s*\+\s*3|l3(?![0-9]))/ },
  { rank: 2, label: 'Bac+2 (BTS / DUT / DEUG)', re: /(?<![a-z])(bts|dut|deug|duel|bac\s*\+\s*2|technicien superieur|diplome universitaire de technologie|brevet de technicien superieur)(?![a-z])/ },
  { rank: 0, label: 'BT / Baccalauréat', re: /(?<![a-z])(baccalaureat|bac(?!\s*\+)|bt|brevet de technicien|bac pro)(?![a-z])/ },
  { rank: -1, label: 'CAP / BEP', re: /(?<![a-z])(cap|bep|certificat d aptitude professionnelle)(?![a-z])/ }
];
const INCOMPLETE_RE = /(en cours|inacheve|non obtenu|niveau |prepa|preparation|candidat au)/;

function detectEducation(sections, fullWords) {
  const scan = (text, allowFormationOnly) => {
    let best = null;
    for (const line of text.split('\n')) {
      const w = toWords(line);
      for (const p of DEGREE_PATTERNS) {
        if (p.formationOnly && !allowFormationOnly) continue;
        if (!p.re.test(w)) continue;
        const incomplete = INCOMPLETE_RE.test(w);
        const rank = incomplete ? p.rank - 1 : p.rank;
        if (!best || rank > best.rank) {
          best = { rank, label: p.label, incomplete, extrait: line.trim().slice(0, 140) };
        }
      }
    }
    return best;
  };
  const inFormation = sections.formation ? scan(sections.formation, true) : null;
  const inFull = scan(fullWords, false);
  if (inFormation && (!inFull || inFormation.rank >= inFull.rank)) return { ...inFormation, zone: 'formation' };
  if (inFull) return { ...inFull, zone: 'cv' };
  return null;
}

// =====================================================================
// 4. EXPÉRIENCE PROFESSIONNELLE (périodes fusionnées, sans double comptage)
// =====================================================================
const MONTHS = {
  janvier: 1, janv: 1, jan: 1, january: 1, fevrier: 2, fevr: 2, fev: 2, february: 2, feb: 2,
  mars: 3, march: 3, mar: 3, avril: 4, avr: 4, april: 4, apr: 4, mai: 5, may: 5,
  juin: 6, june: 6, jun: 6, juillet: 7, juil: 7, july: 7, jul: 7, aout: 8, august: 8, aug: 8,
  septembre: 9, september: 9, sept: 9, sep: 9, octobre: 10, october: 10, oct: 10,
  novembre: 11, november: 11, nov: 11, decembre: 12, december: 12, dec: 12
};
const MONTH_ALT = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');
const DATE = `(?:(?:(${MONTH_ALT})\\.?\\s+)|(?:(?<!\\d)(\\d{1,2})\\s*[/.-]\\s*))?(?<!\\d)((?:19|20)\\d{2})(?!\\d)`;
const PRESENT = "(present|aujourd'?\\s?hui|a ce jour|ce jour|actuellement|actuel|en cours|maintenant|now|current|today|a nos jours)";
const SEP = "\\s*(?:-|~|>|→|»|\\ba\\b|\\bau\\b|\\bto\\b|jusqu'?\\s?a(?:u)?)\\s*";
const RANGE_RE = new RegExp(`${DATE}${SEP}(?:${DATE}|${PRESENT})`, 'g');
const SINCE_RE = new RegExp(`depuis\\s+(?:le\\s+|l'annee\\s+)?${DATE}`, 'g');

// Mots indiquant une formation / un diplôme
const EDU_RE = /(?<![a-z])(licence|master|mastere|maitrise|doctorat|bac|baccalaureat|bts|dut|deug|diplome|diplomee?|certificat|certification|attestation de formation|universite|faculte|ecole|lycee|college|institut|etudiant|etudiante|cursus|classe de|formation|mba)(?![a-z])/;
// Mots indiquant un emploi / un stage
const JOB_RE = /(?<![a-z])(chez|stage|stagiaire|freelance|free lance|independant|consultant|consultante|assistant|assistante|responsable|developpeur|developpeuse|technicien|technicienne|charge|chargee|agent|directeur|directrice|chef|gestionnaire|comptable|journaliste|animateur|animatrice|presentateur|presentatrice|operateur|operatrice|monteur|monteuse|cameraman|cadreur|realisateur|realisatrice|secretaire|chauffeur|commercial|commerciale|vendeur|vendeuse|serveur|serveuse|hotesse|receptionniste|employe|employee|ingenieur|administrateur|administratrice|coordinateur|coordinatrice|superviseur|manager|enseignant|enseignante|professeur|formateur|formatrice|auditeur|auditrice|juriste|conseiller|conseillere|infographe|graphiste|designer|designeur|informaticien|archiviste|maquilleuse|electricien|mecanicien|magasinier|caissier|caissiere|reporter|redacteur|redactrice|benevole|volontaire|cdi|cdd|poste|missions?|mission|gerant|gerante|expert|experte|analyste|economiste|inspecteur|inspectrice|controleur|controleuse|attache|adjoint|adjointe|fondateur|fondatrice|associe|associee|charge de cours|officier|cadre|tresorier|tresoriere|intendant|logisticien|logisticienne|acheteur|acheteuse|planificateur|auditeur|webmaster|technicien|photographe|traducteur|traductrice|interprete)s?(?![a-z])/;
const STRONG_JOB_RE = /(?<![a-z])(chez|stage|stagiaire|freelance|cdi|cdd|employe|employee|benevole)(?![a-z])/;
const STAGE_RE = /(?<![a-z])(stage|stagiaire|internship|intern)(?![a-z])/;
const BIRTH_RE = /(?<![a-z])(nee?\s+(le|en|a)|naissance|date de naissance)(?![a-z])/;
const TASKS_RE = /^(missions?|taches|realisations|activites|responsabilites|principales? (taches|missions|attributions|activites|responsabilites)|attributions)/;
// Séminaires, ateliers, sessions de formation suivies : ce ne sont pas des emplois
const SEMINAR_RE = /(?<![a-z])(seminaires?|ateliers?|colloques?|webinaires?|conferences?|session de formation|sessions de formation|formation sur|formations sur|participation (a|au|aux) (la |l )?(seminaire|atelier|session|formation|colloque|conference|clinique|journee|forum)|clinique fiduciaire)(?![a-z])/;

const monthOf = (name, num) => {
  if (name) return MONTHS[name];
  const n = Number(num);
  return n >= 1 && n <= 12 ? n : null;
};

function mergeIntervals(list) {
  const sorted = list.map((i) => [i.start, i.end]).sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [s, e] of sorted) {
    if (merged.length && s <= merged[merged.length - 1][1]) {
      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], e);
    } else merged.push([s, e]);
  }
  return merged.reduce((acc, [s, e]) => acc + (e - s), 0);
}

/** Étiquette chaque ligne du CV avec sa section (experience, formation, …) */
function labelLines(normText) {
  const out = [];
  let current = 'entete';
  for (const rawLine of normText.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const head = toWords(line).trim();
    let heading = false;
    if (head.length <= 55 && !/\d/.test(head)) {
      const found = HEADINGS.find(([, re]) => {
        const m = re.exec(head);
        return m && head.length - m[0].length <= 25;
      });
      if (found) { current = found[0]; heading = true; }
    }
    out.push({ line, words: head, section: current, heading });
  }
  return out;
}

const MONTH_RANGE_RE = new RegExp(`(${MONTH_ALT})\\.?${SEP}(${MONTH_ALT})\\.?\\s+((?:19|20)\\d{2})`, 'g');
const SINGLE_RE = new RegExp(DATE, 'g');

/**
 * Expérience professionnelle = toutes les périodes datées d'EMPLOIS et de STAGES mentionnées
 * (années seules « 2023 : … », mois/année, intervalles « 2019 – 2022 », « depuis 2020 », « … à aujourd'hui »).
 * Les périodes de formation sont écartées ; les périodes qui se chevauchent ne sont comptées qu'une fois.
 */
function detectExperience(normText, sections, relevanceKeywords, now = new Date()) {
  const nowIdx = now.getFullYear() * 12 + now.getMonth() + 1;
  const L = labelLines(normText);
  const hasYear = (l) => /(?<!\d)(?:19|20)\d{2}(?!\d)/.test(l || '');
  const periodes = [];
  let approx = false;

  for (let i = 0; i < L.length; i++) {
    const { line, words, section, heading } = L[i];
    if (heading || !hasYear(line)) continue;
    const nline = line.toLowerCase();

    // 1. Repérage des dates de la ligne
    const found = [];
    const covered = [];
    const take = (re, fn) => {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(nline)) !== null) {
        if (covered.some(([a, b]) => m.index < b && m.index + m[0].length > a)) continue;
        covered.push([m.index, m.index + m[0].length]);
        const r = fn(m);
        if (r) found.push({ ...r, pos: m.index });
      }
    };
    take(RANGE_RE, (m) => {
      const sm = monthOf(m[1], m[2]);
      const yearsOnly = !sm && !m[7] && !monthOf(m[4], m[5]);
      const start = Number(m[3]) * 12 + (sm ? sm - 1 : 0);
      let end;
      if (m[7]) end = nowIdx;
      else {
        const ey = Number(m[6]);
        const em = monthOf(m[4], m[5]);
        end = em ? ey * 12 + em : ey * 12 + (sm ? 12 : 0);
        if (!em && !sm && ey === Number(m[3])) end = start + 12;
        if (!em && !sm) approx = true;
      }
      return { start, end, libelle: yearsOnly ? `${m[3]} → ${m[6]}` : null };
    });
    take(MONTH_RANGE_RE, (m) => {
      const y = Number(m[3]);
      const sm = MONTHS[m[1]]; const em = MONTHS[m[2]];
      return { start: (sm > em ? y - 1 : y) * 12 + sm - 1, end: y * 12 + em };
    });
    SINCE_RE.lastIndex = 0;
    take(SINCE_RE, (m) => {
      const sm = monthOf(m[1], m[2]);
      return { start: Number(m[3]) * 12 + (sm ? sm - 1 : 0), end: nowIdx };
    });
    // Date isolée (« 2023 : … », « Juin 2021 ») : seulement en début de ligne ou sur une ligne courte
    take(SINGLE_RE, (m) => {
      if (m.index > 30 && nline.length > 70) return null;
      const sm = monthOf(m[1], m[2]);
      const y = Number(m[3]);
      if (sm) return { start: y * 12 + sm - 1, end: y * 12 + sm };
      approx = true;
      return { start: y * 12, end: (y + 1) * 12, anneeSeule: true, libelle: `${y} (année)` };
    });
    if (!found.length) continue;

    // 2. Bloc de contexte : intitulé (ligne précédente non datée) + ligne + description
    const prev = i > 0 && !L[i - 1].heading && !hasYear(L[i - 1].line) && L[i - 1].line.length <= 90 ? L[i - 1] : null;
    const desc = [];
    for (let k = i + 1; k <= i + 4 && k < L.length && !L[k].heading && !hasYear(L[k].line); k++) desc.push(L[k]);
    const own = `${prev ? prev.words : ''} ${words}`;
    const firstDesc = desc[0]?.words || '';
    const context = [own, ...desc.map((d) => d.words)].join(' ');

    // 3. Emploi/stage ou formation ?
    if (BIRTH_RE.test(words)) continue; // date de naissance
    const stage = STAGE_RE.test(own) || STAGE_RE.test(firstDesc);
    const strongJob = STRONG_JOB_RE.test(own) || TASKS_RE.test(firstDesc);
    const isEdu = EDU_RE.test(own);
    // Intitulé du poste sur la ligne suivante (« Juin 2021 – Août 2023 : Projet X » puis « Responsable administratif… »)
    const titleNext = JOB_RE.test(firstDesc) && !EDU_RE.test(firstDesc) && !SEMINAR_RE.test(firstDesc);
    const isJob = JOB_RE.test(own) || TASKS_RE.test(firstDesc) || titleNext;
    const seminar = (SEMINAR_RE.test(own) || SEMINAR_RE.test(firstDesc)) && !STAGE_RE.test(own);
    let job;
    if (seminar) job = false; // séminaire / atelier / formation suivie
    else if (isEdu && !strongJob && !(section === 'experience' && (titleNext || TASKS_RE.test(firstDesc)))) job = false;
    else if (isJob || stage) job = true;
    else if (section === 'formation' || section === 'langues') job = false;
    else if (section === 'experience') job = !(EDU_RE.test(context) && !JOB_RE.test(context)); // projet scolaire ≠ emploi
    else job = desc.length > 0 && !EDU_RE.test(context);
    if (!job) continue;

    const pertinent = !!findKeyword(context, relevanceKeywords);
    for (const f of found) {
      const end = Math.min(f.end, nowIdx);
      const start = f.start;
      if (start < 1970 * 12 || start >= nowIdx || end <= start || end - start > 45 * 12) continue;
      periodes.push({ start, end, mois: end - start, stage, pertinent, anneeSeule: !!f.anneeSeule, libelle: f.libelle || null, extrait: line.slice(0, 120) });
    }
  }

  const totalMois = mergeIntervals(periodes);
  const pertinentMois = mergeIntervals(periodes.filter((p) => p.pertinent));
  const stagesMois = mergeIntervals(periodes.filter((p) => p.stage));

  // Expérience déclarée (« 10 ans d'expérience ») — utilisée seulement en secours
  const words = toWords(normText);
  const claim = /(\d{1,2})\s*\+?\s*(?:annees?|ans)\s+d\s*experiences?/.exec(words);
  const declaratif = claim ? Number(claim[1]) : null;

  let annees = Math.round((totalMois / 12) * 10) / 10;
  let source = 'periodes';
  if (annees === 0 && declaratif) { annees = declaratif; source = 'declaratif'; }

  return {
    annees,
    anneesPertinentes: Math.round((pertinentMois / 12) * 10) / 10,
    stagesMois,
    declaratif,
    source,
    approximatif: approx && periodes.some((p) => p.anneeSeule),
    periodes: periodes.slice(0, 20).map((p) => ({
      debut: `${String((p.start % 12) + 1).padStart(2, '0')}/${Math.floor(p.start / 12)}`,
      fin: p.end >= nowIdx ? 'en cours' : `${String(((p.end - 1) % 12) + 1).padStart(2, '0')}/${Math.floor((p.end - 1) / 12)}`,
      mois: p.mois, stage: p.stage, pertinent: p.pertinent, anneeSeule: p.anneeSeule, libelle: p.libelle, extrait: p.extrait
    }))
  };
}

// =====================================================================
// 5. ÉTAT CIVIL : ÂGE ET NATIONALITÉ (§7)
// =====================================================================
function detectAge(normText, now = new Date()) {
  const full = new RegExp(`(?:ne(?:e)?\\s+le|date\\s+(?:et\\s+lieu\\s+)?de\\s+naissance\\s*:?)\\s*(\\d{1,2})\\s*(?:[/.-]|\\s)\\s*(\\d{1,2}|${MONTH_ALT})\\s*(?:[/.-]|\\s)\\s*((?:19|20)\\d{2})`);
  const m = full.exec(normText);
  if (m) {
    const month = isNaN(Number(m[2])) ? MONTHS[m[2]] : Number(m[2]);
    const birth = new Date(Number(m[3]), (month || 1) - 1, Number(m[1]));
    let age = now.getFullYear() - birth.getFullYear();
    if (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate())) age--;
    return { age, extrait: m[0] };
  }
  const y = /(?:ne(?:e)?\s+(?:le\s+|en\s+)?|date de naissance\s*:?\s*)(?:\d{1,2}\s*[/.-]\s*)?(?:\d{1,2}\s*[/.-]\s*)?((?:19|20)\d{2})/.exec(normText);
  if (y) return { age: now.getFullYear() - Number(y[1]), extrait: y[0], approx: true };
  const a = /(?<![a-z])age\s*:?\s*(\d{2})\s*ans/.exec(normText);
  if (a) return { age: Number(a[1]), extrait: a[0] };
  return null;
}

function detectNationality(wordsText, nationalites = NATIONALITES) {
  const m = /nationalite\s+([a-z ]{3,60})/.exec(wordsText);
  if (!m) return null;
  const segment = m[1];
  for (const [pays, mots] of Object.entries(nationalites || NATIONALITES)) {
    if (mots.some((w) => keywordRegex(w).test(segment))) return { pays, extrait: `nationalite ${segment}`.trim().slice(0, 60) };
  }
  const word = segment.trim().split(' ')[0];
  return { pays: null, autre: word, extrait: `nationalite ${word}` };
}

// =====================================================================
// 6. LANGUES
// =====================================================================
const FRENCH_MARKERS = /(?<![a-z])(et|les|des|du|de|la|le|une|pour|dans|avec|sur|en)(?![a-z])/g;

function detectLanguages(sections, fullWords, required, langues = LANGUES) {
  const L = langues && Object.keys(langues).length ? langues : LANGUES;
  const zone = toWords(sections.langues || '') + '\n' + fullWords;
  const nbWords = fullWords.split(/\s+/).filter(Boolean).length;
  const nbMarkers = (fullWords.match(FRENCH_MARKERS) || []).length;
  const frenchText = nbMarkers >= 4 && nbMarkers >= nbWords * 0.04;
  const codes = Array.from(new Set([...(required || []), ...Object.keys(L)]));
  return codes.map((code) => {
    const def = L[code] || LANGUES[code] || { label: code, synonymes: [code] };
    const hit = findKeyword(zone, def.synonymes);
    const implicite = !hit && code === 'francais' && frenchText;
    return {
      code, label: def.label,
      requise: (required || []).includes(code),
      trouvee: !!hit || implicite,
      implicite,
      preuve: hit ? hit.extrait : implicite ? 'CV rédigé en français' : null
    };
  }).filter((l) => l.requise || l.trouvee);
}

// =====================================================================
// 7. COMPÉTENCES (techniques / comportementales)
// =====================================================================
function evaluateCompetences(fullWords, list) {
  const items = (list || []).map((comp) => {
    const hit = findKeyword(fullWords, comp.keywords);
    return {
      label: comp.label, obligatoire: !!comp.obligatoire, poids: Number(comp.poids) || 1,
      trouve: !!hit, motCle: hit?.keyword || null, preuve: hit?.extrait || null
    };
  });
  const total = items.reduce((a, i) => a + i.poids, 0);
  const got = items.filter((i) => i.trouve).reduce((a, i) => a + i.poids, 0);
  return { items, score: total > 0 ? Math.round((got / total) * 100) : 100, trouvees: items.filter((i) => i.trouve).length, total: items.length };
}

// =====================================================================
// 8. ÉVALUATION COMPLÈTE D'UN DOSSIER
// =====================================================================
const CRITERES_NOTES = ['diplome', 'experience', 'techniques', 'langues'];
const PONDERATIONS_DEFAUT = { diplome: 25, experience: 35, techniques: 35, langues: 5 };

function resolveConfig(job, sousCommissions = SOUS_COMMISSIONS) {
  const sc = (sousCommissions || SOUS_COMMISSIONS).find((s) => s.code === job?.sous_commission)
    || SOUS_COMMISSIONS.find((s) => s.code === job?.sous_commission);
  const regles = {};
  for (const [k, def] of Object.entries(REGLES_PAR_DEFAUT)) regles[k] = { ...def, ...((job?.regles_elimination || {})[k] || {}) };
  const raw = { ...(sc?.ponderations || PONDERATIONS_DEFAUT), ...(job?.ponderations || {}) };
  // Seuls les critères documentaires sont pondérés (les compétences comportementales sont exclues)
  const ponderations = Object.fromEntries(CRITERES_NOTES.map((k) => [k, Number(raw[k] || 0)]));
  const seuils = { ...SEUILS_PAR_DEFAUT, ...(job?.seuils || {}) };
  return { regles, ponderations, seuils, sousCommission: sc };
}

function evaluateCandidate(rawText, job, ctx = {}) {
  const now = ctx.now || new Date();
  // Faux amis neutralisés (« montage de business plans », « Banque africaine de développement »…)
  const norm = neutralize(normalize(rawText));
  const words = toWords(norm);
  const sections = splitSections(norm);
  const { regles, ponderations, seuils, sousCommission } = resolveConfig(job, ctx.sousCommissions);

  const eliminations = [];
  const verifications = [];
  const strengths = [];
  const weaknesses = [];
  const flag = (regle, motif) => {
    const r = regles[regle];
    if (!r || !r.actif) return;
    if (r.mode === 'eliminer') eliminations.push({ regle, motif });
    else verifications.push({ regle, motif });
  };

  const techniques = job?.competences_techniques || [];
  // Expérience « liée au poste » : domaines d'expérience de la fiche + mots-clés des compétences obligatoires
  // (les compétences secondaires, trop génériques — Excel, organisation… — ne suffisent pas)
  const relevance = [
    ...(job?.experience_domaines || []),
    ...techniques.filter((t) => t.obligatoire).flatMap((t) => t.keywords || [])
  ];

  // --- Lisibilité ---
  const nbChars = norm.replace(/\s/g, '').length;
  if (nbChars < (regles.cv_illisible.valeur || 300)) {
    flag('cv_illisible', `Texte extrait insuffisant (${nbChars} caractères) : CV scanné ou illisible, contrôle manuel requis.`);
  }

  // --- CV lu par OCR (photo / PDF scanné) ---
  if (ctx.ocr) {
    verifications.push({
      regle: 'ocr',
      motif: `CV lu par reconnaissance de texte (${ctx.ocr.type === 'photo' ? 'photo' : 'PDF scanné'}, confiance ${ctx.ocr.confiance ?? '?'} %) : vérifier le nom, les dates et les diplômes sur le document original.`
    });
  }

  // --- Nationalité (§7) ---
  const eligibles = job?.nationalites_eligibles?.length ? job.nationalites_eligibles : ['Mali', 'Burkina Faso', 'Niger'];
  const nat = detectNationality(words, ctx.nationalites);
  if (ctx.country && !eligibles.includes(ctx.country)) {
    flag('nationalite', `Pays déclaré (${ctx.country}) non éligible pour ce poste (réservé à : ${eligibles.join(', ')}).`);
  } else if (nat && nat.pays && !eligibles.includes(nat.pays)) {
    flag('nationalite', `Nationalité détectée (${nat.pays}) non éligible pour ce poste (réservé à : ${eligibles.join(', ')}).`);
  } else if (nat && !nat.pays) {
    verifications.push({ regle: 'nationalite', motif: `Nationalité mentionnée (« ${nat.autre} ») hors pays éligibles : à vérifier sur pièces.` });
  } else if (nat && ctx.country && nat.pays !== ctx.country) {
    verifications.push({ regle: 'nationalite', motif: `Pays déclaré (${ctx.country}) différent de la nationalité du CV (${nat.pays}).` });
  }

  // --- Âge (§7) ---
  const age = detectAge(norm, now);
  const ageMin = Number(regles.age_minimum.valeur) || 18;
  if (age && age.age < ageMin && age.age > 5) flag('age_minimum', `Âge détecté (${age.age} ans) inférieur au minimum requis (${ageMin} ans).`);

  // --- Diplôme ---
  const requiredRank = Number(job?.min_education_rank ?? 3);
  const edu = detectEducation(sections, words);
  const domaines = job?.diplome_domaines || [];
  // Domaine du diplôme : recherché sur la ligne du diplôme retenu, puis sur les autres lignes de formation
  // (diplômes, certificats). Un mot du domaine présent ailleurs (ex. « agence de communication » dans
  // une expérience) ne prouve pas la formation.
  // Lignes de formation = section Formation, ou ligne portant un diplôme. Le nom d'un employeur
  // (« École supérieure des télécommunications », « Institut… ») dans les expériences ne compte pas.
  const eduLines = labelLines(norm)
    .filter((l) => !l.heading && (l.section === 'formation' || DEGREE_PATTERNS.some((d) => !d.formationOnly && d.re.test(l.words))))
    .map((l) => l.words).join('\n');
  const domainDegree = edu?.extrait ? findKeyword(toWords(normalize(edu.extrait)), domaines) : null;
  const domainEdu = domainDegree || findKeyword(eduLines, domaines);
  const domainAny = domainEdu || findKeyword(words, domaines);
  let levelScore;
  if (!edu) {
    levelScore = requiredRank <= -1 ? 80 : 40;
    if (requiredRank > -1) verifications.push({ regle: 'diplome', motif: `Aucun diplôme identifiable dans le CV (requis : ${labelNiveau(requiredRank)}) — vérifier les pièces.` });
  } else if (edu.rank >= requiredRank) {
    levelScore = 100;
    strengths.push(`Diplôme conforme : ${edu.label}${edu.incomplete ? ' (mention « en cours/niveau »)' : ''} — requis : ${labelNiveau(requiredRank)}.`);
  } else {
    levelScore = edu.rank === requiredRank - 1 ? 50 : 20;
    const motif = `Diplôme détecté (${edu.label}) inférieur au minimum requis (${labelNiveau(requiredRank)}).`;
    weaknesses.push(motif);
    flag('diplome', motif);
  }
  const domainScore = domaines.length === 0 ? 100 : domainDegree ? 100 : domainEdu ? 80 : domainAny ? 20 : 0;
  if (domaines.length && !domainEdu) weaknesses.push(`Formation hors du domaine attendu (${domaines.slice(0, 5).join(', ')}).`);
  const diplomeScore = Math.round(levelScore * 0.7 + domainScore * 0.3);

  // --- Expérience ---
  const exp = detectExperience(norm, sections, relevance, now);
  const minExp = Number(job?.min_experience_years || 0);
  const maxExp = job?.max_experience_years ? Number(job.max_experience_years) : null;
  // L'expérience dans le domaine du poste pèse davantage que l'expérience totale
  let yearsScore;
  if (minExp > 0) {
    yearsScore = exp.annees >= minExp ? 100 : Math.round((exp.annees / minExp) * 80);
  } else {
    yearsScore = Math.min(100, 50 + exp.annees * 15);
  }
  const relevanceScore = minExp > 0
    ? Math.min(100, Math.round((exp.anneesPertinentes / minExp) * 100))
    : Math.min(100, Math.round(40 + exp.anneesPertinentes * 60)); // 1 an lié au poste = 100
  const experienceScore = Math.round(yearsScore * 0.35 + relevanceScore * 0.65);

  if (minExp > 0) {
    if (exp.annees === 0) {
      verifications.push({ regle: 'experience', motif: `Aucune période d'expérience datée n'a pu être extraite (requis : ${minExp} an(s)).` });
    } else if (exp.annees >= minExp) {
      strengths.push(`Expérience : ${exp.annees} an(s) détecté(s), dont ${exp.anneesPertinentes} an(s) dans le domaine (requis : ${minExp}${maxExp ? ` à ${maxExp}` : ''} ans).`);
    } else {
      const tol = Number(regles.experience.tolerance ?? 1);
      const motif = `Expérience insuffisante : ${exp.annees} an(s) détecté(s) pour ${minExp} requis.`;
      weaknesses.push(motif);
      if (exp.annees < minExp - tol) flag('experience', motif);
      else verifications.push({ regle: 'experience', motif: `${motif} Écart dans la tolérance (${tol} an) : à vérifier sur attestations.` });
    }
  } else if (exp.annees > 0) {
    strengths.push(`Expérience : ${exp.annees} an(s) détecté(s), dont ${exp.anneesPertinentes} an(s) dans le domaine.`);
  }
  if (exp.source === 'declaratif') verifications.push({ regle: 'experience', motif: `Expérience uniquement déclarative (« ${exp.declaratif} ans ») : périodes non datées dans le CV.` });
  if (exp.stagesMois > 0) strengths.push(`Dont ${exp.stagesMois} mois de stage(s) pris en compte dans l'expérience.`);
  if (exp.approximatif) weaknesses.push("Certaines périodes ne sont datées que par l'année : durée estimée à l'année, à confirmer sur attestations.");

  // --- Compétences ---
  const tech = evaluateCompetences(words, techniques);
  if (tech.total) {
    (tech.score >= 60 ? strengths : weaknesses).push(`Compétences techniques de la fiche : ${tech.trouvees}/${tech.total} retrouvées dans le CV.`);
  }
  const manquantesOblig = tech.items.filter((i) => i.obligatoire && !i.trouve);
  if (manquantesOblig.length) {
    flag('competences_obligatoires', `Compétence(s) obligatoire(s) non retrouvée(s) : ${manquantesOblig.map((i) => i.label).join(' ; ')}.`);
  }

  // --- Adéquation du profil au poste (§7 : diplômes et expérience exigés par la fiche de poste) ---
  // Hors domaine = ni formation dans le domaine, ni expérience liée au poste.
  if (domaines.length) {
    // Hors domaine : ni formation dans le domaine, ni expérience liée au poste (quelques semaines
    // repérées sur un mot isolé ne suffisent pas si la compétence clé du poste est absente).
    if (!domainEdu && (exp.anneesPertinentes === 0 || (exp.anneesPertinentes < 0.5 && manquantesOblig.length))) {
      const motif = `Profil hors domaine : ni formation (${domaines.slice(0, 4).join(', ')}…) ni expérience liée au poste « ${job?.job_title || ''} ».`;
      weaknesses.push(motif);
      flag('adequation_profil', motif);
    } else if (!domainEdu && minExp > 0 && exp.anneesPertinentes < minExp) {
      verifications.push({ regle: 'adequation_profil', motif: `Formation hors domaine et expérience liée au poste limitée (${exp.anneesPertinentes} an(s) pour ${minExp} requis).` });
    }
  }

  // --- Langues ---
  const required = job?.langues_requises || [];
  const langues = detectLanguages(sections, words, required, ctx.langues);
  const reqLang = langues.filter((l) => l.requise);
  const reqOk = reqLang.filter((l) => l.trouvee);
  const languesScore = reqLang.length ? Math.round((reqOk.length / reqLang.length) * 100) : 100;
  const manquantes = reqLang.filter((l) => !l.trouvee);
  if (manquantes.length) {
    const motif = `Langue(s) exigée(s) non mentionnée(s) : ${manquantes.map((l) => l.label).join(', ')}.`;
    weaknesses.push(motif);
    flag('langues', motif);
  } else if (reqLang.length) {
    strengths.push(`Langues exigées présentes : ${reqLang.map((l) => l.label).join(', ')}.`);
  }

  // --- Score de présélection (grille uniforme) ---
  const breakdown = {
    diplome: diplomeScore,
    experience: experienceScore,
    techniques: tech.score,
    langues: languesScore
  };
  const totalW = Object.values(ponderations).reduce((a, b) => a + Number(b || 0), 0) || 100;
  const score = Math.round(
    (Object.entries(breakdown).reduce((acc, [k, v]) => acc + v * Number(ponderations[k] || 0), 0) / totalW) * 100
  ) / 100;

  // --- Conditions de recevabilité / règles ajoutées par la Commission ---
  const LABEL_CRITERE = { diplome: 'Diplôme', experience: 'Expérience', techniques: 'Compétences techniques', langues: 'Langues' };
  const reglesAppliquees = [];
  for (const r of ctx.reglesPerso || []) {
    if (r.actif === false) continue;
    const vals = Array.isArray(r.valeurs) ? r.valeurs : [];
    const v = r.valeur != null ? Number(r.valeur) : null;
    let motif = null;
    let evaluable = true;
    switch (r.type) {
      case 'mot_cle_requis':
        if (!findKeyword(words, vals)) motif = `aucun des termes exigés trouvé (${vals.join(', ')})`;
        break;
      case 'mot_cle_interdit': {
        const hit = findKeyword(words, vals);
        if (hit) motif = `terme exclu trouvé : « ${hit.keyword} »`;
        break;
      }
      case 'age_maximum':
        if (!age) evaluable = false;
        else if (age.age > v) motif = `âge détecté ${age.age} ans > ${v} ans`;
        break;
      case 'experience_totale_min':
        if (exp.annees < v) motif = `${exp.annees} an(s) d'expérience pour ${v} exigé(s)`;
        break;
      case 'experience_liee_min':
        if (exp.anneesPertinentes < v) motif = `${exp.anneesPertinentes} an(s) d'expérience liée au poste pour ${v} exigé(s)`;
        break;
      case 'diplome_min':
        if (!edu) evaluable = false;
        else if (edu.rank < v) motif = `diplôme détecté (${edu.label}) inférieur à ${labelNiveau(v)}`;
        break;
      case 'langue_requise': {
        const det = detectLanguages(sections, words, vals, ctx.langues).filter((l) => vals.includes(l.code) && !l.trouvee);
        if (det.length) motif = `langue non mentionnée : ${det.map((l) => l.label).join(', ')}`;
        break;
      }
      case 'note_critere_min': {
        const k = vals[0];
        if (breakdown[k] != null && breakdown[k] < v) motif = `${LABEL_CRITERE[k] || k} : ${breakdown[k]}/100 < ${v}`;
        break;
      }
      default:
        evaluable = false;
    }
    reglesAppliquees.push({ id: r.id, libelle: r.libelle, respectee: evaluable ? !motif : null });
    if (!evaluable) {
      if (r.mode === 'eliminer' && ['age_maximum', 'diplome_min'].includes(r.type)) {
        verifications.push({ regle: `perso:${r.id}`, motif: `${r.libelle} : information absente du CV, à vérifier sur pièces.` });
      }
      continue;
    }
    if (!motif) continue;
    const entry = { regle: `perso:${r.id}`, motif: `${r.libelle} — ${motif}.` };
    if (r.mode === 'eliminer') { eliminations.push(entry); weaknesses.push(entry.motif); } else verifications.push(entry);
  }

  // --- Décision (§14) ---
  let decision;
  if (eliminations.length) decision = DECISIONS.NON_RECEVABLE;
  else if (score >= seuils.propose) decision = DECISIONS.PRESELECTIONNE;
  else if (score >= seuils.reserve) decision = DECISIONS.RESERVE;
  else decision = DECISIONS.NON_RETENU;

  const aVerifier = verifications.length > 0;

  const summary =
    `${job?.job_title || 'Poste'} — score de présélection ${score}/100 → ${decision}` +
    (eliminations.length ? ` (motif : ${eliminations[0].motif})` : '') +
    `. Diplôme : ${edu ? edu.label : 'non détecté'} ; expérience : ${exp.annees} an(s) (${exp.anneesPertinentes} pertinente(s)) ; ` +
    `compétences techniques : ${tech.trouvees}/${tech.total}.` +
    (aVerifier ? ` ${verifications.length} point(s) à vérifier par la sous-commission.` : '');

  return {
    moteur: ENGINE_VERSION,
    ocr: ctx.ocr || null,
    evaluatedAt: now.toISOString(),
    score,
    decision,
    status: decision,
    aVerifier,
    eliminations,
    verifications,
    breakdown,
    ponderations,
    seuils,
    summary,
    strengths,
    weaknesses,
    details: {
      diplome: { detecte: edu?.label || null, rank: edu?.rank ?? null, requis: labelNiveau(requiredRank), requisRank: requiredRank, incomplet: !!edu?.incomplete, preuve: edu?.extrait || null, domaine: domainEdu?.keyword || null, domainePreuve: domainEdu?.extrait || null },
      experience: { ...exp, requis: minExp, max: maxExp },
      techniques: tech.items,
      langues,
      age: age ? { valeur: age.age, approx: !!age.approx, preuve: age.extrait } : null,
      nationalite: nat ? { pays: nat.pays, autre: nat.autre || null, preuve: nat.extrait } : null,
      paysDeclare: ctx.country || null,
      reglesPersonnalisees: reglesAppliquees,
      caracteresExtraits: nbChars
    },
    criteres: {
      code: job?.code || null,
      job_title: job?.job_title || null,
      sous_commission: job?.sous_commission || null,
      sous_commission_libelle: sousCommission?.libelle || null,
      version: job?.version || 1
    },
    departage: {
      anneesPertinentes: exp.anneesPertinentes,
      annees: exp.annees,
      diplome: diplomeScore,
      techniques: tech.score
    }
  };
}

// =====================================================================
// 9. CLASSEMENT PAR POSTE ET EX ÆQUO (§17)
// =====================================================================
const DECISION_ORDER = {
  [DECISIONS.PRESELECTIONNE]: 0, [DECISIONS.RESERVE]: 1, [DECISIONS.NON_RETENU]: 2, [DECISIONS.NON_RECEVABLE]: 3
};
const TIE_BREAKS = [
  ['anneesPertinentes', "l'expérience directement liée au poste"],
  ['annees', "l'expérience professionnelle totale"],
  ['techniques', 'les compétences techniques'],
  ['diplome', 'la formation']
];

/**
 * @param {Array} candidates  lignes DB (evaluation JSON)
 * @param {Object} jobsByTitle  { job_title: { max_convoques } }
 * @returns candidates enrichis : rang, rangTotal, exAequo, departageMotif, convoque
 */
function rankCandidates(candidates, jobsByTitle = {}) {
  const parse = (c) => (typeof c.evaluation === 'string' ? safeJson(c.evaluation) : c.evaluation) || {};
  const groups = {};
  for (const c of candidates) {
    const key = c.job_title || c.jobTitle || '—';
    (groups[key] = groups[key] || []).push(c);
  }
  const out = [];
  for (const [title, list] of Object.entries(groups)) {
    const sorted = list.map((c) => ({ c, e: parse(c) })).sort((a, b) => {
      const da = DECISION_ORDER[a.e.decision] ?? 2;
      const db = DECISION_ORDER[b.e.decision] ?? 2;
      if ((da === 3) !== (db === 3)) return da === 3 ? 1 : -1; // non recevables en fin
      if ((b.e.score || 0) !== (a.e.score || 0)) return (b.e.score || 0) - (a.e.score || 0);
      for (const [k] of TIE_BREAKS) {
        const diff = (b.e.departage?.[k] || 0) - (a.e.departage?.[k] || 0);
        if (diff) return diff;
      }
      return 0;
    });
    const maxConv = jobsByTitle[title]?.max_convoques ? Number(jobsByTitle[title].max_convoques) : null;
    let rank = 0;
    let convoques = 0;
    sorted.forEach((item, i) => {
      const prev = sorted[i - 1];
      let exAequo = false;
      let departageMotif = null;
      if (prev && prev.e.score === item.e.score && prev.e.decision !== DECISIONS.NON_RECEVABLE) {
        const crit = TIE_BREAKS.find(([k]) => (prev.e.departage?.[k] || 0) !== (item.e.departage?.[k] || 0));
        if (crit) departageMotif = `Égalité de score départagée par ${crit[1]} (§17).`;
        else exAequo = true;
      }
      if (!exAequo) rank = i + 1;
      const eligibleConv = [DECISIONS.PRESELECTIONNE, DECISIONS.RESERVE].includes(item.e.decision);
      let convoque = false;
      if (eligibleConv) {
        if (maxConv) { convoque = convoques < maxConv; } else convoque = item.e.decision === DECISIONS.PRESELECTIONNE;
        if (convoque) convoques++;
      }
      out.push({
        ...item.c,
        rang: item.e.decision === DECISIONS.NON_RECEVABLE ? null : rank,
        rangTotal: sorted.filter((s) => s.e.decision !== DECISIONS.NON_RECEVABLE).length,
        exAequo,
        departageMotif,
        convoque
      });
    });
  }
  return out;
}

function safeJson(s) {
  try { return JSON.parse(s); } catch { return null; }
}

module.exports = {
  ENGINE_VERSION,
  DECISIONS,
  normalize,
  neutralize,
  toWords,
  splitSections,
  detectEducation,
  detectExperience,
  detectAge,
  detectNationality,
  detectLanguages,
  evaluateCompetences,
  evaluateCandidate,
  rankCandidates,
  resolveConfig
};
