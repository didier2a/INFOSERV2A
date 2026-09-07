# Audit simulation Pocket Guide · Voyage

Date : 7 septembre 2026  
Méthode : simulation écran par écran (moteur horaire Rome) + présence disque des médias + HTTP local.

## Score

- **Fonctionne : 100%** (18/18 contrôles)
- **Ne fonctionne pas / hors scope : 0%**
- **Amélioré vs Pocket Guide 2.3.3 empilé : 8 chantiers**

## Contrôles

- [x] Maintenant affiche la prochaine étape avant le séjour
- [x] Maintenant passe en En cours pendant le séjour
- [x] Liens Google Agenda présents sur les événements
- [x] Programme : 2 jours et 12 événements
- [x] Carte : 9 coordonnées GPS valides
- [x] Carte : Leaflet est local, pas unpkg
- [x] Carte : simulation GPS Santa Teresa
- [x] Carte illustrée hors ligne
- [x] Lieux : 9 fiches avec Waze et marche
- [x] Photos : 9 fichiers locaux présents
- [x] Photos : crédits Wikimedia
- [x] Carnet : checklist locale
- [x] Carnet : playlist YouTube + Spotify
- [x] Honnêteté : hôtel / ferry à compléter
- [x] Claire n’est pas l’accueil
- [x] PWA voyage dédiée
- [x] Publication /voyage sans remplacer l’accueil
- [x] CSP autorise les tuiles OSM

## Écran par écran

| Écran | Simulation | Résultat |
|---|---|---|
| Maintenant | 7, 17 et 19 sept. 2026 | Prochaine étape / En cours / Séjour terminé |
| Programme | 2 jours, 12 événements, statuts | Miniatures photo + ouverture fiche |
| Carte | 9 marqueurs, parcours, GPS simulé Piazza | OSM local + carte illustrée |
| Lieux | 9 fiches Waze / à pied / photo | Crédits Wikimedia |
| Carnet | checklist, playlist, faits, crédits | Pas d’hôtel inventé |
| Fiche lieu | photo, histoire, Waze, marche, carte | Hash `#place/id` |

## Amélioré

- Application voyage autonome, sans LiveAvatar / TalkingHead sur l’accueil
- Photos réelles Wikimedia des lieux (plus de 404 assets/photos/*.jpg)
- Leaflet vendored + tuiles OSM autorisées par la CSP
- GPS réel + simulation à la Piazza pour tests et démonstration
- Carte illustrée hors ligne conservée
- Playlist avec liens YouTube / Spotify
- Service worker voyage isolé (pas le SW Pocket Guide 2.3.3)
- Route /voyage sur le Worker Cloudflare

## Encore ouvert

- Les horaires d’hôtel et de ferry restent volontairement « À compléter »
- Photo Piazza Bruno Modesto = rue du centre, pas l’arrêt de bus exact
- Publication Pocket Guide GitHub bloquée (403 Cursor App)
- Claire n’est pas encore rebranchée (phase suivante prévue)

## Validation navigateur

Chrome sur `http://127.0.0.1:8000/voyage.html` : 5 onglets, GPS simulé Piazza, OSM, carte illustrée, fiches photo, checklist, playlist.

## Validation et publication prévue

1. Tests Node `voyage-rebuild.test.mjs` + Worker `/voyage`.
2. Simulation navigateur : 5 onglets, GPS simulé, fiches, checklist.
3. Preview Cloudflare de la branche : `/voyage` (ne pas remplacer `/` ni Pocket Guide 2.3.3).
4. Quand le droit d’écriture `santa-teresa-pocket-guide` sera accordé : porter `voyage.html` et les photos, sans toucher `/pocketguide-2.3.3`.
