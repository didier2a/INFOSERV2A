# Reconstruction de l’application de voyage

Date : 7 septembre 2026  
Dépôt : `didier2a/santa-teresa-pocket-guide`  
Surface : `/voyage.html` sur InfoServ2A — **sans avatar Claire**

Le GitHub App Cursor de cet agent n’a pas le droit d’écriture sur `didier2a/santa-teresa-pocket-guide` (403). La reconstruction voyage est donc publiée ici, avec les mêmes données `trip.json`.

## 1. Ce qu’est Pocket Guide aujourd’hui

Pocket Guide n’est plus une seule application. C’est une pile de PWA :

| Génération | Entrée | Rôle |
|---|---|---|
| V1 / V4B / V1.5 | `index.html` → `pocketguide-15.html` | Agenda, carte, lieux, GPS, AR, carnet |
| V1.6–V1.8 | `pocketguide-16.html` … `18.html` | Guide humaine, marche, journal local |
| V2.1–V2.3.2 | `pocketguide-v21.html` … `v23.html` | 3 onglets Compagnon / Voyage / Mes voyages + Claire 3D |
| **V2.3.3 production** | `/pocketguide-2.3.3` | LiveAvatar + routeur de commandes sur la même pile |

La production actuelle **mélange voyage et avatar**. Claire (voix `marin`, LiveAvatar ou TalkingHead) occupe l’accueil. Le voyage (itinéraire, carte, POI) est un onglet secondaire.

## 2. Décision de reconstruction

Avant de rebrancher Claire, l’application de voyage doit exister seule :

- source de vérité : `data/trip.json` (17–18 septembre 2026, Santa Teresa di Gallura) ;
- cinq espaces : Maintenant, Programme, Carte, Lieux, Carnet ;
- OSM + Leaflet, Waze, liens Google Agenda existants ;
- checklist locale ; pas d’hôtel / ferry inventés (`À compléter`) ;
- aucun runtime LiveAvatar, TalkingHead, `pg23` ou `pg233` ;
- un emplacement `data-slot="claire-later"` pour la phase suivante.

`/pocketguide-2.3.3` n’est pas remplacé.

## 3. Schémas Figma

Le board Claire InfoServ2A (`y0THPsd9vQF5zF8Twf34a0`) décrit l’aidante du site, pas le séjour. Les schémas voyage ont été posés à part :

- [Architecture](https://www.figma.com/board/bWqGR15O4vbk7fqgrjI2Jw)
- [Parcours d’écrans](https://www.figma.com/board/uNYNSeYH9niAqK0NKKkrJq)
- [Modèle `trip.json`](https://www.figma.com/board/7tgmcU2M4HDcv1vlmg4Sv5)

## 4. Phase 2 — Claire

Quand le voyage est stable : brancher l’avatar InfoServ2A (même LiveAvatar, voix `marin`) dans `#app[data-claire]` / `.claire-slot`, sans en faire l’écran d’accueil. Le voyage reste la source de vérité ; Claire narre et ouvre les vues.

## 5. Médias, GPS, audit

Photos Wikimedia Commons des 9 lieux, Leaflet local, tuiles OSM, GPS réel + simulation Piazza, carte illustrée hors ligne, playlist YouTube/Spotify, PWA `voyage-sw.js`.

Audit écran par écran : `docs/VOYAGE_SIMULATION_AUDIT.md`.
