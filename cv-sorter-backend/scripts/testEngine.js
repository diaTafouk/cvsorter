/**
 * Tests de non-régression du moteur de présélection (sans base de données).
 *   npm run test:engine
 * Ajoutez ici un cas à chaque fois qu'un CV réel est mal évalué : c'est ce qui
 * permet d'améliorer le moteur en continu sans casser l'existant.
 */
const assert = require('assert');
const { evaluateCandidate, rankCandidates, DECISIONS } = require('../src/services/preselectionEngine');
const { POSTES } = require('../src/data/referentiel');

const job = (code) => POSTES.find((p) => p.code === code);
const NOW = new Date('2026-10-29');
let ok = 0;
const test = (name, fn) => {
  try { fn(); ok++; console.log(`  ✔ ${name}`); } catch (e) { console.error(`  ✖ ${name}\n    ${e.message}`); process.exitCode = 1; }
};

const CV_AUDITEUR = `MOUSSA TRAORÉ
Né le 12/03/1985 à Ségou
Nationalité : Malienne

EXPÉRIENCES PROFESSIONNELLES
Janvier 2016 – Aujourd'hui : Auditeur interne senior, Banque Malienne de Solidarité
 Missions d'audit interne, évaluation du contrôle interne, cartographie des risques, rapports d'audit et suivi des recommandations.
2012 - 2015 : Comptable, Cabinet KPMG Mali - comptabilité SYSCOHADA, états financiers
2013 - 2014 : Consultant contrôle de gestion (missions ponctuelles)
Stage : juin 2011 - décembre 2011, stagiaire comptable

FORMATION
2010 : Master 2 Audit et Contrôle de gestion, Université de Bamako
2008 : Licence en Comptabilité-Finance
2005 : Baccalauréat série SE

COMPÉTENCES
Excel avancé, Power BI, normes IIA / IFACI, COSO
Qualités : rigueur, intégrité, discrétion, objectivité, esprit critique
LANGUES
Français, Anglais, Bambara`;

const CV_JUNIOR = `Fatoumata Coulibaly
Nationalité malienne
Expérience professionnelle
2023 - 2025 : assistante comptable dans une PME de Bamako, saisie comptable et caisse
Formation
2022 : Licence professionnelle en comptabilité et gestion
Langues : français, bambara
Qualités : rigueur, discrétion et sens de l'organisation pour les dossiers`;

console.log('Moteur de présélection — tests');

test('Profil conforme → Présélectionné, expérience fusionnée sans double comptage, stage inclus', () => {
  const e = evaluateCandidate(CV_AUDITEUR, job('auditeur-interne'), { country: 'Mali', now: NOW });
  assert.strictEqual(e.decision, DECISIONS.PRESELECTIONNE);
  assert.ok(e.score >= 90, `score ${e.score}`);
  assert.strictEqual(e.details.diplome.rank, 5);
  // 01/2016→10/2026 (130 mois) + 2012–2015 (36) + stage 06–12/2011 (7) = 173 mois ≈ 14,4 ans
  assert.ok(e.details.experience.annees > 14 && e.details.experience.annees < 14.6, `annees ${e.details.experience.annees}`);
  assert.strictEqual(e.details.experience.stagesMois, 7);
  assert.strictEqual(e.details.age.valeur, 41);
  assert.strictEqual(e.details.nationalite.pays, 'Mali');
});

test('Diplôme insuffisant (Licence pour Bac+4 exigé) → Non recevable', () => {
  const e = evaluateCandidate(CV_JUNIOR, job('auditeur-interne'), { country: 'Mali', now: NOW });
  assert.strictEqual(e.decision, DECISIONS.NON_RECEVABLE);
  assert.ok(e.eliminations.some((x) => x.regle === 'diplome'));
});

test('Poste réservé aux ressortissants du Mali : candidat nigérien → Non recevable', () => {
  const e = evaluateCandidate(CV_JUNIOR, job('assistant-comptable'), { country: 'Niger', now: NOW });
  assert.ok(e.eliminations.some((x) => x.regle === 'nationalite'));
});

test('Assistant comptable junior éligible → non éliminé, compétences retrouvées', () => {
  const e = evaluateCandidate(CV_JUNIOR, job('assistant-comptable'), { country: 'Mali', now: NOW });
  assert.notStrictEqual(e.decision, DECISIONS.NON_RECEVABLE, JSON.stringify(e.eliminations));
  assert.ok(e.details.techniques.find((t) => t.obligatoire).trouve);
  assert.strictEqual(e.details.experience.annees, 2);
});

test('Langue nationale exigée absente (journaliste Fulfuldé) → Non recevable', () => {
  const e = evaluateCandidate(CV_JUNIOR, job('journaliste-fulfulde'), { country: 'Mali', now: NOW });
  assert.ok(e.eliminations.some((x) => x.regle === 'langues'));
});

test('Âge < 18 ans → Non recevable', () => {
  const e = evaluateCandidate(`Né le 01/01/2010\n${CV_JUNIOR}`, job('assistant-comptable'), { country: 'Mali', now: NOW });
  assert.ok(e.eliminations.some((x) => x.regle === 'age_minimum'));
});

