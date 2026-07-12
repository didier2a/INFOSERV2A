# INFOSERV2A — Pack Cursor Blueprint V1

Ce pack rassemble les trois sources nécessaires à la fabrication du site :

1. **Références visuelles** : les sept PNG dans `assets/images/references/`.
2. **Audit UX / responsive** : règles d’aération, cartes extensibles, navigation et comportement mobile.
3. **Corpus éditorial** : textes concis et définitifs pour les sept pages.

## Installation

Décompressez le contenu du pack à la racine du dépôt local INFOSERV2A.

Structure attendue :

```text
INFOSERV2A/
├── AGENTS.md
├── site-map.json
├── .cursor/rules/01-infoserv2a.mdc
├── docs/
├── prompts/
└── assets/images/references/
```

Avant de remplacer un fichier `AGENTS.md` existant, faites-en une copie.

## Utilisation dans Cursor

1. Ouvrir la racine du dépôt dans Cursor.
2. Vérifier que les sept PNG apparaissent dans `assets/images/references/`.
3. Ouvrir le chat Cursor en mode Plan.
4. Coller le contenu de `prompts/01-lancement-accueil.md`.
5. Valider le plan, puis laisser Cursor construire uniquement l’Accueil.
6. Vérifier l’Accueil avec le calque `?ref=1`.
7. Après validation, coller `prompts/02-suite-pages.md`.
8. Construire et valider les pages une par une.
9. Utiliser `prompts/03-correction-page.md` pour chaque retouche ciblée.
10. Terminer avec `prompts/04-finalisation.md`.

## Principe industriel

**Un PNG = une page = un plan = une comparaison réelle = une validation.**

Ne demandez pas à Cursor de produire les sept pages en une seule passe aveugle.
