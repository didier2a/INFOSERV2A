# 11 — Développement de sites et d'applications

## Chaîne de production commune

La chaîne relie un brief, une proposition, un dépôt, un environnement de prévisualisation, des critères de recette et une livraison. Les contenus et décisions restent accessibles dans le projet. Les outils de code reçoivent la version exacte du brief et du modèle de départ.

| Phase | Travail à accomplir | Livrable |
|---|---|---|
| Qualification | Objectifs, publics, langues, pages, fonctions, délai | Brief structuré |
| Cadrage | Périmètre, contenus, dépendances et critères | Cahier de réalisation |
| Préparation | Dépôt, référence du modèle, configuration par client | Projet initial traçable |
| Construction | Contenus, interface, fonctions et intégrations | Commit et prévisualisation |
| Vérification | Parcours, responsive, erreurs, accessibilité utile | Rapport et preuves |
| Livraison | Déploiement, domaine, mesure du résultat | Version mise en ligne identifiée |
| Suivi | Surveillance et modifications contractuelles | Bilan et mises à jour |

## Modèle de site multi-client

Le modèle commun contient les composants et outils réutilisables. Chaque client possède sa configuration, ses contenus, ses médias, ses secrets et son historique. Conserver la version d'origine du modèle et les modifications locales. Une mise à jour du modèle ne doit pas écraser les contenus du client.

Deux stratégies restent possibles : dépôts séparés ou monorepo avec séparation stricte. Choisir après inventaire du nombre de sites, des hébergeurs, des variantes et de l'équipe réelle. Pour un entrepreneur seul, des dépôts séparés avec un modèle versionné sont un point de départ lisible. Un monorepo ne doit pas donner accès à tous les clients à chaque job.

## Publication

Le job de publication connaît le dépôt, le commit, le compte d'hébergement, le projet cible, l'environnement et le domaine. Avant livraison, il vérifie que le changement demandé correspond au bon client. Après livraison, il interroge l'URL et vérifie la version. Les modifications DNS sont traitées séparément de la construction du site, notamment pour préserver les fonctions mail.

Le projet InfoServ2A actuel utilise un Worker avec actifs statiques ; une référence ancienne à Pages ne doit pas conduire à migrer automatiquement l'hébergement. L'adaptateur Cloudflare doit découvrir les ressources réellement en place et conserver l'identifiant du déploiement.

## Maintenance et contrats récurrents

La fiche contrat contient les opérations incluses, délais, limites de temps, nombre de retouches, responsabilité des contenus et procédure de dépassement. Hermes rapproche le temps consommé et les missions du contrat. Une demande importante ouvre une proposition complémentaire au lieu d'être absorbée sans limite dans un forfait.

Routines : vérification de disponibilité, certificat, formulaires, liens essentiels, mises à jour de dépendances utilisées, erreurs applicatives et sauvegardes. Les alertes sont regroupées par cause. Une alerte sur une dépendance inexistante dans le projet n'est pas une tâche client.

## Applications métier

Chaque fonctionnalité est décrite par acteur, entrée, traitement, données, résultat et erreurs. Commencer par les parcours de bout en bout. Une interface réussie visuellement ne prouve pas la persistance, les permissions ou l'intégration. Les migrations de données et retours arrière sont prévus avant mise en production.

Le moteur de collaboration peut fournir missions, recherche, notifications et capacités communes. Les règles propres à une application restent dans son domaine. Le prix d'une prestation InfoServ2A ne doit pas être mêlé à une donnée de voyage PocketGuide ou à une commande domotique.

## PocketGuide et applications avec Claire

Conserver la référence fonctionnelle choisie dans le dépôt concerné, inventorier itinéraires, cartes, GPS, médias et sauvegardes, puis greffer la collaboration par un adaptateur. La base 1.5.2 évoquée dans le cadrage est un repère à retrouver ; ne pas affirmer qu'une branche actuelle la reproduit sans comparaison.

La présence de Claire ne supprime pas les interfaces manuelles. Chaque action vocale appelle la même fonction métier que l'interface lorsque c'est possible. Une sauvegarde de voyage confirmée doit être retrouvable après relancement. Les tests S22 portent sur la mémoire, les interruptions, le réseau et la concurrence avec le flux audio/vidéo.

## Gestion des défauts

Une anomalie contient une reproduction, l'environnement, les versions, le résultat attendu et l'observé. Hermes recherche les occurrences connues, propose la priorité et confie une mission. Cursor/Codex traite un périmètre identifiable. La résolution est reliée au test qui reproduisait le défaut et au déploiement qui l'a corrigé.

Une erreur de fournisseur peut exiger un repli ou une adaptation ; elle ne justifie pas une réécriture systématique du noyau. Une refonte est une décision explicite avec coût, risque et preuve des limites de la base actuelle.

## Recette par type de livrable

Site vitrine : navigation, contact, pages clés, mobile et indexation de base. Site avec Claire : ajouter audio, vidéo, actions et expiration. Application : persistance, permissions, concurrence et migrations. API : schémas, authentification, erreurs, limites et idempotence. Déploiement : version, routes, dépendances et retour arrière. La preuve est adaptée au livrable, sans promettre une conformité générale à partir d'un simple test automatique.
