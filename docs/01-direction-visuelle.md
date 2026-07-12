# 01 — Direction visuelle

## Identité générale

Le site doit conserver fidèlement l’univers des sept maquettes :

- fond bleu nuit profond ;
- cyan électrique et turquoise ;
- blanc légèrement bleuté ;
- cartes sombres semi-transparentes ;
- bordures fines lumineuses ;
- halos modérés ;
- illustrations technologiques ;
- cartographie du Sud Corse ;
- composition premium B2B ;
- typographie moderne, claire et très lisible.

Le design ne doit pas devenir plus coloré, plus ludique ou plus chargé.

## Interdictions

- Aucun orange ou rouge dominant.
- Aucun hacker à capuche.
- Aucun univers anxiogène.
- Aucun rendu de jeu vidéo.
- Aucun excès de particules, de lueurs ou d’animations permanentes.
- Aucun logo recréé à partir des maquettes.
- Aucun faux tableau de bord présenté comme une donnée réelle.
- Aucune statistique commerciale non vérifiée.

## Design tokens recommandés

```css
:root {
  --color-bg: #020814;
  --color-bg-secondary: #06152a;
  --color-bg-tertiary: #091d36;
  --color-card: rgba(8, 24, 46, 0.78);
  --color-card-strong: rgba(10, 34, 64, 0.92);
  --color-border: rgba(0, 220, 255, 0.22);
  --color-border-strong: rgba(18, 247, 255, 0.45);
  --color-cyan: #00d9f5;
  --color-cyan-bright: #12f7ff;
  --color-blue: #148cff;
  --color-text: #f4f8ff;
  --color-text-muted: #a8b7c9;
  --color-text-soft: #6f8195;
  --container-width: 1240px;
  --header-height: 80px;
  --radius-sm: 12px;
  --radius-md: 20px;
  --radius-lg: 28px;
  --radius-pill: 999px;
}
```

## Principes de composition

- Hero en deux colonnes sur grand écran.
- Texte du hero limité à environ 620–660 px.
- Conteneur principal entre 1200 et 1280 px.
- Une section = une idée principale.
- Une carte = un besoin, un bénéfice ou une action.
- Les illustrations soutiennent le contenu sans le remplacer.
- Les sections narratives doivent respirer davantage que dans les PNG.