test('CV vide / scanné → à vérifier (pas d’élimination automatique sur la lisibilité)', () => {
  const e = evaluateCandidate('   ', job('chauffeur'), { country: 'Mali', now: NOW });
  assert.ok(e.aVerifier);
  assert.ok(e.verifications.some((x) => x.regle === 'cv_illisible'));
});

test('Seuils §14 : 70 → présélectionné, 60 → réserve, < 60 → non retenu', () => {
  const j = { ...job('chauffeur'), regles_elimination: { competences_obligatoires: { actif: false } } };
  const e = evaluateCandidate(CV_JUNIOR, j, { country: 'Mali', now: NOW });
  const expected = e.score >= 70 ? DECISIONS.PRESELECTIONNE : e.score >= 60 ? DECISIONS.RESERVE : DECISIONS.NON_RETENU;
  assert.strictEqual(e.decision, expected);
});

test('Classement §17 : égalité de score départagée par l’expérience pertinente', () => {
  const a = evaluateCandidate(CV_AUDITEUR, job('auditeur-interne'), { country: 'Mali', now: NOW });
  const b = { ...a, departage: { ...a.departage, anneesPertinentes: 1 } };
  const ranked = rankCandidates([
    { id: 2, job_title: 'Auditeur interne', evaluation: b },
    { id: 1, job_title: 'Auditeur interne', evaluation: a }
  ]);
  assert.deepStrictEqual(ranked.map((r) => [r.id, r.rang]), [[1, 1], [2, 2]]);
  assert.ok(ranked[1].departageMotif);
});


const CV_ANNEES_SEULES = `2023 : Licence en Génie Logiciel à la Faculté des Sciences et Techniques de Bamako
2017 : Baccalauréat malien, série Sciences Exactes
PROJETS ET EXPERIENCES PROFESSIONNELLES
2025 : ASSISTANT DEVELOPPEUR Mobile chez StartUp « iDansé »
Missions et tâches :
 Assistance au développement de l'application mobile.
2025 : Stagiaire à Moov-Africa Malitel au CENTRE CGIR
2024 : ASSISTANT DEVELOPPEUR Mobile et Designeur chez StartUp « BaraPro »
2022 : Freelance
Missions et tâches effectuées :
 Développement d'applications web.
Oumar DIA
Nationalité : Malienne`;

test('Années seules (« 2025 : … ») comptées, stages inclus, formations exclues', () => {
  const e = evaluateCandidate(CV_ANNEES_SEULES, job('informaticien'), { country: 'Mali', now: NOW });
  const x = e.details.experience;
  // 2022 + 2024 + 2025 (emploi et stage fusionnés) = 3 ans ; 2017 et 2023 (diplômes) exclus
  assert.strictEqual(x.annees, 3, JSON.stringify(x.periodes));
  assert.ok(x.stagesMois === 12 && x.approximatif);
});

test('Intervalles en années + stage d’une année (« 2019 – 2022 », « 2016-2019 », « 2015 »)', () => {
  const cv = `EXPERIENCES PROFESSIONNELLES\nCommercial\nDIOR, Paris | 2019 – 2022\nAssistant Commercial Export\nORANGE, Paris | 2016-2019\nAssistant Commercial Stagiaire\nDANONE, Paris | 2015\nFORMATION\nLicence Pro Commerce\nUniversité Sorbonne, Paris | 2012 - 2015\nBTS Négociation\nESUP, Paris | 2012 - 2015`;
  const x = evaluateCandidate(cv, job('resp-marketing-rp'), { country: 'Mali', now: NOW }).details.experience;
  assert.strictEqual(x.annees, 7, JSON.stringify(x.periodes));
});

test('Projet scolaire et date de naissance non comptés comme expérience', () => {
  const cv = `Née le 12/03/1990\nEXPERIENCE / PROJET\nNov. – Juil. 2022\nPROJET D'ATELIER RADIO AU SEIN DU COLLÈGE\nCréation des ateliers avec 4 élèves`;
  const x = evaluateCandidate(cv, job('secretaire'), { country: 'Mali', now: NOW }).details.experience;
  assert.strictEqual(x.annees, 0, JSON.stringify(x.periodes));
});

test('Profil informatique (langue parlée) refusé pour un poste de journaliste en langue nationale', () => {
  const cv = CV_ANNEES_SEULES + `\nLANGUES\nFrançais : lu, parlé, écrit\nPeulh et Bambara : langue maternelle`;
  const j = evaluateCandidate(cv, job('journaliste-bamanankan'), { country: 'Mali', now: NOW });
  assert.strictEqual(j.decision, DECISIONS.NON_RECEVABLE, `${j.score} ${JSON.stringify(j.eliminations)}`);
  assert.ok(j.eliminations.some((x) => x.regle === 'adequation_profil'));
  assert.ok(!j.details.techniques.find((t) => t.obligatoire).trouve, 'parler bambara ≠ journalisme en bambara');
  const i = evaluateCandidate(cv, job('informaticien'), { country: 'Mali', now: NOW });
  assert.notStrictEqual(i.decision, DECISIONS.NON_RECEVABLE, JSON.stringify(i.eliminations));
});

