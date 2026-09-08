# Hermès — registre de collaboration InfoServ2A

Premier socle exécutable, version **0.1.0**. Développement et vérification par Astra, le 8 septembre 2026.

Ce module garde les demandes, leur avancement et les observations utiles entre les sessions. Hermes ou un client MCP local peut s'y connecter. Le moteur IA reste Hermes Agent ; le registre conserve les objets métier partagés sans écrire dans la mémoire interne de Hermes.

## Ce qui fonctionne

| Fonction | Comportement |
|---|---|
| Missions | Création en brouillon, lecture, liste par projet et pagination |
| Reprise | Missions et journal conservés dans SQLite après arrêt du processus |
| Déduplication | Même clé + même demande = même mission ; demande différente = erreur |
| Concurrence | Écriture transactionnelle et version attendue pour éviter les modifications périmées |
| Avancement | Transitions contrôlées ; note obligatoire, preuve obligatoire pour `completed` |
| Observations | Texte, source, date et acteur ; une correction remplace l'ancienne dans les recherches |
| Recherche | Recherche littérale dans les observations courantes d'un projet |
| MCP | Sept outils exposés via le SDK Python officiel, transport stdio |
| Sauvegarde | Instantané SQLite cohérent avec contrôle d'intégrité |
| Diagnostic | Présence des commandes, environnement et état local de la base |

Le diagnostic ne teste aucune authentification : il ne contacte ni NAS, ni OVH, ni Abby. Une mission créée n'est pas lancée automatiquement. Les références de preuve sont enregistrées telles que déclarées ; leur contenu doit être vérifié par l'agent avant d'annoncer la réussite.

## Installation sur le PC

