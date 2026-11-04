/**
 * RÉFÉRENTIEL DE PRÉSÉLECTION (postes, fiches de poste, règles de la Commission)
 * ------------------------------------------------------------------
 * Sources :
 *  - Avis d'appel à candidatures (postes, lieux, nombres, diplômes, expérience)
 *  - TdR de la Commission interne de recrutement :
 *      §6  familles / profils concernés
 *      §7  conditions générales de candidature
 *      §10 sous-commissions et périmètres
 *      §12 présélection (grille uniforme, seuil / nombre max de convoqués)
 *      §14 seuils de validation et règles d'élimination
 *      §17 classement et gestion des ex æquo
 *  - Fiches de poste (profil proposé, compétences techniques & comportementales)
 *
 * Le barème de notation (§13 : 15/20/40/20/5) N'EST PAS utilisé ici :
 * il concerne la 2e étape (épreuves + entretien). La plateforme ne fait
 * que la présélection documentaire des dossiers.
 *
 * Champ `source` :
 *   'fiche'          → repris de la fiche de poste officielle
 *   'fiche_partielle'→ fiche partiellement disponible, complétée
 *   'avis'           → diplômes/expérience de l'avis, compétences proposées
 *                      (à valider par la sous-commission : a_confirmer = true)
 */

// ---------- Niveaux d'études (rang numérique = années après le Bac) ----------
const NIVEAUX_ETUDES = [
  { rank: -1, label: 'CAP / BEP' },
  { rank: 0, label: 'BT / Baccalauréat' },
  { rank: 2, label: 'Bac+2 (BTS, DUT, DEUG)' },
  { rank: 3, label: 'Bac+3 (Licence, Bachelor)' },
  { rank: 4, label: 'Bac+4 (Maîtrise, Master 1)' },
  { rank: 5, label: 'Bac+5 (Master, DESS, DEA, Ingénieur)' },
  { rank: 8, label: 'Doctorat' }
];

const labelNiveau = (rank) =>
  (NIVEAUX_ETUDES.find((n) => n.rank === Number(rank)) || { label: `Bac+${rank}` }).label;

// ---------- Langues reconnues (synonymes pour la détection) ----------
const LANGUES = {
  francais: { label: 'Français', synonymes: ['francais', 'french', 'langue francaise'] },
  anglais: { label: 'Anglais', synonymes: ['anglais', 'english'] },
  bamanankan: { label: 'Bamanankan (Bambara)', synonymes: ['bamanankan', 'bambara', 'bamana', 'bamanan'] },
  fulfulde: { label: 'Fulfuldé (Peul)', synonymes: ['fulfulde', 'peul', 'peulh', 'pulaar', 'fulani', 'fula', 'poular'] },
  moore: { label: 'Mooré', synonymes: ['moore', 'mossi', 'moore-francais'] },
  haoussa: { label: 'Haoussa', synonymes: ['haoussa', 'hausa', 'haussa'] },
  arabe: { label: 'Arabe', synonymes: ['arabe', 'arabic'] },
  songhai: { label: 'Songhaï / Zarma', synonymes: ['songhai', 'sonrai', 'songhay', 'zarma', 'djerma'] },
  tamasheq: { label: 'Tamasheq', synonymes: ['tamasheq', 'tamachek', 'tamashek', 'tamacheq'] }
};

// ---------- Pays de recrutement (valeurs initiales, gérées ensuite en base : table pays) ----------
const PAYS_AES = ['Mali', 'Burkina Faso', 'Niger'];
const NATIONALITES = {
  Mali: ['malien', 'malienne'],
  'Burkina Faso': ['burkinabe', 'burkinabee', 'burkinais'],
  Niger: ['nigerien', 'nigerienne']
};

// ---------- §7 Conditions générales + §14 règles d'élimination ----------
// mode : 'eliminer' → dossier Non recevable ; 'verifier' → signalé pour contrôle humain
const REGLES_PAR_DEFAUT = {
  nationalite: { actif: true, mode: 'eliminer', libelle: "Ressortissant d'un État membre éligible au poste (§7)" },
  age_minimum: { actif: true, mode: 'eliminer', valeur: 18, libelle: 'Âge minimum au moment du recrutement (§7)' },
  diplome: { actif: true, mode: 'eliminer', libelle: 'Diplôme minimum exigé par la fiche de poste (§7)' },
  experience: { actif: true, mode: 'eliminer', tolerance: 1, libelle: "Années d'expérience exigées (§7) — tolérance avant élimination" },
  adequation_profil: { actif: true, mode: 'eliminer', libelle: 'Adéquation du profil : formation OU expérience dans le domaine du poste (§7)' },
  langues: { actif: true, mode: 'eliminer', libelle: 'Langues exigées (fonctions journalistiques et linguistiques, §7)' },
  competences_obligatoires: { actif: true, mode: 'verifier', libelle: 'Compétences techniques marquées obligatoires' },
  cv_illisible: { actif: true, mode: 'verifier', valeur: 300, libelle: 'CV illisible / scanné (nombre minimal de caractères extraits)' }
};

// ---------- §14 Seuils de validation ----------
const SEUILS_PAR_DEFAUT = { propose: 70, reserve: 60 };

// ---------- §10 Sous-commissions + pondérations de présélection ----------
// Pondérations propres à la présélection documentaire (somme = 100).
// Les compétences comportementales ne sont pas notées : elles relèvent de l'entretien physique.
const SOUS_COMMISSIONS = [
  {
    code: 'A',
    libelle: 'Direction et fonctions spécialisées',
    perimetre: 'Fonctions de direction, audit, juridique, marketing/relations publiques, ressources humaines, gestion financière et logistique.',
    ponderations: { diplome: 25, experience: 35, techniques: 35, langues: 5 }
  },
  {
    code: 'B',
    libelle: 'Journalisme',
    perimetre: "Journalisme, présentation, débats, reportage d'images, langues nationales et bureaux-pays.",
    ponderations: { diplome: 20, experience: 30, techniques: 35, langues: 15 }
  },
  {
    code: 'C',
    libelle: 'Audiovisuel, technique et numérique',
    perimetre: 'Réalisation, prise de vue et de son, montage, infographie, éclairage, serveur, informatique, énergie, froid, maintenance et décor.',
    ponderations: { diplome: 25, experience: 30, techniques: 40, langues: 5 }
  },
  {
    code: 'D',
    libelle: 'Administration et personnel de soutien',
    perimetre: 'Secrétariat, archivage, liaison, comptabilité, logistique, conduite et fonctions de soutien.',
    ponderations: { diplome: 25, experience: 35, techniques: 35, langues: 5 }
  }
];

// ---------- Helpers de déclaration ----------
const c = (label, keywords, obligatoire = false, poids = 1) => ({ label, keywords, obligatoire, poids });

