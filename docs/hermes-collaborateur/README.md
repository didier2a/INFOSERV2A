# InfoServ2A — dossier directeur du collaborateur virtuel Hermes

**Version : 1.0 · Date : 7 septembre 2026 · Destinataires : Didier, Cursor et Codex.**

## Intention

Organiser une collaboration durable entre Didier et Hermes, depuis le poste de travail Cursor, avec Claire comme interface vocale et visuelle, et un accès coordonné au cloud, au PC Windows et au NAS OpenMediaVault sur Raspberry Pi 4. Tous les métiers d'InfoServ2A bénéficient de cette collaboration ; la mise en œuvre progresse par lots vérifiables.

Hermes doit connaître les projets, retrouver les bonnes pièces, conserver les décisions et réutiliser les méthodes de Didier. Il reçoit des missions, agit avec les outils configurés, vérifie les résultats et rend compte. Cursor demeure le poste de développement et de supervision. Les applications métier conservent l'autorité sur leurs données : Abby sur ses documents comptables, l'agenda choisi sur les rendez-vous, Git sur le code et le NAS sur les fichiers qui y sont conservés.

## Statut du livrable

La documentation est rédigée à partir de cette conversation, de sources officielles et d'une lecture ciblée du dépôt `didier2a/INFOSERV2A` au commit `b2d87534996931ae89b8934439739a03b5bc4933`. Cette lecture n'est pas un audit complet de production. Aucun compte tiers, NAS, PC ou VPS n'a été configuré au cours de la rédaction.

Les chapitres distinguent **déclaré**, **observé dans le dépôt**, **documenté par l'éditeur**, **proposé**, **à vérifier** et **recetté**. Un outil documenté par son éditeur n'est pas nécessairement disponible dans l'abonnement de Didier ou authentifié dans Hermes.

## Parcours de lecture

| Chapitre | Objet |
|---|---|
| [00 — Lire en premier](00-LIRE-EN-PREMIER.md) | Instructions de reprise et principes pour Cursor |
| [01 — Vision et collaboration](01-vision-et-collaboration.md) | Rôle du collaborateur et objectifs de l'entreprise |
| [02 — Existant et inconnues](02-existant-et-inconnues.md) | Preuves, inventaire, contradictions à résoudre |
| [03 — Toutes les activités](03-catalogue-des-activites.md) | Matrice complète des domaines métier |
| [04 — Architecture générale](04-architecture-generale.md) | Services, échanges, autorités et scénarios de panne |
| [05 — VPS, PC, NAS et réseau](05-infrastructure-vps-pc-nas.md) | Implantation technique et accès local/distant |
| [06 — Mémoire et documentation](06-memoire-et-connaissance.md) | Mémoire, index, provenance et apprentissage |
| [07 — Cursor et Codex](07-cursor-codex-et-developpement.md) | Poste de travail, missions et coordination du code |
| [08 — Claire](08-claire-collaboratrice.md) | Voix, avatar, site, espace privé et orchestration |
| [09 — Clients et rendez-vous](09-clients-agenda-communications.md) | Prospection, agenda, mail et relation client |
| [10 — Abby et comptabilité](10-abby-devis-factures-comptabilite.md) | Devis, factures, achats, encaissements et clôture |
| [11 — Sites et logiciels](11-sites-et-applications.md) | Usine de projets, livraison et maintenance |
| [12 — Terrain, réseau et cyber](12-interventions-reseau-cyber.md) | Diagnostic, interventions, équipements et assistance |
| [13 — Communication et médias](13-communication-medias-formation.md) | SEO, contenus, production vidéo, formation |
| [14 — Contrats et données](14-contrats-api-et-donnees.md) | API internes proposées et modèle de données |
| [15 — Autonomie et accès](15-autonomie-acces-et-confidentialite.md) | Délégations, séparation des clients, secrets et traces |
| [16 — Exploitation](16-exploitation-et-continuite.md) | Surveillance, sauvegardes et restauration |
| [17 — Budget et valeur](17-budget-et-valeur.md) | Coût total, mesures et scénarios illustratifs |
| [18 — Plan de réalisation](18-plan-de-realisation.md) | Lots, dépendances, backlog et critères de sortie |
| [19 — Recette](19-recette-et-preuves.md) | Tests métier et techniques, preuves attendues |
| [20 — Procédures techniques](20-procedures-techniques.md) | Inventaires et étapes d'installation à adapter |
| [21 — Décisions](21-decisions-architecture.md) | Registre des choix et conditions de révision |
| [22 — Sources](22-sources-et-verifications.md) | Références officielles et limites des vérifications |
| [23 — Consignes prêtes à reprendre](23-prompts-de-reprise.md) | Missions initiales à transmettre à Cursor |
| [24 — Journée et scénarios](24-scenarios-de-collaboration.md) | Exemples de collaboration de bout en bout |
| [25 — Poste de pilotage](25-poste-de-pilotage.md) | Écrans, interactions et états opérationnels |

## Annexes utilisables par Cursor

Le dossier comprend 26 chapitres numérotés, un catalogue de 29 capacités proposées, 84 exigences reliées à 60 scénarios de recette et des modèles de reprise. Les scénarios portent tous le statut `not_run` : leur présence prépare l'implémentation et ne revendique pas son succès.

- [Registre des exigences](annexes/exigences.csv) : identifiants, lots, preuves et critères.
- [Scénarios de recette](annexes/recette.csv) : tests à convertir en vérifications exécutables.
- [Inventaire à compléter](annexes/inventaire.template.json).
- [Catalogue des capacités proposé](annexes/capabilities.template.json).
- [MCP Cursor de référence](annexes/cursor-mcp.example.json) : exemple non activé.
- [Contrat JSON d'une mission](annexes/mission.schema.json) et [mission fictive](annexes/mission.example.json).
- [Structure de données SQL proposée](annexes/modele-donnees.sql).
- [Fiche projet](annexes/projet.template.md), [fiche procédure](annexes/procedure.template.md) et [compte rendu de mission](annexes/compte-rendu.template.md).

## Définition de la réussite

Une demande reçue dans Cursor ou par Claire peut être rattachée au bon client, éclairée par la documentation autorisée, transformée en mission puis réalisée et vérifiée. La décision et le résultat restent retrouvables lors d'une autre session. Une même demande rejouée ne produit pas deux rendez-vous, deux factures ou deux publications.

L'objectif est une réduction mesurée des répétitions et du temps administratif, avec une continuité entre toutes les activités. Aucune économie d'heures ni autonomie complète n'est présentée comme acquise avant mesure.
