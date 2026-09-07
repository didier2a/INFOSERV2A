# 00 — Reprise opérationnelle par Cursor

## Mission et portée

Tu reprends le projet de collaborateur virtuel InfoServ2A. Ton interlocuteur est Didier, entrepreneur seul. Son attente est une collaboration transversale et durable : développement, exploitation, relation client, agenda, devis, comptabilité, documentation et travail terrain. Ne réduis pas le projet à un chatbot ni à un agent de programmation.

Le choix exprimé est Hermes pour la continuité et les procédures, Cursor comme poste principal, Codex comme outil de développement, Claire comme collaboratrice vocale et visuelle. Le NAS est OpenMediaVault sur Raspberry Pi 4 ; 4 ou 8 Go de RAM restent à vérifier. Le VPS OVH est la cible recommandée, pas un service dont l'existence a été constatée.

## Ordre de lecture

1. Lire le présent fichier, le chapitre 02 et le chapitre 04.
2. Lire le chapitre 06 avant de choisir une mémoire ou un moteur de recherche.
3. Lire les chapitres 08 à 13 pour comprendre les métiers.
4. Lire les chapitres 14, 15, 18 et 19 avant de construire des connecteurs.
5. Consulter l'annexe exigences et les sources liées aux composants modifiés.

Ne charge pas systématiquement tous les chapitres dans chaque prompt : sélectionne ceux qui concernent la mission et conserve leurs références dans son contexte.

## Ce qui est une spécification

Les noms `collaboration-api`, `knowledge-indexer`, `pc-relay`, les routes `/v1/...`, les schémas et les états de mission sont des **contrats proposés à construire**. Ils ne sont pas des API natives garanties de Hermes, Abby ou Cursor. Découvrir les interfaces réellement disponibles avant de coder leur adaptation. Un exemple JSON n'est ni un secret, ni une connexion active, ni une instruction à déclencher une opération réelle.

## Première sortie attendue

Créer dans un espace privé d'exploitation un inventaire daté : machine courante, systèmes, versions, comptes disponibles, dépôts, branches, stockages, accès réseau et connecteurs. Ne jamais supposer que le terminal actuel est celui du PC Windows ou du VPS. Pour chaque constat : commande ou source utilisée, date, résultat utile, limite de visibilité. Masquer les secrets dans les traces.

Mettre ensuite à jour un registre d'écarts : cible, existant, action manquante, dépendance, priorité. Les inconnues non bloquantes restent marquées à vérifier ; avancer sur les travaux utiles déjà autorisés au lieu de redemander des confirmations routinières.

## Règles de réalisation

- Respecter les autorisations et instructions de la session en cours. Les politiques proposées dans ce dossier ne les remplacent pas.
- Préserver les composants Claire validés visuellement. Le dossier ne demande pas de refaire le site, de changer sa voix ni de remplacer son moteur temps réel.
- Séparer la branche documentaire des branches de réalisation. Le dépôt indique que `main` déclenche la production Cloudflare : ne pas confondre publication de documentation et déploiement métier.
- Travailler sur une branche ou un worktree par mission de code. Un seul propriétaire écrit sur une même branche de travail à un instant donné.
- Conserver les originaux comptables ; traiter Abby comme autorité pour l'état de ses documents. Aucune reconstitution de numéro légal par le modèle.
- Exécuter les vérifications qui prouvent le résultat métier. L'absence d'erreur dans un terminal ne prouve pas qu'un client a reçu son devis.
- Consigner les échecs et les corrections. Ne pas transformer une hypothèse en mémoire factuelle.

## Définition d'une mission terminée

Une mission terminée possède : objectif, périmètre, références consultées, actions exécutées, identifiants des objets produits, preuves de résultat, coût ou consommation mesurable, anomalies restantes et éventuelle procédure réutilisable. L'état métier d'une action seulement préparée est `prepared` ; il ne signifie pas qu'elle est émise ou publiée. Une mission dont l'objectif était précisément de préparer un brouillon peut être `completed` lorsque ce brouillon est vérifié. Les états du registre de missions sont définis au chapitre 14.

Un manque d'accès est décrit précisément : ressource concernée, capacité recherchée, dernier constat et travail déjà terminé. Ne réclamer ni mots de passe ni clés privées dans le chat. Préparer les écrans et commandes utiles avant le passage d'authentification humaine.

## Continuité entre agents

Cursor, Codex et Hermes ne partagent pas automatiquement leurs conversations ni leurs connexions. Les artefacts de liaison sont les fiches projet, les missions, les rapports et les commits. Ils doivent être suffisamment complets pour qu'un autre agent reprenne sans inventer l'historique.

La mémoire principale Hermes est gérée par son propre processus. Les autres outils soumettent une observation sourcée par l'interface choisie ; ils ne modifient pas simultanément sa base ou ses fichiers internes.