const SIEGE = 'Siège — Bamako';
const QUOTA = 'QUOTA_AES'; // §1.1 personnel soumis au quota (1/3) de représentation des États membres
const MALI = 'RESIDENT_MALI'; // §1.2 postes réservés aux ressortissants du Mali (siège)

// Compétences comportementales récurrentes
const CB = {
  rigueur: c('Rigueur', ['rigueur', 'rigoureux', 'rigoureuse', 'methodique', 'precision']),
  equipe: c("Esprit d'équipe", ["esprit d'equipe", 'travail en equipe', 'travail d equipe', 'collaboratif', 'esprit equipe']),
  dispo: c('Disponibilité', ['disponibilite', 'disponible', 'flexibilite', 'horaires decales', 'astreinte']),
  discretion: c('Discrétion et confidentialité', ['discretion', 'discret', 'discrete', 'confidentialite']),
  integrite: c('Intégrité', ['integrite', 'integre', 'probite', 'ethique', 'honnetete']),
  leadership: c('Leadership', ['leadership', 'meneur', 'management', 'encadrement', 'conduite d equipe']),
  stress: c('Gestion du stress et des urgences', ['gestion du stress', 'resistance au stress', 'sous pression', 'urgence', 'sang-froid', 'sang froid']),
  reactivite: c('Réactivité', ['reactivite', 'reactif', 'reactive']),
  organisation: c("Sens de l'organisation", ['organisation', 'organise', 'organisee', 'planification', 'sens de l organisation']),
  creativite: c('Créativité', ['creativite', 'creatif', 'creative', 'imagination', 'innovation']),
  impartialite: c('Objectivité et impartialité', ['objectivite', 'impartialite', 'neutralite', 'objectif', 'impartial']),
  communication: c('Aisance relationnelle', ['sens relationnel', 'aisance relationnelle', 'communication', 'contact', 'ecoute']),
  ponctualite: c('Ponctualité', ['ponctualite', 'ponctuel', 'ponctuelle', 'assiduite']),
  responsabilite: c('Sens des responsabilités', ['sens des responsabilites', 'responsable', 'professionnalisme', 'autonomie', 'autonome']),
  negociation: c('Sens de la négociation', ['negociation', 'negocier', 'mediation', 'diplomatie'])
};

const redactionnel = c('Compétences rédactionnelles et éditoriales (§7)', ['redaction', 'redacteur', 'redactionnel', 'ecriture', 'editorial', 'articles', 'depeches'], false, 1);
const oral = c('Expression orale / présence à l’antenne (§7)', ['antenne', 'diction', 'elocution', 'expression orale', 'presentation', 'voix', 'animateur', 'animatrice']);

