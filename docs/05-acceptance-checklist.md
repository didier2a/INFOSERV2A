# 05 — Critères d’acceptation

Une page n’est pas validée tant que les points suivants ne sont pas vérifiés.

## Sources

- Le PNG correspondant a été lu.
- Le contenu canonique de `docs/03-contenus-editoriaux.md` a été utilisé.
- Aucun faux texte du PNG n’a été recopié.
- Aucun chiffre ou engagement n’a été inventé.

## Fidélité

- Structure générale conforme.
- Ordre des sections conforme.
- Hero fidèle à l’atmosphère de la référence.
- Largeur des conteneurs cohérente.
- Espacement vertical augmenté sans dénaturer le design.
- Typographie et contrastes cohérents.
- Cartes et CTA visuellement homogènes.

## Contenu

- Aucun lorem ipsum.
- Aucun texte provisoire.
- Tous les boutons ont une destination réelle.
- Les textes visibles sont concis.
- Les textes détaillés sont accessibles par déploiement ou page dédiée.
- Coordonnées officielles exactes.
- Copyright 2026.

## Navigation

- Header commun.
- Onglet actif correct.
- Menu mobile fonctionnel.
- Navigation clavier fonctionnelle.
- Cartes entièrement cliquables lorsqu’elles naviguent.
- Cartes extensibles accessibles.
- Paramètres de Contact lus correctement.

## Responsive

Tester au minimum :

- largeur de référence du PNG ;
- 1440 px ;
- 1024 px ;
- 768 px ;
- 390 px.

Vérifier :

- aucun débordement horizontal ;
- aucun texte coupé ;
- aucune image disproportionnée ;
- CTA tactiles ;
- formulaire en une colonne sur mobile ;
- footer lisible ;
- accordéons et carrousels utilisables au clavier.

## Technique

- Pas d’erreur console.
- Pas de lien cassé.
- Pas de ressource 404.
- Calque de référence invisible par défaut.
- Calque activable avec `?ref=1`.
- `prefers-reduced-motion` pris en charge.
- HTML sémantique.
- Un seul H1 par page.
- Meta title et description uniques.

## Validation finale

Créer une capture du rendu et comparer visuellement au PNG. Corriger au moins deux passes : macro-structure, puis détails.
