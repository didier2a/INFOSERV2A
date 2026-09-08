# Hermès — reprise du développement avec Astra

Version 0.1.0, 8 septembre 2026.

**Astra reste le développeur principal demandé par Didier.** Cursor est un poste de travail possible, pas une obligation ni un transfert du pilotage. GitHub permet de récupérer le même code depuis le PC. Remote doit être connecté à une session locale pour agir réellement sur Windows ; cette branche ne configure pas Remote.

## Livré dans cette branche

Le [module Python](services/hermes-collaboration/README.md) apporte un registre SQLite de missions, un journal transactionnel, des observations sourcées et corrigibles, un serveur MCP local avec sept outils, une sauvegarde vérifiée et une démonstration synthétique. Les dépendances sont verrouillées dans `uv.lock`.

Ce module accompagne **NousResearch/Hermes Agent**. Ce n'est pas une réécriture du moteur Hermes et il ne modifie pas ses fichiers `MEMORY.md`/`USER.md` ni ses sessions. Le moteur IA Hermes, le service permanent VPS, Claire métier, Abby, l'agenda, l'index documentaire et le relais PC restent à raccorder. Le registre n'exécute pas encore les missions.

## Transférer le projet sur le PC

Dans PowerShell, si Git est installé :

```powershell
git clone --branch feat/hermes-registry-2026-09-08 --single-branch https://github.com/didier2a/INFOSERV2A.git "$env:USERPROFILE\InfoServ2A-Hermes"
```

Cette commande crée un nouveau dossier. Si ce dossier existe déjà, Git s'arrête : ne pas supprimer un travail existant. Le téléchargement comprend le site, le dossier directeur et le nouveau module. Le code n'est pas automatiquement exécuté.

Ouvrir ensuite ce dossier comme projet local dans ChatGPT avec Astra lorsque la session locale est disponible. Cursor peut également ouvrir ce dossier. Lire la suite dans `services/hermes-collaboration/README.md` avant le démarrage.

## Consigne de reprise pour Astra

> Tu reprends Hermès pour InfoServ2A. Reste le développeur principal. Lis HERMES-IMPLEMENTATION-START.md et services/hermes-collaboration/README.md, puis le dossier directeur indiqué dans HERMES-CURSOR-START.md. Vérifie d'abord si ton terminal est réellement celui de mon PC Windows ou de WSL et relève les outils disponibles sans afficher de secrets. Le registre Python 0.1.0 a passé 17 tests sur Linux, dont un vrai échange MCP avec redémarrage. Exécute sa recette sur mon PC. Vérifie ensuite la version officielle de NousResearch/Hermes Agent avant installation dans un environnement dédié. Préserve sa mémoire native, les réglages existants et les projets de développement. Utilise le registre pour consigner la suite. Une connexion enregistrée dans ChatGPT n'est pas automatiquement disponible dans Hermes.

## Prochain sous-lot

1. Vérifier le PC réellement connecté et les chemins locaux, puis tester le registre sur Windows ou WSL.
2. Installer et configurer le moteur Hermes sur l'hôte retenu, avec le fournisseur IA déjà autorisé quand il est disponible.
3. Relier Hermes au MCP de ce registre et effectuer un appel réel depuis une conversation Hermes.
4. Définir ensuite la permanence sur VPS et un corpus documentaire témoin NAS/OneDrive.

Le dossier directeur demeure dans [docs/hermes-collaborateur](docs/hermes-collaborateur/README.md). L1 est **partiellement implémenté** : la persistance du registre est testée ; le service Hermes permanent et la connexion au PC ne le sont pas encore.