// ---------- POSTES À POURVOIR ----------
const POSTES = [
  // =================== A — DIRECTION ET FONCTIONS SPÉCIALISÉES ===================
  {
    code: 'auditeur-interne',
    job_title: 'Auditeur interne',
    sous_commission: 'A', lieu: SIEGE, nombre_postes: 1, categorie: QUOTA,
    mission: "Évaluer l'efficacité du dispositif de contrôle interne, la conformité des opérations aux textes et procédures en vigueur, ainsi que la fiabilité des informations financières et comptables. Identifier les risques, formuler des recommandations et assurer leur suivi. Rattachement : Conseil d'administration.",
    min_education_rank: 4,
    diplome_domaines: ['audit', 'controle de gestion', 'finance', 'comptabilite', 'gestion', 'comptable', 'financier'],
    min_experience_years: 5, max_experience_years: 8,
    experience_domaines: ['audit', 'controle interne', 'gestion des risques', 'auditeur', 'commissariat aux comptes', 'inspection'],
    competences_techniques: [
      c("Maîtrise des techniques d'audit interne et de contrôle interne", ['audit interne', 'controle interne', "mission d'audit", 'missions d audit', 'ifaci', 'iia', 'coso', 'auditeur', 'cia'], true, 2),
      c("Maîtrise de l'analyse des risques et des procédures de contrôle", ['analyse des risques', 'gestion des risques', 'cartographie des risques', 'procedures de controle', 'risk']),
      c('Bonne connaissance de la comptabilité, de la finance et de la gestion', ['comptabilite', 'syscohada', 'etats financiers', 'finance', 'controle de gestion', 'ohada']),
      c("Maîtrise des techniques de rédaction des rapports d'audit", ["rapport d'audit", 'rapports d audit', "rapports d'audit", 'recommandations', 'redaction de rapports']),
      c("Maîtrise des outils bureautiques et d'analyse de données", ['excel', 'bureautique', 'analyse de donnees', 'power bi', 'acl', 'word', 'powerpoint'])
    ],
    competences_comportementales: [
      c("Intégrité et indépendance d'esprit", ['integrite', 'independance', 'ethique', 'probite']),
      c("Rigueur et sens de l'analyse", ['rigueur', 'sens de l analyse', 'esprit d analyse', 'analytique', 'rigoureux']),
      CB.discretion,
      CB.impartialite,
      c('Esprit critique et capacité à formuler des recommandations', ['esprit critique', 'recommandations', 'force de proposition'])
    ],
    langues_requises: ['francais'], source: 'fiche', a_confirmer: false
  },
  {
    code: 'conseiller-juridique',
    job_title: 'Conseiller juridique',
    sous_commission: 'A', lieu: SIEGE, nombre_postes: 1, categorie: QUOTA,
    mission: "Assurer le conseil juridique auprès de la Direction générale, veiller à la conformité des actes, contrats et décisions aux textes applicables et prévenir les risques juridiques. Participer à l'élaboration et à la validation des documents juridiques et réglementaires, assurer le suivi des contentieux.",
    min_education_rank: 4,
    diplome_domaines: ['droit', 'juridique', 'sciences juridiques', 'droit des affaires', 'droit public', 'droit prive'],
    min_experience_years: 5, max_experience_years: 8,
    experience_domaines: ['juriste', 'juridique', 'conseil juridique', 'avocat', 'contentieux', 'affaires juridiques'],
    competences_techniques: [
      c('Conseil juridique auprès des organes et directions', ['conseil juridique', 'conseiller juridique', 'juriste', 'avis juridique', 'affaires juridiques'], true, 2),
      c('Préparation, analyse et sécurisation des contrats et conventions', ['contrats', 'conventions', 'redaction de contrats', 'negociation de contrats', 'contractuel']),
      c('Veille juridique et réglementaire', ['veille juridique', 'veille reglementaire', 'reglementation']),
      c('Rédaction des textes internes', ['textes internes', 'reglement interieur', 'statuts', 'manuel de procedures', 'textes reglementaires']),
      c('Gestion des contentieux', ['contentieux', 'litiges', 'precontentieux', 'tribunal', 'arbitrage']),
      c('Droit des médias, OHADA, droit du travail', ['droit des medias', 'droit de la communication', 'ohada', 'droit du travail', 'propriete intellectuelle', 'droit d auteur'])
    ],
    competences_comportementales: [CB.rigueur, CB.discretion, CB.integrite, CB.negociation, CB.impartialite],
    langues_requises: ['francais'], source: 'fiche_partielle', a_confirmer: true
  },
  {
    code: 'resp-marketing-rp',
    job_title: 'Responsable Marketing et Relations publiques',
    sous_commission: 'A', lieu: SIEGE, nombre_postes: 1, categorie: QUOTA,
    mission: 'Concevoir et piloter la stratégie marketing, commerciale et de relations publiques de la chaîne.',
    min_education_rank: 4,
    diplome_domaines: ['marketing', 'communication', 'relations publiques', 'commerce', 'commercial', 'gestion commerciale'],
    min_experience_years: 5, max_experience_years: null,
    experience_domaines: ['marketing', 'relations publiques', 'communication', 'commercial', 'regie publicitaire'],
    competences_techniques: [
      c('Élaboration et pilotage de stratégies marketing', ['strategie marketing', 'plan marketing', 'marketing', 'marketing operationnel'], true, 2),
      c('Relations publiques et relations presse', ['relations publiques', 'relations presse', 'communication institutionnelle', 'communique de presse']),
      c('Régie publicitaire, partenariats et sponsoring', ['regie publicitaire', 'sponsoring', 'partenariats', 'vente d espaces', 'annonceurs', 'commercial']),
      c('Marketing digital et réseaux sociaux', ['marketing digital', 'reseaux sociaux', 'community management', 'seo', 'facebook', 'campagnes digitales']),
      c('Événementiel', ['evenementiel', 'evenements', 'salons', 'lancement']),
      c("Études de marché et mesure d'audience", ['etude de marche', 'etudes de marche', 'audience', 'mediametrie', 'sondage'])
    ],
    competences_comportementales: [CB.communication, CB.creativite, CB.negociation, CB.leadership, CB.organisation],
    langues_requises: ['francais'], source: 'avis', a_confirmer: true
  },
  ...['Directeur des Informations, des Productions et Programmes', 'Rédacteur en Chef', 'Rédacteur en Chef Adjoint'].map((title, i) => ({
    code: ['dir-info-prod-prog', 'redacteur-en-chef', 'redacteur-en-chef-adjoint'][i],
    job_title: title,
    sous_commission: 'A', lieu: SIEGE, nombre_postes: 1, categorie: QUOTA,
    mission: "Journaliste expérimenté avec des compétences managériales élevées : piloter la ligne éditoriale, l'information, les productions et/ou la rédaction.",
    min_education_rank: 4,
    diplome_domaines: ['journalisme', 'communication', "sciences de l'information", 'sciences de l information', 'information et communication'],
    min_experience_years: 5, max_experience_years: 8,
    experience_domaines: ['journaliste', 'redaction', 'redacteur', 'chef d edition', 'television', 'radio', 'presse', 'information'],
    competences_techniques: [
      c('Direction de rédaction et ligne éditoriale', ['ligne editoriale', 'redacteur en chef', 'redaction en chef', "conference de redaction", 'chef d edition', 'direction de l information'], true, 2),
      c('Production et programmation audiovisuelle', ['programmation', 'grille des programmes', 'production audiovisuelle', 'programmes', 'magazine']),
      c("Management d'équipes rédactionnelles", ['management', 'encadrement', 'coordination', 'chef de service', 'manager'], true, 2),
      c('Éthique et déontologie journalistique', ['deontologie', 'ethique', 'charte', 'haac', 'hac']),
      c('Journalisme télévisé', ['television', 'journal televise', 'jt', 'reportage', 'tele']),
      redactionnel
    ],
    competences_comportementales: [CB.leadership, CB.responsabilite, CB.stress, CB.equipe, CB.impartialite],
    langues_requises: ['francais'], source: 'avis', a_confirmer: true
  })),
  {
    code: 'dir-technique-si',
    job_title: "Directeur Technique et des Systèmes d'Information",
    sous_commission: 'A', lieu: SIEGE, nombre_postes: 1, categorie: QUOTA,
    mission: "Assurer la gestion, la coordination et la supervision des infrastructures techniques audiovisuelles, des systèmes informatiques, des réseaux et des équipements de diffusion. Élaborer la stratégie de modernisation technologique, superviser la maintenance, la sécurité des SI et encadrer les équipes. Rattachement : Direction générale.",
    min_education_rank: 3,
    diplome_domaines: ['informatique', 'telecommunications', 'ingenierie audiovisuelle', 'audiovisuel', 'reseaux', 'electronique', 'genie electrique'],
    min_experience_years: 5, max_experience_years: null,
    experience_domaines: ['technique', 'informatique', 'reseau', 'audiovisuel', 'diffusion', 'broadcast', 'systemes', 'telecom'],
    competences_techniques: [
      c('Avoir installé avec succès au moins deux studios/régies de télévision', ['installation de studio', 'installation de regie', 'studio de television', 'regie de television', 'regie tv', 'mise en place de regie', 'installation studio', 'studios', 'regies'], true, 2),
      c("Expérience d'encadrement", ['encadrement', 'management', 'chef de service', 'responsable technique', 'directeur technique', 'manager', 'superviseur'], true, 2),
      c('Maîtrise des infrastructures informatiques, réseaux et systèmes', ['reseaux', 'systemes', 'serveurs', 'infrastructure', 'cisco', 'linux', 'windows server', 'virtualisation', 'datacenter']),
      c('Bonne maîtrise des technologies audiovisuelles et de diffusion', ['diffusion', 'broadcast', 'satellite', 'tnt', 'playout', 'iptv', 'streaming', 'encodage', 'emetteur']),
      c('Connaissance de la cybersécurité et de la sauvegarde des données', ['cybersecurite', 'securite informatique', 'sauvegarde', 'backup', 'pare-feu', 'firewall', 'pra']),
      c('Maîtrise de la gestion des projets techniques', ['gestion de projet', 'chef de projet', 'pmp', 'prince2', 'pilotage de projet']),
      c('Connaissance de la maintenance et de la continuité de service', ['maintenance', 'continuite de service', 'support technique', 'disponibilite des systemes'])
    ],
    competences_comportementales: [
      c('Leadership technique', ['leadership', 'encadrement', 'management']),
      CB.reactivite,
      c("Esprit d'analyse et résolution de problèmes", ['resolution de problemes', 'esprit d analyse', 'analytique', 'diagnostic']),
      CB.rigueur,
      c("Sens de l'anticipation", ['anticipation', 'anticiper', 'prevention']),
      c("Capacité à gérer les situations d'urgence", ['urgence', 'gestion de crise', 'astreinte', 'incident'])
    ],
    langues_requises: ['francais'], source: 'fiche', a_confirmer: false
  },
  {
    code: 'drh',
    job_title: 'Directeur des Ressources Humaines',
    sous_commission: 'A', lieu: SIEGE, nombre_postes: 1, categorie: QUOTA,
    mission: 'Concevoir, proposer et mettre en œuvre la politique de gestion et de développement des ressources humaines afin de disposer d’un personnel compétent et motivé.',
    min_education_rank: 4,
    diplome_domaines: ['droit', 'droit du travail', 'ressources humaines', 'grh', 'economie', 'gestion', 'gestion des ressources humaines'],
    min_experience_years: 5, max_experience_years: 8,
    experience_domaines: ['ressources humaines', 'rh', 'personnel', 'drh', 'recrutement', 'paie'],
    competences_techniques: [
      c('Administration du personnel et paie', ['paie', 'administration du personnel', 'gestion administrative du personnel', 'contrats de travail', 'dossiers du personnel'], true, 2),
      c('Recrutement et gestion des talents', ['recrutement', 'gestion des talents', 'integration', 'selection']),
      c('Droit du travail et législation sociale', ['droit du travail', 'code du travail', 'droit social', 'inps', 'cnss', 'securite sociale']),
      c('Formation et GPEC', ['formation', 'gpec', 'plan de formation', 'gestion des competences']),
      c('Gestion des carrières et évaluation des performances', ['evaluation', 'carrieres', 'entretien annuel', 'performance', 'gestion des carrieres']),
      c('Dialogue social', ['dialogue social', 'relations sociales', 'partenaires sociaux', 'syndicat', 'delegues du personnel']),
      c('Outils SIRH', ['sirh', 'logiciel de paie', 'sage paie', 'excel'])
    ],
    competences_comportementales: [CB.communication, CB.discretion, CB.impartialite, CB.leadership, CB.negociation],
    langues_requises: ['francais'], source: 'avis', a_confirmer: true
  },
  {
    code: 'dgfl',
    job_title: 'Directeur Gestion Financière et Logistique',
    sous_commission: 'A', lieu: SIEGE, nombre_postes: 1, categorie: QUOTA,
    mission: 'Assurer la gestion budgétaire, financière, comptable et logistique de la chaîne.',
    min_education_rank: 4,
    diplome_domaines: ['economie', 'gestion', 'finance', 'comptabilite', 'sciences economiques', 'logistique'],
    min_experience_years: 5, max_experience_years: 8,
    experience_domaines: ['finance', 'comptabilite', 'budget', 'daf', 'financier', 'logistique', 'tresorerie'],
    competences_techniques: [
      c('Élaboration et suivi budgétaire', ['budget', 'elaboration budgetaire', 'controle budgetaire', 'execution budgetaire'], true, 2),
      c('Comptabilité générale et analytique (SYSCOHADA)', ['comptabilite', 'syscohada', 'comptabilite analytique', 'etats financiers', 'bilan']),
      c('Gestion de trésorerie', ['tresorerie', 'flux de tresorerie', 'banques']),
      c('Logistique et approvisionnements', ['logistique', 'approvisionnement', 'stocks', 'achats', 'patrimoine']),
      c('Passation des marchés', ['marches publics', 'passation des marches', "appels d'offres", 'appel d offres']),
      c('Fiscalité', ['fiscalite', 'declarations fiscales', 'impots', 'tva']),
      c('Logiciels de gestion', ['sage', 'saari', 'tompro', 'erp', 'excel'])
    ],
    competences_comportementales: [CB.rigueur, CB.integrite, CB.organisation, CB.leadership, c("Sens de l'anticipation", ['anticipation', 'anticiper', 'prevision'])],
    langues_requises: ['francais'], source: 'avis', a_confirmer: true
  },

  // =================== B — JOURNALISME ===================
  {
    code: 'journaliste-debats',
    job_title: 'Journalistes chargés de débats',
    sous_commission: 'B', lieu: SIEGE, nombre_postes: 2, categorie: QUOTA,
    mission: "Préparer, animer et modérer les débats et émissions de plateau.",
    min_education_rank: 3,
    diplome_domaines: ['journalisme', 'communication', 'sciences politiques', 'sciences sociales', 'sociologie', 'information'],
    min_experience_years: 3, max_experience_years: null,
    experience_domaines: ['journaliste', 'debat', 'animateur', 'moderateur', 'emission', 'plateau', 'television', 'radio'],
    competences_techniques: [
      c('Animation et modération de débats', ['debat', 'debats', 'moderation', 'moderateur', 'animation', 'talk-show', 'talk show', 'plateau'], true, 2),
      c("Préparation éditoriale et recherche documentaire", ['recherche documentaire', 'preparation', 'conducteur', 'documentation']),
      c("Connaissance de l'actualité politique, économique et régionale", ['actualite', 'politique', 'geopolitique', 'sahel', 'economie']),
      c("Techniques d'interview", ['interview', 'interviews', 'entretien', 'invites']),
      oral,
      redactionnel
    ],
    competences_comportementales: [CB.impartialite, CB.stress, CB.equipe, CB.rigueur, CB.dispo],
    langues_requises: ['francais'], source: 'avis', a_confirmer: true
  },
  {
    code: 'journaliste-presentateur',
    job_title: 'Journalistes Présentateurs',
    sous_commission: 'B', lieu: SIEGE, nombre_postes: 3, categorie: QUOTA,
    mission: 'Présenter les journaux et éditions d’information.',
    min_education_rank: 3,
    diplome_domaines: ['journalisme', 'communication', 'information'],
    min_experience_years: 3, max_experience_years: null,
    experience_domaines: ['presentateur', 'presentatrice', 'journaliste', 'journal televise', 'television', 'radio', 'antenne'],
    competences_techniques: [
      c('Présentation de journaux télévisés', ['presentateur', 'presentatrice', 'presentation du journal', 'journal televise', 'jt', 'edition', 'antenne'], true, 2),
      c('Direct, plateau et prompteur', ['prompteur', 'direct', 'live', 'plateau']),
      c('Rédaction de lancements et brèves', ['lancement', 'lancements', 'breves', 'depeches', 'redaction']),
      c('Diction et élocution', ['diction', 'elocution', 'voix', 'expression orale']),
      c("Connaissance de l'actualité", ['actualite', 'politique', 'international', 'sahel'])
    ],
    competences_comportementales: [CB.stress, CB.rigueur, CB.equipe, CB.ponctualite, CB.dispo],
    langues_requises: ['francais'], source: 'avis', a_confirmer: true
  },
  {
    code: 'jri',
    job_title: "Journalistes Reporters d'Images",
    sous_commission: 'B', lieu: SIEGE, nombre_postes: 3, categorie: QUOTA,
    mission: "Réaliser des reportages (tournage, son, montage) pour l'information.",
    min_education_rank: 3,
    diplome_domaines: ['journalisme', 'communication', 'audiovisuel', 'information'],
    min_experience_years: 3, max_experience_years: null,
    experience_domaines: ['jri', "reporter d'images", 'reporter d images', 'journaliste', 'reportage', 'cameraman', 'television'],
    competences_techniques: [
      c('Tournage et prise de vue', ['camera', 'tournage', 'prise de vue', 'cadrage', 'jri', "reporter d'images", 'reporter d images'], true, 2),
      c('Montage vidéo', ['montage', 'premiere pro', 'final cut', 'avid', 'davinci']),
      c("Reportage et écriture pour l'image", ['reportage', 'reportages', 'sujet', 'commentaire', 'ecriture']),
      c('Prise de son terrain', ['prise de son', 'micro', 'son']),
      c('Transmission et direct (LiveU/TVU)', ['liveu', 'tvu', 'transmission', 'direct', 'duplex'])
    ],
    competences_comportementales: [CB.reactivite, CB.dispo, CB.responsabilite, CB.equipe, c("Sens de l'initiative", ['initiative', 'curiosite', 'curieux'])],
    langues_requises: ['francais'], source: 'avis', a_confirmer: true
  },
  ...[
    { code: 'journaliste-fulfulde', title: 'Journaliste en langue Fulfuldé', langue: 'fulfulde', lieu: SIEGE, n: 1 },
    { code: 'journaliste-bamanankan', title: 'Journaliste en langue Bamanankan', langue: 'bamanankan', lieu: SIEGE, n: 1 },
    { code: 'journaliste-bilingue-moore', title: 'Journalistes bilingues français–Mooré', langue: 'moore', lieu: 'Bureau-Pays — Ouagadougou (Burkina Faso)', n: 3, avis: true },
    { code: 'journaliste-bilingue-haoussa', title: 'Journalistes bilingues français–Haoussa', langue: 'haoussa', lieu: 'Bureau-Pays — Niamey (Niger)', n: 3, avis: true }
  ].map((p) => ({
    code: p.code,
    job_title: p.title,
    sous_commission: 'B', lieu: p.lieu, nombre_postes: p.n, categorie: QUOTA,
    mission: `Produire, rédiger et présenter l'information en ${LANGUES[p.langue].label} et en français.`,
    min_education_rank: 2,
    diplome_domaines: ['journalisme', 'communication', 'langues', 'linguistique', 'lettres'],
    min_experience_years: 3, max_experience_years: null,
    experience_domaines: ['journaliste', 'animateur', 'presentateur', 'radio', 'television', 'langue nationale', 'traducteur'],
    competences_techniques: [
      // La seule connaissance de la langue ne suffit pas : on recherche une pratique journalistique
      // (la maîtrise de la langue est contrôlée séparément par la règle « langues exigées »).
      c(`Journalisme en ${LANGUES[p.langue].label}`, ['journaliste', 'journalisme', 'presentateur', 'presentatrice', 'animateur radio', 'animatrice radio', 'journal en langue', 'edition en langue', 'emission en langue', 'langues nationales', 'radio communautaire', 'radio rurale'], true, 2),
      c('Traduction et adaptation (français ↔ langue nationale)', ['traduction', 'traducteur', 'traductrice', 'interprete', 'interpretariat']),
      c('Rédaction et présentation de l\'information', ['redaction', 'redacteur', 'redactrice', 'presentation du journal', 'antenne', 'presentateur', 'depeches']),
      c('Reportage et interview', ['reportage', 'reportages', 'interview', 'interviews', 'micro trottoir']),
      oral
    ],
    competences_comportementales: [CB.rigueur, CB.equipe, CB.dispo, CB.impartialite],
    langues_requises: ['francais', p.langue],
    source: 'avis', a_confirmer: true
  })),

  // =================== C — AUDIOVISUEL, TECHNIQUE ET NUMÉRIQUE ===================
  {
    code: 'realisateur',
    job_title: 'Réalisateurs',
    sous_commission: 'C', lieu: SIEGE, nombre_postes: 3, categorie: QUOTA,
    mission: 'Réaliser les émissions, journaux et programmes (plateau, direct, multicaméra).',
    min_education_rank: 3,
    diplome_domaines: ['realisation audiovisuelle', 'realisation', 'cinema', 'television', 'communication', 'audiovisuel'],
    min_experience_years: 3, max_experience_years: 5,
    experience_domaines: ['realisateur', 'realisation', 'regie', 'television', 'production', 'cinema'],
    competences_techniques: [
      c('Réalisation TV (plateau, direct, multicaméra)', ['realisation', 'realisateur', 'multicamera', 'multi-camera', 'plateau', 'direct'], true, 2),
      c('Découpage, scénario et conducteur', ['decoupage', 'scenario', 'storyboard', 'conducteur']),
      c('Mélangeur et régie vidéo', ['melangeur', 'regie', 'switcher', 'vmix', 'tricaster']),
      c('Postproduction et montage', ['montage', 'postproduction', 'post-production', 'etalonnage']),
      c("Direction d'équipe technique", ["direction d'equipe", 'equipe technique', 'coordination'])
    ],
    competences_comportementales: [CB.creativite, CB.leadership, CB.stress, CB.rigueur, CB.equipe],
    langues_requises: ['francais'], source: 'avis', a_confirmer: true
  },
  // --- §1.2 Postes ouverts aux ressortissants du Mali (siège) ---
  {
    code: 'tech-energie-froid', job_title: 'Technicien Énergie et Froid', sous_commission: 'C', nombre_postes: 2,
    min_education_rank: -1, diplome_domaines: ['froid', 'electricite', 'energie', 'climatisation', 'electrotechnique'],
    experience_domaines: ['froid', 'climatisation', 'electricien', 'electricite', 'energie', 'groupe electrogene'],
    competences_techniques: [
      c('Froid et climatisation', ['froid', 'climatisation', 'frigoriste', 'chambre froide', 'split', 'climatiseur'], true, 2),
      c('Électricité bâtiment / industrielle', ['electricite', 'electricien', 'tableau electrique', 'cablage', 'electrotechnique']),
      c('Groupes électrogènes, onduleurs, solaire', ['groupe electrogene', 'onduleur', 'ups', 'solaire', 'photovoltaique', 'energie']),
      c('Maintenance préventive et curative', ['maintenance preventive', 'maintenance curative', 'depannage', 'maintenance'])
    ],
    competences_comportementales: [CB.reactivite, CB.rigueur, c('Sens de la sécurité', ['securite', 'hse', 'prevention des risques']), CB.dispo]
  },
  {
    code: 'tech-maintenance', job_title: 'Technicien chargé de maintenance', sous_commission: 'C', nombre_postes: 2,
    min_education_rank: 2, diplome_domaines: ['electronique', 'informatique', 'electricite', 'electrotechnique', 'maintenance'],
    experience_domaines: ['maintenance', 'technicien', 'electronique', 'reparation', 'depannage'],
    competences_techniques: [
      c('Électronique', ['electronique', 'carte electronique', 'soudure', 'composants'], true, 2),
      c('Maintenance des équipements audiovisuels', ['maintenance', 'equipements audiovisuels', 'cameras', 'regie', 'materiel audiovisuel']),
      c('Matériel informatique', ['informatique', 'materiel informatique', 'hardware', 'ordinateurs']),
      c('Électricité', ['electricite', 'electrique']),
      c('Diagnostic et dépannage', ['diagnostic', 'depannage', 'reparation'])
    ],
    competences_comportementales: [CB.rigueur, CB.reactivite, CB.dispo, CB.equipe]
  },
  {
    code: 'informaticien', job_title: 'Informaticien', sous_commission: 'C', nombre_postes: 2,
    min_education_rank: 3, diplome_domaines: ['informatique', 'genie logiciel', 'reseaux', 'systemes d information', 'telecommunications'],
    // Termes précis : « administrateur », « support », « réseau » seuls désignent aussi des postes non informatiques
    experience_domaines: ['informaticien', 'informaticienne', 'technicien informatique', 'ingenieur informatique', 'administrateur systeme', 'administrateur reseau', 'administrateur systemes et reseaux', 'administrateur de bases de donnees', 'developpeur', 'support informatique', 'maintenance informatique', 'helpdesk', 'reseau informatique', 'reseaux informatiques', 'service informatique', 'responsable informatique', 'genie logiciel'],
    competences_techniques: [
      c('Administration systèmes et réseaux', ['administration systeme', 'administration systemes', 'administration reseau', 'administration des reseaux', 'reseau informatique', 'reseaux informatiques', 'reseau local', 'informatique des reseaux', 'systemes et reseaux', 'reseaux et systemes', 'reseaux et telecommunications', 'lan', 'wan', 'windows server', 'linux', 'active directory', 'tcp/ip', 'cisco', 'routeur', 'vlan'], true, 2),
      c('Support et assistance utilisateurs', ['support informatique', 'support technique informatique', 'helpdesk', 'help desk', 'assistance utilisateurs', 'assistance aux utilisateurs', 'support utilisateurs', 'support aux utilisateurs']),
      c('Sécurité informatique et sauvegarde', ['securite informatique', 'cybersecurite', 'antivirus', 'pare-feu', 'firewall', 'sauvegarde des donnees', 'sauvegarde informatique', 'backup']),
      c('Développement et bases de données', ['developpement web', 'developpement logiciel', "developpement d'applications", 'programmation', 'base de donnees relationnelle', 'sql', 'mysql', 'postgresql', 'oracle', 'php', 'python', 'javascript', 'java']),
      c('Maintenance du parc informatique', ['parc informatique', 'maintenance informatique', 'maintenance des ordinateurs', 'installation de logiciels', 'installation des postes', 'depannage informatique'])
    ],
    competences_comportementales: [CB.rigueur, CB.reactivite, CB.discretion, CB.equipe]
  },
  {
    code: 'op-prise-son', job_title: 'Opérateur de prise de son', sous_commission: 'C', nombre_postes: 3,
    min_education_rank: 0, diplome_domaines: ['audiovisuel', 'technique audiovisuelle', 'multimedia', 'son', 'electronique'],
    experience_domaines: ['son', 'ingenieur du son', 'preneur de son', 'sonorisation', 'mixage', 'regie'],
    competences_techniques: [
      c('Équipements de régie et console audio', ['console', 'table de mixage', 'regie son', 'regie audio', 'mixage', 'console audio'], true, 2),
      c('Prise de son plateau et terrain', ['prise de son', 'micro', 'perche', 'hf', 'preneur de son']),
      c('Sonorisation', ['sonorisation', 'sono']),
      c('Logiciels audio', ['pro tools', 'audition', 'logic pro', 'reaper', 'cubase'])
    ],
    competences_comportementales: [CB.rigueur, CB.reactivite, CB.equipe, CB.dispo]
  },
  {
    code: 'op-prise-vue', job_title: 'Opérateur de prise de vue', sous_commission: 'C', nombre_postes: 3,
    min_education_rank: 2, diplome_domaines: ['audiovisuel', 'technique audiovisuelle', 'multimedia', 'image', 'cinema'],
    experience_domaines: ['camera', 'cadreur', 'operateur', 'prise de vue', 'regie video', 'television'],
    competences_techniques: [
      c('Prise de vue et cadrage', ['camera', 'prise de vue', 'cadrage', 'cadreur', 'video'], true, 2),
      c('Équipements de régie vidéo', ['regie', 'regie video', 'melangeur', 'controle image']),
      c('Serveur vidéo', ['serveur video', 'ingest', 'evs', 'playout']),
      c('Notions d’éclairage', ['eclairage', 'lumiere'])
    ],
    competences_comportementales: [CB.rigueur, CB.reactivite, CB.equipe, CB.dispo]
  },
  {
    code: 'op-serveur', job_title: 'Opérateur Serveur', sous_commission: 'C', nombre_postes: 2,
    min_education_rank: 2, diplome_domaines: ['audiovisuel', 'technique audiovisuelle', 'multimedia', 'informatique'],
    experience_domaines: ['serveur', 'diffusion', 'regie', 'playout', 'operateur'],
    competences_techniques: [
      c('Serveur vidéo et playout', ['serveur video', 'playout', 'evs', 'airspeed', 'ingest', 'serveur'], true, 2),
      c('Régie de diffusion / conduite d’antenne', ['regie finale', 'regie de diffusion', 'diffusion', "conduite d'antenne", 'conduite d antenne']),
      c('Formats, codecs et encodage', ['codec', 'format video', 'encodage', 'transcodage', 'mxf', 'h264']),
      c('Archivage numérique / MAM', ['mam', 'archivage', 'stockage', 'nas'])
    ],
    competences_comportementales: [CB.rigueur, CB.reactivite, CB.dispo, CB.stress]
  },
  {
    code: 'infographe', job_title: 'Infographe', sous_commission: 'C', nombre_postes: 2,
    min_education_rank: 2, diplome_domaines: ['graphisme', 'infographie', 'montage', 'design', 'arts graphiques', 'multimedia'],
    experience_domaines: ['infographe', 'infographiste', 'graphiste', 'designer', 'motion'],
    competences_techniques: [
      c('Graphisme (Photoshop, Illustrator)', ['photoshop', 'illustrator', 'graphisme', 'infographie', 'design graphique', 'indesign'], true, 2),
      c('Motion design / habillage antenne', ['after effects', 'motion design', 'habillage', 'animation 2d', 'cinema 4d', '3d']),
      c('Montage', ['premiere', 'montage']),
      c('Charte graphique et identité visuelle', ['charte graphique', 'identite visuelle', 'logo'])
    ],
    competences_comportementales: [CB.creativite, CB.rigueur, CB.reactivite, CB.equipe]
  },
  {
    code: 'monteur', job_title: 'Monteurs', sous_commission: 'C', nombre_postes: 3,
    min_education_rank: 2, diplome_domaines: ['montage', 'graphisme', 'audiovisuel', 'cinema', 'multimedia'],
    experience_domaines: ['monteur', 'monteuse', 'chef monteur', 'montage video', 'montage audiovisuel', 'montage', 'postproduction', 'post production', 'video'],
    competences_techniques: [
      c('Montage vidéo (Premiere, Final Cut, Avid, DaVinci)', ['montage video', 'montage audiovisuel', 'montage', 'monteur', 'monteuse', 'premiere pro', 'adobe premiere', 'final cut', 'avid', 'davinci', 'edius'], true, 2),
      c('Étalonnage et mixage', ['etalonnage', 'mixage', 'colorimetrie']),
      c('Formats et export', ['export video', 'formats video', 'format video', 'codec', 'encodage', 'rendu video']),
      c('Narration et rythme', ['narration', 'rythme', 'reportage', 'documentaire'])
    ],
    competences_comportementales: [CB.creativite, CB.rigueur, CB.stress, CB.equipe]
  },
  {
    code: 'eclairagiste', job_title: 'Éclairagiste', sous_commission: 'C', nombre_postes: 2,
    min_education_rank: -1, diplome_domaines: ['froid', 'electronique', 'energie', 'electricite', 'electrotechnique'],
    experience_domaines: ['eclairagiste', 'eclairage', 'lumiere', 'electricien', 'plateau'],
    competences_techniques: [
      c('Éclairage plateau et extérieur', ['eclairage', 'eclairagiste', 'projecteur', 'led', 'plan de feu', 'lumiere'], true, 2),
      c('Console lumière / DMX', ['console lumiere', 'dmx', "jeu d'orgue", 'jeu d orgue']),
      c('Électricité', ['electricite', 'electrique', 'cablage']),
      c('Sécurité électrique', ['securite electrique', 'habilitation electrique', 'securite'])
    ],
    competences_comportementales: [CB.rigueur, CB.creativite, CB.equipe, CB.dispo]
  },
  {
    code: 'cameraman', job_title: 'Cameraman', sous_commission: 'C', nombre_postes: 3,
    min_education_rank: 2, diplome_domaines: ['audiovisuel', 'technique audiovisuelle', 'multimedia', 'image', 'cinema'],
    experience_domaines: ['cameraman', 'cadreur', 'camera', 'tournage', 'television'],
    competences_techniques: [
      c('Cadrage et prise de vue', ['camera', 'cameraman', 'cadreur', 'cadrage', 'prise de vue'], true, 2),
      c('Tournage plateau, extérieur et multicaméra', ['tournage', 'plateau', 'exterieur', 'multicamera', 'reportage']),
      c('Matériel (trépied, steadicam, drone, gimbal)', ['trepied', 'steadicam', 'drone', 'gimbal', 'stabilisateur']),
      c('Notions d’éclairage', ['eclairage', 'lumiere'])
    ],
    competences_comportementales: [CB.reactivite, CB.dispo, CB.equipe, CB.rigueur]
  },
  {
    code: 'charge-decor', job_title: 'Chargé Décor', sous_commission: 'C', nombre_postes: 1,
    min_education_rank: -1, diplome_domaines: ['decoration', 'arts plastiques', 'scenographie', 'menuiserie', 'beaux-arts', 'architecture interieure'],
    experience_domaines: ['decor', 'decorateur', 'scenographe', 'plateau', 'menuiserie'],
    competences_techniques: [
      c('Scénographie et décor de plateau', ['decor', 'decors', 'scenographie', 'decorateur', 'plateau'], true, 2),
      c('Construction, menuiserie, peinture', ['menuiserie', 'construction', 'peinture', 'staff']),
      c('Conception (croquis, 3D)', ['croquis', 'sketchup', '3d', 'conception', 'autocad'])
    ],
    competences_comportementales: [CB.creativite, CB.rigueur, CB.equipe]
  },
  // =================== D — ADMINISTRATION ET PERSONNEL D'APPUI ===================
  {
    code: 'assistante-direction', job_title: 'Assistante de Direction', sous_commission: 'D', nombre_postes: 1,
    min_education_rank: 2, diplome_domaines: ['secretariat', 'assistanat de direction', 'assistant de direction', 'bureautique', 'gestion', 'communication'],
    experience_domaines: ['assistante de direction', 'assistant de direction', 'assistante administrative', 'assistant administratif', 'assistante executive', 'secretaire', 'secretariat', 'secretaire de direction'],
    competences_techniques: [
      c('Gestion d’agenda, courrier et accueil', ['agenda', 'courrier', 'accueil', 'standard', 'rendez-vous'], true, 2),
      c('Rédaction administrative', ['redaction administrative', 'comptes rendus', 'proces-verbaux', 'correspondance', 'notes de service']),
      c('Bureautique', ['word', 'excel', 'powerpoint', 'outlook', 'bureautique']),
      c('Classement et archivage', ['classement', 'archivage']),
      c('Organisation de réunions et missions', ['reunions', 'missions', 'voyages', 'organisation'])
    ],
    competences_comportementales: [CB.discretion, CB.organisation, CB.communication, CB.dispo]
  },
  {
    code: 'secretaire', job_title: 'Secrétaires', sous_commission: 'D', nombre_postes: 2,
    min_education_rank: 2, diplome_domaines: ['secretariat', 'bureautique', 'assistanat', 'gestion'],
    experience_domaines: ['secretaire', 'secretariat', 'assistante', 'accueil'],
    competences_techniques: [
      c('Secrétariat et accueil', ['secretariat', 'secretaire', 'accueil', 'standard', 'courrier'], true, 2),
      c('Saisie et rédaction administrative', ['saisie', 'redaction', 'correspondance', 'comptes rendus']),
      c('Bureautique', ['word', 'excel', 'bureautique', 'outlook']),
      c('Classement et archivage', ['classement', 'archivage'])
    ],
    competences_comportementales: [CB.discretion, CB.organisation, CB.communication, CB.ponctualite]
  },
  {
    code: 'archiviste', job_title: 'Archiviste', sous_commission: 'D', nombre_postes: 1,
    min_education_rank: 2, diplome_domaines: ['archivistique', 'archives', 'documentation', 'bibliotheconomie', 'sciences de l information documentaire'],
    experience_domaines: ['archiviste', 'archives', 'documentaliste', 'documentation'],
    competences_techniques: [
      c('Archivage physique et numérique / GED', ['archivage', 'archives', 'gestion documentaire', 'ged', 'archiviste'], true, 2),
      c('Classement et indexation', ['classement', 'indexation', 'plan de classement', 'thesaurus']),
      c('Archives audiovisuelles et numérisation', ['archives audiovisuelles', 'numerisation', 'mediatheque', 'videotheque']),
      c('Conservation préventive', ['conservation', 'preservation'])
    ],
    competences_comportementales: [CB.rigueur, CB.organisation, CB.discretion]
  },
  {
    code: 'maquilleuse', job_title: 'Maquilleuse', sous_commission: 'D', nombre_postes: 1,
    min_education_rank: -1, diplome_domaines: ['esthetique', 'maquillage', 'coiffure', 'cosmetique'],
    experience_domaines: ['maquilleuse', 'maquilleur', 'maquillage', 'esthetique', 'coiffure'],
    competences_techniques: [
      c('Maquillage TV / plateau', ['maquillage', 'maquilleuse', 'maquilleur', 'make-up', 'make up'], true, 2),
      c('Coiffure', ['coiffure', 'coiffeuse']),
      c('Hygiène et soins', ['hygiene', 'soins', 'esthetique'])
    ],
    competences_comportementales: [CB.discretion, CB.communication, CB.ponctualite, CB.dispo]
  },
  {
    code: 'agent-liaison', job_title: 'Agents de liaison', sous_commission: 'D', nombre_postes: 2,
    min_education_rank: -1, diplome_domaines: [],
    experience_domaines: ['agent de liaison', 'coursier', 'planton', 'courrier', 'liaison'],
    competences_techniques: [
      c('Gestion et distribution du courrier', ['courrier', 'liaison', 'coursier', 'planton', 'distribution', 'depot'], true, 2),
      c('Connaissance de Bamako et de ses administrations', ['bamako', 'administrations', 'services publics']),
      c('Permis moto / deux-roues', ['permis', 'moto', 'deux-roues', 'deux roues'])
    ],
    competences_comportementales: [CB.ponctualite, CB.discretion, CB.responsabilite]
  },
  {
    code: 'chauffeur', job_title: 'Chauffeurs', sous_commission: 'D', nombre_postes: 2,
    min_education_rank: -1, diplome_domaines: [],
    experience_domaines: ['chauffeur', 'conducteur', 'conduite', 'transport'],
    competences_techniques: [
      c('Permis de conduire (B, C, D)', ['permis de conduire', 'permis b', 'permis c', 'permis d', 'permis categorie', 'permis'], true, 2),
      c('Conduite et transport de personnel / équipes de tournage', ['chauffeur', 'conduite', 'transport', 'conducteur']),
      c('Entretien courant du véhicule / mécanique de base', ['mecanique', 'entretien vehicule', 'entretien du vehicule', 'vidange']),
      c('Sécurité routière', ['securite routiere', 'code de la route'])
    ],
    competences_comportementales: [CB.ponctualite, CB.discretion, CB.dispo, c('Courtoisie', ['courtoisie', 'courtois', 'politesse'])]
  },
  {
    code: 'assistant-comptable', job_title: 'Assistant Comptable', sous_commission: 'D', nombre_postes: 1,
    min_education_rank: 2, diplome_domaines: ['comptabilite', 'gestion', 'finance', 'comptable'],
    experience_domaines: ['comptable', 'comptabilite', 'aide comptable', 'caissier'],
    competences_techniques: [
      c('Comptabilité générale SYSCOHADA', ['comptabilite', 'syscohada', 'saisie comptable', 'ecritures comptables', 'comptable'], true, 2),
      c('Rapprochements bancaires', ['rapprochement bancaire', 'rapprochements bancaires', 'banque']),
      c('Logiciels comptables', ['sage', 'saari', 'tompro', 'excel']),
      c('Déclarations fiscales et sociales', ['declarations', 'fiscalite', 'tva', 'inps']),
      c('Caisse et pièces justificatives', ['caisse', 'pieces justificatives', 'justificatifs'])
    ],
    competences_comportementales: [CB.rigueur, CB.integrite, CB.discretion, CB.organisation]
  },
  {
    code: 'assistant-logistique', job_title: 'Assistant logistique', sous_commission: 'D', nombre_postes: 1,
    min_education_rank: 2, diplome_domaines: ['logistique', 'gestion', 'transport', 'achats', 'commerce'],
    experience_domaines: ['logistique', 'magasinier', 'achats', 'approvisionnement', 'stock'],
    competences_techniques: [
      c('Gestion des stocks et inventaires', ['stocks', 'stock', 'inventaire', 'magasin', 'magasinier'], true, 2),
      c('Achats et commandes', ['achats', 'commandes', 'bons de commande', 'fournisseurs', 'proformas', 'pro forma']),
      c('Logistique et approvisionnement', ['logistique', 'transport', 'approvisionnement']),
      c('Outils de suivi (Excel, logiciel de stock)', ['excel', 'logiciel de stock', 'tableaux de bord'])
    ],
    competences_comportementales: [CB.rigueur, CB.organisation, CB.integrite, CB.dispo]
  }
];

