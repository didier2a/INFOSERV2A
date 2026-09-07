# 02 — Existant, preuves et inconnues

## Vocabulaire de statut

| Statut | Signification |
|---|---|
| DÉCLARÉ | Information donnée par Didier dans le cadrage |
| OBSERVÉ | Présence constatée par lecture ciblée du dépôt |
| DOCUMENTÉ | Capacité décrite par l'éditeur, sans test sur le compte de Didier |
| PROPOSÉ | Choix d'architecture ou contrat à développer |
| À VÉRIFIER | Information nécessaire non établie |
| RECETTÉ | Scénario exécuté avec preuve, date et environnement |

Aucune intégration nouvellement proposée dans ce dossier n'est classée RECETTÉE.

## Inventaire issu du cadrage

| Élément | Statut | Conséquence |
|---|---|---|
| Entreprise InfoServ2A, entrepreneur seul | DÉCLARÉ | Une file de travail et une supervision simples |
| Cursor sur PC, PowerShell, OneDrive | DÉCLARÉ | Vérifier les chemins locaux et les droits réels |
| Utilisation de Codex | DÉCLARÉ | Identifier les surfaces utilisées et leurs authentifications |
| Compte OVH | DÉCLARÉ | Vérifier les services existants ; VPS non constaté |
| NAS OpenMediaVault sur Raspberry Pi 4 | DÉCLARÉ | Maintenir le stockage sur le Pi ; inventaire matériel requis |
| RAM du Pi : 4 ou 8 Go | À VÉRIFIER | Ne pas dimensionner un index lourd sur une valeur supposée |
| Hermes préféré par Didier | DÉCLARÉ | Socle d'orchestration et de continuité retenu |
| Outil de comptabilité désigné « Abi/ABI », interprété ici comme Abby | DÉCLARÉ + HYPOTHÈSE DE NOM | Vérifier l'éditeur exact ; le MCP Abby est documenté officiellement |
| Agenda principal et fournisseur de boîte mail | À VÉRIFIER | Choisir une autorité avant d'activer la synchronisation |
| Claire sur le site et dans des projets applicatifs | DÉCLARÉ + OBSERVÉ | Réutiliser les composants validés et isoler la greffe métier |

## Lecture ciblée du dépôt existant

Dépôt : [didier2a/INFOSERV2A](https://github.com/didier2a/INFOSERV2A). Référence de lecture : `b2d87534996931ae89b8934439739a03b5bc4933`. Les liens ci-dessous pointent sur cet instantané.

| Fichier | Constat | Utilisation dans le projet |
|---|---|---|
| [README](https://github.com/didier2a/INFOSERV2A/blob/b2d87534996931ae89b8934439739a03b5bc4933/README.md) | Site HTML/CSS/JS, connaissances JSON et tests Node décrits | Cartographier avant d'envisager une refonte |
| [Worker](https://github.com/didier2a/INFOSERV2A/blob/b2d87534996931ae89b8934439739a03b5bc4933/src/worker.js) | Routage explicite de trois routes API et service des actifs | Ajouter des routes métier identifiées ou une API séparée |
| [Session LiveAvatar](https://github.com/didier2a/INFOSERV2A/blob/b2d87534996931ae89b8934439739a03b5bc4933/functions/api/liveavatar-session.js) | Mode LITE, configuration Realtime, génération de jeton côté serveur | Point d'audit du transport et des outils vocaux |
| [Activation Claire](https://github.com/didier2a/INFOSERV2A/blob/b2d87534996931ae89b8934439739a03b5bc4933/docs/activer-claire-sur-infoserv2a-pro.md) | Historique DNS et distinction aperçu/production | Référence historique ; ne pas rejouer ses actions à l'aveugle |
| [Audit du 6 septembre](https://github.com/didier2a/INFOSERV2A/blob/b2d87534996931ae89b8934439739a03b5bc4933/docs/audit-externe-20260906-preview.md) | Comportement mobile/PC détaillé et essais non réalisés signalés | Préserver les acquis et compléter la recette réelle |
| [package.json](https://github.com/didier2a/INFOSERV2A/blob/b2d87534996931ae89b8934439739a03b5bc4933/package.json) | Test `node --test tests/*.test.mjs` | Gate utile pour les futurs changements de code |

L'arborescence contient notamment `assets/js/claire-runtime-v2.mjs`, des composants de session/mémoire Claire, des tests LiveAvatar et un manifeste de capacités. Leur existence ne prouve pas que leurs scénarios fonctionnent aujourd'hui en production. Leur contenu complet reste à examiner pendant L0/L4.

## Contradictions et prudence de reprise

Le README mélange plusieurs dates et états de déploiement ; certains passages annoncent des fonctions et d'autres les listent encore à réaliser. Le dernier commit de référence annonce une publication it48, mais aucune session vocale réelle n'a été exécutée pendant ce travail documentaire. Cursor doit lire le code, interroger les points de santé autorisés et effectuer une recette sur le bon déploiement pour trancher.

La durée maximale de Claire est une contrainte de configuration ou d'offre à vérifier. Elle ne doit pas devenir une constante universelle. Le code existant calcule une durée demandée et un repli en fonction du fournisseur. La documentation cible exige une durée connue par session et une reprise explicite à expiration.

La suite du dossier utilise le nom Abby parce qu'un MCP officiel correspondant au besoin de facturation existe. Si « ABI » désigne un autre éditeur, conserver les contrats métier et remplacer l'adaptateur concerné après vérification. Une éventuelle reprise d'historique comptable est un besoin à inventorier, pas une migration déjà décidée ou réalisée.

## Informations privées à collecter pendant L0

Version Windows et shell ; utilisateur d'exécution ; chemins OneDrive réels ; dépôts et branches actives ; version OMV ; architecture 32/64 bits ; RAM disponible ; type de stockage ; partages et permissions ; disponibilité du Pi ; débit montant et stabilité du réseau ; agenda maître ; boîtes mail ; identifiants des ressources dans les applications ; contrats et catalogue de services en vigueur.

Les valeurs réelles sont stockées dans l'inventaire privé. Le dépôt public conserve les schémas, les choix et les exemples synthétiques. Les adresses locales, comptes clients, jetons et pièces comptables ne sont pas nécessaires à cette documentation publique.

## Hors preuve à cette date

Ni l'installation Hermes, ni la commande d'un VPS, ni la liaison privée, ni l'index du NAS, ni les accès Abby/agenda depuis Hermes, ni le contrôle visuel Windows ne sont établis. Les anciennes autorisations d'un autre contexte ne prouvent pas l'existence des connexions dans le futur environnement.
