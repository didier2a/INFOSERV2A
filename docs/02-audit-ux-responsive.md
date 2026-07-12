# 02 — Audit UX, aération et responsive

## Diagnostic

Les maquettes sont visuellement très fortes, mais trop d’informations sont visibles simultanément pour une utilisation web confortable. La direction artistique doit être conservée, tandis que la densité visible doit être réduite d’environ 20 à 30 %.

## Aération

Valeurs recommandées :

```css
:root {
  --section-space-desktop: clamp(96px, 8vw, 128px);
  --section-space-tablet: 72px;
  --section-space-mobile: 56px;
  --grid-gap-desktop: 28px;
  --grid-gap-mobile: 18px;
  --card-padding-desktop: 28px;
  --card-padding-mobile: 20px;
}
```

- Entre grandes sections : 96 à 120 px sur ordinateur.
- Sur tablette : environ 72 px.
- Sur mobile : 52 à 64 px.
- Éviter l’empilement de plusieurs bandeaux de cartes sans respiration.
- Limiter la largeur des introductions à environ 720 px.
- Ne pas remplir artificiellement les espaces avec du texte.

## Réduction de densité

Sur ordinateur :

- afficher trois ou quatre cartes prioritaires ;
- déployer les cartes complémentaires avec « Voir toutes les solutions » ;
- conserver les étapes de méthode ouvertes si elles sont courtes.

Sur mobile :

- afficher deux ou trois cartes prioritaires ;
- placer le reste dans des accordéons accessibles ;
- éviter une page composée de dix grandes cartes ouvertes ;
- conserver une seule colonne pour les cartes descriptives.

## Responsive

### Grand écran — 1200 px et plus

- Hero en deux colonnes.
- Grilles de trois ou quatre cartes maximum.
- Illustrations complètes.
- Espacements généreux.

### Tablette — 768 à 1199 px

- Grilles de deux colonnes.
- Hero en deux colonnes uniquement si la lisibilité reste excellente.
- Navigation principale remplacée par le menu mobile avant compression.
- Illustrations secondaires simplifiées.

### Mobile — moins de 768 px

- Hero en une colonne, texte avant l’image.
- Une carte par ligne.
- CTA pleine largeur lorsque nécessaire.
- Aucun débordement horizontal.
- Aucun texte inférieur à 15–16 px.
- Formulaire en une seule colonne.
- Footer empilé.
- Carte du territoire simplifiée.
- Les longs groupes de cartes deviennent accordéons ou carrousels horizontaux accessibles.

## Audit par page

### Accueil

- Conserver le hero, les quatre services, l’ancrage local et le CTA final.
- Afficher trois secteurs prioritaires, puis « Voir tous les secteurs ».
- Espacer davantage Services, Pourquoi INFOSERV2A et Secteurs.
- Raccourcir les textes de cartes.
- Conserver la carte du Sud Corse.

### Assistance

- Afficher quatre besoins principaux.
- Déployer deux besoins complémentaires.
- Conserver les quatre étapes d’intervention.
- Faire des cas d’usage de vraies cartes de navigation.

### Réseaux & Wi-Fi

- Six solutions possibles en grille 3 × 2 sur ordinateur.
- Déploiements types en carrousel ou liste horizontale sur mobile.
- Réduire les avantages à trois ou quatre éléments.
- Supprimer les micro-badges sur mobile s’ils nuisent à la lisibilité.

### Vidéosurveillance

- Quatre prestations prioritaires visibles.
- Deux prestations complémentaires extensibles.
- Fonctionnalités clés sous forme de bandeau léger.
- Environnements protégés comme cartes navigantes.

### Sites web

- Séparer Création et Maintenance.
- Éviter six grandes cartes ouvertes au même niveau.
- Mettre en avant un exemple ou une réalisation.
- Conserver les profils clients, mais réduire les descriptions.

### À propos

- Page particulièrement aérée.
- Remplacer les chiffres non vérifiés par des preuves qualitatives.
- Mettre en avant la mission, les valeurs et l’ancrage local.

### Contact

- Formulaire avant les coordonnées sur mobile.
- Une seule colonne.
- Sujet prérempli selon la carte d’origine.
- Carte du territoire simplifiée sur petit écran.

## Mouvement

```css
:root {
  --motion-fast: 160ms;
  --motion-normal: 240ms;
  --motion-slow: 380ms;
}
```

Animations autorisées :

- soulignement du menu ;
- légère montée de carte de 3 à 5 px ;
- renforcement de bordure ;
- ouverture douce des accordéons ;
- apparition légère des sections ;
- halo modéré.

Prévoir obligatoirement `prefers-reduced-motion`.