// Valeurs par défaut des postes ouverts aux ressortissants du Mali (§1.2) :
// l'avis ne fixe que le diplôme → expérience minimale 0 (aucune élimination sur ce critère)
// tant que la Commission ne l'a pas précisée.
for (const p of POSTES) {
  if (!p.categorie) {
    p.categorie = MALI;
    p.lieu = SIEGE;
    p.min_experience_years = p.min_experience_years ?? 0;
    p.max_experience_years = p.max_experience_years ?? null;
    p.langues_requises = p.langues_requises || ['francais'];
    p.source = p.source || 'avis';
    p.a_confirmer = p.a_confirmer ?? true;
    p.mission = p.mission || '';
  }
  p.nationalites_eligibles = p.categorie === MALI ? ['Mali'] : [...PAYS_AES];
  p.regles_elimination = null; // null = règles par défaut
  p.seuils = null;             // null = seuils §14 par défaut
  p.ponderations = null;       // null = pondérations de la sous-commission
  p.max_convoques = null;      // §12 : nombre maximal de candidats à convoquer (facultatif)
  p.min_education_level = labelNiveau(p.min_education_rank);
}

module.exports = {
  NIVEAUX_ETUDES,
  labelNiveau,
  LANGUES,
  PAYS_AES,
  NATIONALITES,
  REGLES_PAR_DEFAUT,
  SEUILS_PAR_DEFAUT,
  SOUS_COMMISSIONS,
  POSTES,
  CATEGORIES: {
    QUOTA_AES: 'Quota de représentation — ressortissants des pays éligibles',
    RESIDENT_MALI: 'Réservé aux ressortissants du pays du siège (Mali)'
  }
};
