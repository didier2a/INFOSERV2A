# 20 — Procédures techniques de préparation et d'installation

## Nature de ce chapitre

Ces procédures sont un guide pour Cursor. Elles sont à adapter à l'environnement constaté. Les commandes d'inventaire ci-dessous sont des lectures ; elles ne sont pas exécutées sur les machines de Didier par la publication de ce dossier. Les opérations d'installation sont décrites par étapes pour éviter de fournir un script universel qui modifierait un hôte mal identifié.

## Inventaire Windows

À lancer dans le PowerShell du PC cible, pas dans un terminal Linux distant :

```powershell
Get-CimInstance Win32_OperatingSystem | Select-Object Caption, Version, OSArchitecture
Get-CimInstance Win32_ComputerSystem | Select-Object TotalPhysicalMemory
Get-Command ssh, git, node, python -ErrorAction SilentlyContinue | Select-Object Name, Source
```

Relever ensuite, sans afficher d'identifiants secrets : emplacement réel des projets, mode de synchronisation OneDrive, comptes d'exécution et logiciels à piloter. Les noms de lecteurs et chemins réels restent dans l'inventaire privé. Si un outil est absent, l'indiquer avant de proposer son installation.

## Inventaire Pi/OpenMediaVault

Depuis une session SSH autorisée sur le Pi :

```bash
hostname
uname -m
getconf LONG_BIT
free -h
cat /etc/os-release
dpkg-query -W openmediavault
df -h
```

`aarch64` et un espace utilisateur 64 bits sont les indications recherchées pour un éventuel exécuteur ARM64. Un résultat différent ne justifie pas de réinstaller le NAS pour le seul raccordement documentaire. Relever les partages dans l'interface OMV et vérifier les droits effectifs avec des fichiers de test.

## Inventaire VPS

Confirmer hostname, utilisateur, adresse de ressource dans OVH, système, stockage, ports déjà utilisés et services existants. Vérifier les engagements et sauvegardes de l'offre dans le compte. Le compte OVH seul ne prouve pas que le VPS est commandé. Si l'hôte n'existe pas, préparer le choix et les paramètres de commande comme résultat concret.

## Installation Hermes

1. Identifier la version et la méthode officielle compatibles avec le système.
2. Préparer l'utilisateur de service et le stockage persistant.
3. Installer les dépendances nécessaires et Hermes suivant sa documentation actuelle.
4. Configurer le fournisseur et le modèle via le mécanisme d'authentification pris en charge.
5. Exécuter une conversation simple, puis `hermes doctor` selon la CLI disponible.
6. Configurer le service permanent et sa reprise au démarrage suivant la documentation de la version.
7. Vérifier l'état, les logs expurgés, l'arrêt/reprise et la conservation des données.
8. Sauvegarder et restaurer un jeu témoin avant d'y confier des données importantes.

Références : [Installation](https://hermes-agent.nousresearch.com/docs/getting-started/installation/), [Quickstart](https://hermes-agent.nousresearch.com/docs/getting-started/quickstart/). Le choix « installation native » ou « conteneur » doit être consigné. Un conteneur exige des volumes durables ; le supprimer ne doit pas effacer la mémoire.

## Connexion Cursor par SSH

Créer ou réutiliser une clé selon la politique du poste, conserver la clé privée localement et installer la clé publique pour l'utilisateur du VPS. Dans Cursor, utiliser l'extension Remote SSH compatible, ajouter l'hôte et ouvrir le dossier distant. Confirmer visuellement la machine dans la fenêtre avant de lancer l'agent.

Une entrée conceptuelle de configuration :

```text
Host infoserv2a-hermes
    HostName VPS_HOST_A_RENSEIGNER
    User UTILISATEUR_A_RENSEIGNER
    IdentityFile CHEMIN_CLE_PRIVEE_LOCALE_A_RENSEIGNER
    IdentitiesOnly yes
```

Cet exemple n'est pas utilisable sans valeurs réelles. Une clé publique ou un nom d'utilisateur n'est pas un accès complet. Le comportement de la clé, de sa phrase de passe et de l'agent SSH est testé depuis le terminal de l'agent Cursor.

## MCP OVH et Abby

Fusionner l'annexe `cursor-mcp.example.json` avec la configuration existante, sans écraser les autres serveurs. Ouvrir l'authentification du fournisseur dans le navigateur lorsque demandée. Vérifier les outils découverts, puis une lecture appropriée. Ne pas conclure que toutes les fonctions OVH VPS sont couvertes parce que la connexion MCP est établie.

OVH documente son endpoint européen et OAuth pour le MCP distant ; Abby documente son endpoint et les scopes de ses outils. [OVH MCP](https://www.ovhcloud.com/fr/public-cloud/mcp-server/), [Abby MCP](https://docs.abby.fr/mcp/demarrer).

Hermes reçoit sa configuration MCP propre via la méthode de sa version. Si le flux OAuth du client ne convient pas à une exploitation sans interface, résoudre ce point avec une méthode officiellement prise en charge ou un adaptateur autorisé ; ne pas copier des cookies de navigateur pour contourner l'authentification.

## Réseau privé et NAS

Installer/configurer les composants de liaison retenus sur le VPS et le Pi ou sa passerelle. Tester la résolution, la route et les permissions du service de fichier. Tester l'absence de dépendance au PC. Enregistrer les hôtes et permissions dans l'inventaire privé. Ajouter le corpus témoin, puis vérifier la fraîcheur des données.

## Relais Windows

Installer un service ou exécuteur adapté au besoin, avec une identité dédiée et des capacités déclarées. Commencer par une lecture et un test de code dans un dossier de travail. Vérifier l'encodage et les chemins. Ajouter l'exécution distante des logiciels seulement lorsque leur méthode est connue. Le contrôle visuel est une option distincte avec session interactive testée.

## Première chaîne complète

Créer un client et projet fictifs dans l'espace de test. Ajouter trois documents dont une ancienne version. Demander une recherche à Hermes, créer une mission de production d'un compte rendu, la relire dans Cursor, puis la retrouver dans une nouvelle session. Ajouter ensuite une proposition de rendez-vous et un brouillon de devis selon les environnements disponibles.

## Journal de réalisation

Après chaque étape : source, version, commande ou action, résultat, preuve, prochain point. Les valeurs privées vont dans l'espace d'exploitation. Les améliorations de procédure sans secrets peuvent revenir dans ce dossier versionné.