Prérequis : Python 3.11 ou ultérieur et [uv](https://docs.astral.sh/uv/getting-started/installation/). Git sert à récupérer le dépôt. Le module peut s'exécuter sous Windows ou Linux ; seule la recette Linux a été exécutée pour cette livraison. PowerShell n'est pas présent dans l'environnement de test.

Depuis la racine du dépôt, dans PowerShell :

```powershell
Set-Location services/hermes-collaboration
uv sync --frozen
uv run --frozen hermes-collab doctor
uv run --frozen hermes-collab demo
uv run --frozen pytest -q
```

`bootstrap.ps1` regroupe les trois premières étapes. Si une politique Windows empêche son exécution, utiliser les commandes ci-dessus dans le terminal ; aucune modification de la politique système n'est nécessaire.

La démonstration écrit un fichier fictif, le relit, termine sa mission avec une empreinte SHA-256, rouvre le registre et crée une sauvegarde dans un dossier temporaire automatiquement supprimé. Elle ne peuple pas la base métier d'InfoServ2A.

Pour initialiser ensuite le registre de travail :

```powershell
uv run --frozen hermes-collab init
```

Emplacement par défaut : `%LOCALAPPDATA%\infoserv2a\hermes-collaboration` sous Windows, `~/.local/share/infoserv2a/hermes-collaboration` sous Linux. `--data-dir` ou `HERMES_COLLAB_DATA_DIR` permet un autre emplacement.

**Conserver la base active sur un disque local, hors OneDrive et partage NAS.** Plusieurs processus MCP sur le même hôte peuvent partager cette base. Une base SQLite active ne doit pas être synchronisée entre PC et VPS ni ouverte simultanément par Windows et WSL. Les sauvegardes fermées peuvent être copiées vers le stockage choisi. Pour partager entre plusieurs machines, le prochain lot devra ajouter un service authentifié ou une connexion au même hôte.

## Brancher le MCP

Le client lance le serveur en sous-processus. Aucun port HTTP n'est ouvert. L'arrêt du client arrête le serveur ; les données restent sur disque.

Pour produire une configuration avec les chemins réels de l'environnement installé :

```powershell
uv run --frozen hermes-collab config cursor
uv run --frozen hermes-collab config hermes
```

Ces commandes affichent des objets JSON ; elles ne modifient aucun réglage actif. Le JSON produit pour Hermes est également du YAML valide. Les chemins de l'interpréteur Python et du stockage sont absolus : le serveur démarre indépendamment du dossier courant du client. Après déplacement du dépôt ou réinstallation de l'environnement, régénérer ces chemins.

- **Cursor, si utilisé** : fusionner seulement l'entrée `infoserv2a_registry` dans `mcpServers` de la configuration MCP existante. Conserver les autres entrées. [Documentation MCP Cursor](https://cursor.com/docs/context/mcp).
- **Hermes Agent** : fusionner l'entrée dans `mcp_servers` de sa configuration. Générer cette entrée depuis l'environnement Python de l'hôte qui exécutera réellement le serveur. [Documentation MCP Hermes](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp/).
- **Astra** : peut continuer à modifier et tester ce code depuis une session disposant du dépôt. Ce module ne connecte pas automatiquement la session ChatGPT distante à Windows.

La compatibilité du protocole MCP a été testée avec le SDK officiel. La connexion dans les applications Cursor et Hermes de Didier reste à vérifier sur son poste.

## Les sept outils

| Outil | Entrées principales |
|---|---|
| `registry_status` | Aucune ; décrit le registre et ses limites |
| `create_mission` | `project`, `title`, `objective`, `idempotency_key` |
| `get_mission` | `mission_id` |
| `list_missions` | `project` facultatif, `limit`, `offset` |
| `transition_mission` | `mission_id`, `expected_version`, `state`, `note`, `evidence` |
| `record_observation` | `project`, `content`, `source_ref`, `idempotency_key`, `supersedes` facultatif |
| `search_observations` | `project`, `query`, `limit` |

Exemple de demande au client MCP connecté : « Crée une mission de cadrage pour le projet `site-temoin`, avec la clé `cadrage-temoin-001`, puis relis son identifiant et son état. » Une seconde demande identique réutilise le même objet. Une clé désigne une demande logique ; elle ne doit pas être réutilisée pour un autre objectif.

Chemin ordinaire : `draft → ready → running → completed`. Les attentes d'accès, de donnée et de décision restent explicites. Une demande d'arrêt en cours passe par `cancel_requested`, puis `cancelled` seulement lorsque l'exécuteur constate l'arrêt. Les états sont un suivi déclaratif, pas un moteur d'exécution.

## Observations et mémoire

Le registre ne prétend pas « connaître tous les documents ». Il mémorise les observations explicitement reçues, avec leur provenance. Les corrections conservent l'historique et masquent l'observation remplacée dans la recherche courante. L'effacement métier, les politiques de conservation, l'import documentaire, l'OCR et la recherche sémantique ne sont pas livrés dans cette version.

Les sources peuvent être des références de mission, de commit ou de document. Ne pas enregistrer de clés API, mots de passe ou pièces privées dans le dépôt. Ce module ne filtre pas automatiquement tous les secrets contenus dans un texte.

## Périmètre d'accès

Version locale pour un propriétaire de confiance. L'espace et l'acteur sont définis au lancement du processus et ne peuvent pas être changés par un appel MCP. Les requêtes filtrent les données selon cet espace. Cela évite les mélanges involontaires, mais **ne constitue pas une authentification multiclient** : une personne qui possède le fichier SQLite ou contrôle les paramètres du processus peut accéder aux données. `actor` est une attribution locale, pas une identité authentifiée.

Ne pas exposer cette version directement à Claire publique, à un visiteur ou sur Internet. Une future interface distante nécessitera authentification, permissions, limites et journal d'accès. Les droits NTFS du dossier doivent rester ceux de l'utilisateur concerné. Sous Linux, le dossier nouvellement créé est privé et le fichier principal est limité au propriétaire.

## Sauvegarde et restauration

```powershell
uv run --frozen hermes-collab backup
```

La commande produit un instantané local sous `backups/`, incluant tous les espaces de la base, et vérifie son intégrité. Ce n'est pas une sauvegarde distante automatique. Pour restaurer : arrêter tous les clients, conserver l'ancien dossier intact, copier l'instantané sous le nom `registry.sqlite3` dans un **nouveau** dossier vide, puis lancer le registre avec `--data-dir` pointant sur ce dossier. Ne pas remplacer uniquement le fichier principal d'une base encore ouverte avec ses fichiers WAL.

## Recette du 8 septembre 2026

Environnement Linux, Python 3.12.13, SDK `mcp` 1.30.0, pytest 9.1.1. Commande exécutée : `uv run --frozen pytest -q`. Résultat : **17 tests réussis**, dont :

- redémarrage de deux processus successifs et échange MCP réel via stdio ;
- seize créations concurrentes d'une même demande donnant une seule mission ;
- conflit de version, transitions invalides et annulation explicite ;
- isolation des requêtes entre espaces et des observations entre projets ;
- correction d'observation, recherche littérale et rejet des clés réutilisées à tort ;
- restauration d'une sauvegarde et retour arrière transactionnel en cas d'échec d'écriture du journal.

La démonstration est synthétique. Aucun test matériel Windows, session réelle Hermes, connexion Abby/NAS/VPS ou contrôle du bureau n'est revendiqué. Les scénarios du dossier directeur conservent leur statut tant que leur périmètre complet n'a pas été exécuté.

## Décisions techniques et suite

SQLite réduit les composants à exploiter pour ce pilote local. Le SDK MCP officiel 1.x, verrouillé, fournit le protocole sans implémentation maison. L'API HTTP proposée au chapitre 14 n'est pas encore construite. Aucun appel à un modèle payant n'est nécessaire pour tester le registre.

Prochaine étape : recette sur le PC connecté avec Astra, puis installation du moteur [NousResearch/Hermes Agent](https://github.com/NousResearch/hermes-agent) et raccordement à ce MCP. L'inventaire doit distinguer le terminal local réel, les outils installés et les authentifications disponibles. Le déploiement permanent sur VPS vient ensuite.
