# 04 — Navigation, cartes et interactions

## Navigation principale

Ordre exact :

1. Accueil → `index.html`
2. Assistance → `assistance.html`
3. Réseaux & Wi-Fi → `reseaux-wifi.html`
4. Vidéosurveillance → `videosurveillance.html`
5. Sites web → `sites-web.html`
6. À propos → `a-propos.html`
7. Contact → `contact.html`

CTA du header :

**Demander un diagnostic** → `contact.html?demande=diagnostic`

## Header

- Sticky.
- Hauteur approximative : 72 à 84 px.
- Fond bleu nuit semi-transparent.
- Flou discret.
- Bordure basse très fine.
- Onglet actif signalé en cyan.
- Logo officiel à gauche.
- CTA à droite.
- Focus clavier visible.

## Menu mobile

- Bouton menu clairement identifiable.
- Panneau latéral ou menu plein écran.
- Liens de 44 px minimum.
- Fermeture par bouton, Échap et clic extérieur.
- `aria-expanded`, `aria-controls` et focus géré correctement.

## Navigation secondaire

Sur les pages longues, créer une navigation interne :

- Solutions
- Cas d’usage
- Méthode
- Contact

Sur mobile, elle peut devenir une barre horizontale défilable.

## Deux composants de cartes

### 1. Carte de navigation

Une carte qui conduit vers une page ou une ancre doit être un lien `<a>` couvrant toute la carte.

Ne pas placer de bouton interactif imbriqué dans un lien interactif.

### 2. Carte extensible

Une carte qui révèle plus d’information doit être fondée sur `<details>` et `<summary>` ou un composant accessible équivalent.

La carte fermée affiche :

- icône ;
- titre ;
- texte court ;
- indicateur « En savoir plus ».

La carte ouverte affiche :

- texte développé ;
- bénéfices ou éléments de réalisation ;
- CTA vers Contact ou une page dédiée.

## Connexions entre cartes

Chaque service peut proposer des liens « Voir aussi » :

- Assistance messagerie → Sauvegardes, Sites web, Sécurisation des comptes.
- Wi-Fi professionnel → Vidéosurveillance, Starlink, Sites isolés.
- Starlink → Réseau de secours, Villas, Campings.
- Vidéosurveillance → Wi-Fi, Stockage, Accès distant.
- Site vitrine → Maintenance web, Messagerie, Assistance.
- Locations saisonnières → Wi-Fi, Vidéosurveillance, Site web.

## Mapping depuis l’Accueil

- Assistance à distance → `assistance.html`
- Réseaux & Wi-Fi → `reseaux-wifi.html`
- Vidéosurveillance → `videosurveillance.html`
- Sites web → `sites-web.html`
- Hôtellerie → `contact.html?secteur=hotellerie`
- Commerces → `contact.html?secteur=commerces`
- Associations → `contact.html?secteur=associations`
- Locations saisonnières → `contact.html?secteur=locations-saisonnieres`

## Paramètres de Contact

La page Contact doit lire :

- `?service=`
- `?secteur=`
- `?demande=`

Elle doit sélectionner automatiquement le type de besoin approprié et déplacer le focus vers le formulaire si l’utilisateur vient d’une carte.

## Transitions

- 160 à 280 ms pour les interactions.
- Déplacement vertical maximal de 3 à 5 px.
- Halo et bordure renforcés au survol.
- Pas d’animation permanente envahissante.
- Respecter `prefers-reduced-motion`.