test('Règles ajoutées par la Commission (mot-clé exigé, âge max, langue ajoutée)', () => {
  const reglesPerso = [
    { id: 1, libelle: 'Permis exigé', type: 'mot_cle_requis', valeurs: ['permis de conduire'], mode: 'eliminer', actif: true },
    { id: 2, libelle: 'Âge maximum 40 ans', type: 'age_maximum', valeur: 40, mode: 'verifier', actif: true },
    { id: 3, libelle: 'Wolof exigé', type: 'langue_requise', valeurs: ['wolof'], mode: 'verifier', actif: true }
  ];
  const langues = { francais: { label: 'Français', synonymes: ['francais'] }, wolof: { label: 'Wolof', synonymes: ['wolof'] } };
  const e = evaluateCandidate(CV_AUDITEUR, job('auditeur-interne'), { country: 'Mali', now: NOW, reglesPerso, langues });
  assert.strictEqual(e.decision, DECISIONS.NON_RECEVABLE);
  assert.ok(e.eliminations.some((x) => x.regle === 'perso:1'));
  assert.ok(e.verifications.some((x) => x.regle === 'perso:2'), 'âge 41 > 40');
  assert.ok(e.verifications.some((x) => x.regle === 'perso:3'));
  const ok = evaluateCandidate(CV_AUDITEUR + '\nPermis de conduire B\nWolof', job('auditeur-interne'), { country: 'Mali', now: NOW, reglesPerso, langues });
  assert.ok(!ok.eliminations.some((x) => x.regle === 'perso:1') && !ok.verifications.some((x) => x.regle === 'perso:3'));
});

// Profil finance / gestion de projets : mots « montage », « développement », « assistance technique »,
// « sauvegarde », « administrateur » employés dans un autre sens que le métier technique
const CV_FINANCE = `CURRICULUM VITAE
FORMATION ACADÉMIQUE
- 1998 : Diplôme d’Etudes Supérieures Spécialisées en Audit et Contrôle de gestion
- 1991 : Maîtrise en Sciences Economiques, option « Gestion des Entreprises »
RÉSUMÉ DE L’EXPÉRIENCE PROFESSIONNELLE
FONCTIONS OCCUPEES
Depuis Mars 2026 : Télévision régionale
Administrateur puis Directeur des Finances et de la Logistique ;
Aout 2023- Mars 2026 : Cabinet ICM Consultants : Gérant associé
Principales taches
Montage de busisness plans ;
Appui à la passation des marchés (montage des DAO).
Février 2020 – Juin 2021 : Projet ACEFOR (Formation Professionnelle, financement Agence Française de Développement) ;
Responsable Administratif et Financier :
Participer au règlement des litiges en veillant à la sauvegarde des intérêts de l’Agence ;
Janvier 2014 - Mars 2015 : Programme d'appui, Bureau NIRAS en charge de l’Assistance technique auprès du CNPM
Expert en développement des PME/PMI
Mai 2005 - Septembre 2012 : Programme financé par la Banque Africaine de Développement :
Gestionnaire Comptable et Financier
Janvier 1990 - mai 1994 : Banque Méridien BIAO Mali
Service Comptabilité : Agent comptable
STAGES PRATIQUES
Février 2017 : Banque Africaine de Développement
Participation à l’Atelier national de renforcement des capacités
Janvier 2025 : Cabinet Future Skills Academy
Participation au séminaire de formation sur le thème « Reporting et tableaux de bord avec Excel »
LANGUES
Français, Anglais, Bambara`;

test('Profil finance : « montage de business plans » ≠ montage vidéo, « Banque de développement » ≠ développement logiciel', () => {
  const m = evaluateCandidate(CV_FINANCE, job('monteur'), { country: 'Mali', now: NOW });
  assert.strictEqual(m.decision, DECISIONS.NON_RECEVABLE, `${m.score} ${JSON.stringify(m.details.techniques)}`);
  assert.ok(!m.details.techniques.some((t) => t.trouve), JSON.stringify(m.details.techniques));
  const i = evaluateCandidate(CV_FINANCE, job('informaticien'), { country: 'Mali', now: NOW });
  assert.strictEqual(i.decision, DECISIONS.NON_RECEVABLE, `${i.score} ${JSON.stringify(i.details.techniques)}`);
  assert.strictEqual(i.details.experience.anneesPertinentes, 0);
  // Expérience : rubrique « Résumé de l'expérience professionnelle », intitulé du poste à la ligne suivante,
  // séminaires et ateliers non comptés
  const x = i.details.experience;
  assert.ok(x.annees > 17, `${x.annees} ${JSON.stringify(x.periodes)}`);
  assert.ok(!x.periodes.some((p) => /atelier|seminaire|02\/2017/.test(p.extrait + p.debut)), JSON.stringify(x.periodes));
  assert.strictEqual(i.details.diplome.rank, 5, 'DESS écrit en toutes lettres = Bac+5');
});

console.log(`${ok} test(s) réussi(s).`);
