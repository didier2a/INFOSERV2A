# Prompt Cursor — Phase 1 : lancer et construire l’Accueil

Tu travailles dans le dépôt INFOSERV2A actuellement ouvert.

## Mission

Construire uniquement la page Accueil à partir de la référence officielle, puis arrêter la mission pour validation.

## Lecture obligatoire

Avant toute modification, lis intégralement :

- `AGENTS.md`
- `site-map.json`
- `docs/01-direction-visuelle.md`
- `docs/02-audit-ux-responsive.md`
- `docs/03-contenus-editoriaux.md`
- `docs/04-navigation-interactions.md`
- `docs/05-acceptance-checklist.md`
- `assets/images/references/01-accueil-reference.png`

Vérifie également que les six autres PNG existent.

Si une source manque, ne développe rien et indique précisément le chemin absent.

## Audit initial

Inspecte le dépôt :

- arborescence ;
- stack existante ;
- état Git ;
- branche courante ;
- fichiers HTML, CSS et JavaScript ;
- mécanisme de preview.

Ne change pas de framework. Si le dépôt est vide, utilise HTML, CSS et JavaScript natifs.

## Objectif

Créer ou stabiliser :

- `index.html`
- les styles communs ;
- la navigation desktop et mobile ;
- les cartes de navigation ;
- le système de cartes extensibles ;
- le footer ;
- le système de calque `?ref=1`.

L’Accueil doit devenir la matrice graphique des six autres pages.

## Exigences visuelles

- Respecter la composition du PNG.
- Conserver la direction bleu nuit / cyan.
- Augmenter l’aération de 20 à 30 %.
- Ne pas afficher toutes les cartes secondaires simultanément.
- Ne pas utiliser le PNG comme page.
- Utiliser du vrai HTML, du CSS maintenable et du JavaScript léger.

## Exigences éditoriales

Utilise exactement les textes de la section Accueil dans `docs/03-contenus-editoriaux.md`.

Ne crée aucun lorem ipsum, faux numéro, fausse statistique ou texte de remplissage.

## Navigation

Préparer les sept liens :

- Accueil
- Assistance
- Réseaux & Wi-Fi
- Vidéosurveillance
- Sites web
- À propos
- Contact

Les six pages suivantes peuvent ne pas encore exister, mais les destinations doivent être correctes.

## Comparaison

1. Lance le serveur local.
2. Analyse les dimensions réelles du PNG.
3. Ouvre l’Accueil au viewport de référence.
4. Active `?ref=1`.
5. Compare réellement le rendu.
6. Effectue au moins deux passes de correction :
   - structure, hauteur, largeur, grilles ;
   - espacements, typographie, cartes et détails.

## Responsive

Tester :

- viewport du PNG ;
- 1440 px ;
- 1024 px ;
- 768 px ;
- 390 px.

## Fin de mission

À la fin, indique :

- fichiers créés ;
- fichiers modifiés ;
- commande de preview ;
- URL normale ;
- URL avec `?ref=1` ;
- tests réalisés ;
- écarts restant à corriger.

ARRÊTE-TOI APRÈS L’ACCUEIL. Ne construis pas les six autres pages avant validation explicite.
