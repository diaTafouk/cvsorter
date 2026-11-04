# Présélection des candidatures — mode d'emploi technique

## Mise en place (une seule fois, puis à chaque évolution du schéma)

```bash
cd cv-sorter-backend
npm run db:migrate        # crée/complète les tables + charge les 36 postes officiels
npm run test:engine       # tests du moteur (sans base de données)
npm run dev
```

`npm run db:seed:force` réécrit les postes **non verrouillés** avec la fiche officielle
(à utiliser après une mise à jour de `src/data/referentiel.js`).

## Ce qui a été intégré (sources : avis, fiches de poste, TdR de la Commission)

| Élément | Source | Où |
|---|---|---|
| 22 postes siège (quota de représentation), 3 Mooré (Ouaga), 3 Haoussa (Niamey), 36 postes ressortissants Mali | Avis §1.1 / §1.2 | `referentiel.js` → `job_criteria` |
| Diplôme minimum + domaines, années d'expérience | Avis (tableau diplômes/expérience) | `min_education_rank`, `diplome_domaines`, `min/max_experience_years` |
| Profil proposé, compétences techniques & comportementales | Fiches de poste | `competences_techniques`, `competences_comportementales` |
| Sous-commissions A–D et périmètres | TdR §6, §10 | table `sous_commissions` |
| Conditions générales (âge ≥ 18, nationalité éligible, diplôme, langues) | TdR §7 | `regles_elimination` |
| Seuils 70 / 60 | TdR §14 | `seuils` |
| Nombre maximal de convoqués | TdR §12 | `max_convoques` |
| Départage des ex æquo | TdR §17 | classement côté API |
| Verrouillage des critères + historique des versions | TdR §9.3, §13 | `verrouille`, `criteria_history` |

**Non utilisé volontairement :** le barème 15/20/40/20/5 (§13), qui note les épreuves et l'entretien de la 2ᵉ étape.

## Comment un dossier est traité

1. **Recevabilité** — chaque règle est soit *éliminatoire* (→ « Non recevable »), soit *à vérifier* (signalement).
   Quand une information est introuvable dans le CV (diplôme non identifiable, expérience non datée, CV scanné),
   le dossier est **signalé** et non éliminé, pour ne pas écarter un candidat à tort.
2. **Grille uniforme** (0–100 par critère, pondérée par sous-commission ou par poste) :
   diplôme (niveau 70 % + domaine 30 %), expérience (années 70 % + pertinence 30 %),
   compétences techniques, comportementales, langues.
3. **Décision** — ≥ 70 Présélectionné · 60–69,99 Liste de réserve · < 60 Non retenu.
4. **Classement par poste** — note, puis expérience directement liée au poste, expérience totale,
   compétences techniques, formation.

Chaque point est justifié par un extrait du CV (visible dans la fiche détaillée du candidat).

## Améliorer en continu

- Ajouter des mots-clés / compétences depuis l'interface « Configuration IA » (versionné en base).
- Quand un CV réel est mal évalué : ajouter un cas dans `scripts/testEngine.js`, corriger, relancer les tests.
- Bouton « Réévaluer » : recalcule les CVs déjà importés avec les critères en vigueur.
- Postes marqués « à confirmer » : compétences proposées à partir de l'avis faute de fiche complète — à valider par la sous-commission.

## CV en photo et PDF scannés (OCR local)

```bash
npm install            # installe tesseract.js et pdf-to-img (déclarés dans package.json)
```

- Formats lus : PDF texte, PDF scanné, DOCX, JPG/PNG/WEBP/TIFF/BMP. Non pris en charge : .doc (ancien Word) et HEIC (photo iPhone) → message d'erreur explicite.
- Un PDF contenant moins de 200 caractères de texte est traité comme scanné : ses pages (5 max, `OCR_MAX_PAGES`) passent à l'OCR.
- Modèles français + anglais fournis dans `ocr-data/` : aucune donnée ne quitte la machine, aucun téléchargement.
- Tout dossier lu par OCR est marqué « à vérifier » (nom, dates, diplômes à contrôler sur l'original).

## Langues et règles ajoutées par la Commission (migration 005)

- **Langues reconnues** (table `langues`) : ajout / suppression depuis Configuration IA, avec les termes de détection
  (variantes d'écriture). Une langue exigée par un poste ou une règle ne peut pas être supprimée.
- **Conditions de recevabilité / règles d'élimination** (table `regles_personnalisees`), portée : ce poste, sa
  sous-commission ou tous les postes ; mode éliminatoire ou « à vérifier ». Types : terme exigé, terme exclu, âge maximum,
  expérience totale minimale, expérience liée minimale, niveau d'études minimum, langue exigée, note minimale sur un critère.
- Une règle dont l'information est absente du CV (âge, diplôme) ne fait pas éliminer : le dossier est signalé « à vérifier ».
