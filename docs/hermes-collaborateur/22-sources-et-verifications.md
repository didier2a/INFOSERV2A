# 22 — Sources et limites des vérifications

## Méthode

Sources consultées le 7 septembre 2026 pour les capacités susceptibles d'évoluer. Les affirmations techniques principales sont reliées aux pages officielles dans les chapitres concernés. Les schémas, contrats internes, modèles de données, procédures métier et critères de recette sont des propositions originales de conception.

Une source indique une capacité documentée, pas son activation sur les comptes de Didier. Les tarifs, versions, limites et conditions contractuelles doivent être relus au moment de l'installation. Les pages commerciales ne constituent pas un benchmark de performance.

## Hermes

| Référence | Usage dans le dossier |
|---|---|
| [Documentation générale](https://hermes-agent.nousresearch.com/docs/) | Positionnement, outils et points d'entrée |
| [Installation](https://hermes-agent.nousresearch.com/docs/getting-started/installation/) | Installation et comptes de service |
| [Plateformes](https://hermes-agent.nousresearch.com/docs/getting-started/platform-support) | Linux, Windows et ARM64 |
| [Quickstart](https://hermes-agent.nousresearch.com/docs/getting-started/quickstart/) | Configuration et diagnostics |
| [Mémoire](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory) | Mémoire bornée, sessions et propriétaire |
| [Skills](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills) | Procédures réutilisables |
| [Outils](https://hermes-agent.nousresearch.com/docs/user-guide/features/tools) | Terminal, fichiers et intégrations |
| [Contexte](https://hermes-agent.nousresearch.com/docs/user-guide/features/context-files) | Contexte documentaire des projets |

Pour le choix comparé du chapitre 21 : [dépôt Hermes](https://github.com/NousResearch/hermes-agent), [licence Hermes](https://github.com/NousResearch/hermes-agent/blob/main/LICENSE), [licence OpenClaw](https://github.com/openclaw/openclaw/blob/main/LICENSE) et [mémoire OpenClaw](https://docs.openclaw.ai/concepts/memory). Les deux licences consultées sont MIT ; aucune mesure comparative de performance n'a été exécutée.

## Cursor, Codex et temps réel

| Référence | Usage |
|---|---|
| [MCP Cursor](https://cursor.com/docs/mcp) | Configuration et authentification des outils |
| [Support SSH Cursor](https://forum.cursor.com/t/remote-connection-ssh-edit/167854) | Configuration SSH standard dans Cursor |
| [MCP Codex](https://developers.openai.com/codex/mcp/) | Capacité de connexion aux outils |
| [Codex non interactif](https://developers.openai.com/codex/noninteractive/) | Intégration d'un exécuteur de code |
| [OpenAI Realtime WebRTC](https://developers.openai.com/api/docs/guides/realtime-webrtc) | Sessions et connexion navigateur |
| [LiveAvatar](https://docs.liveavatar.com/docs/agent-skills) | Documentation des modes et intégrations |
| [LiveKit Agents](https://docs.livekit.io/agents/) | Rôle du framework média temps réel |

La lecture des pages OpenAI a suivi leurs redirections officielles vers les pages Learn lorsqu'elles étaient présentes. Aucun nom de modèle récent n'est imposé comme condition du projet.

## Infrastructure et métier

| Référence | Usage |
|---|---|
| [MCP OVH](https://www.ovhcloud.com/fr/public-cloud/mcp-server/) | Endpoint européen et OAuth |
| [VPS OVH](https://www.ovhcloud.com/fr/vps/) | Offres évoquées au cadrage ; prix à reconfirmer |
| [OMV partages](https://docs.openmediavault.org/en/stable/administration/storage/sharedfolders.html) | Organisation du stockage |
| [OMV SMB](https://docs.openmediavault.org/en/stable/administration/services/samba.html) | Permissions des partages |
| [OMV SSH](https://docs.openmediavault.org/en/stable/administration/services/ssh.html) | Accès de commande |
| [Raspberry Pi 4](https://www.raspberrypi.com/products/raspberry-pi-4-model-b/) | Matériel et variantes mémoire |
| [OpenSSH Windows](https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh_install_firstuse) | Connexion de commande au PC |
| [OneDrive](https://support.microsoft.com/en-us/onedrive/sync-your-computer-s-files-and-folders-with-onedrive) | Synchronisation de fichiers |
| [Tailscale, routage privé](https://tailscale.com/docs/features/subnet-routers/how-to/setup) | Accès au NAS ou sous-réseau |
| [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/) | Connecteur sortant et application web |
| [Abby MCP](https://docs.abby.fr/mcp/demarrer) | Endpoint et authentification |
| [Abby facturation](https://docs.abby.fr/mcp/facturation) | Outils de devis et factures |
| [Abby conventions](https://docs.abby.fr/mcp/conventions.md) | Unités monétaires et scopes |
| [Google Calendar FreeBusy](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query) | Disponibilités d'agenda |

Les pages de déclarations et flux de travail Abby n'ont pas pu être récupérées de manière exploitable pendant cette vérification. Leur couverture précise est donc laissée à vérifier, sans reproduire un contrat supposé. L'accès aux dépenses, banques et imports n'est pas établi par la seule page de facturation.

## Preuves du dépôt

Référence : [commit de départ](https://github.com/didier2a/INFOSERV2A/commit/b2d87534996931ae89b8934439739a03b5bc4933). Lecture ciblée de README, Worker, session LiveAvatar, package et documents d'activation/audit. L'arborescence a été consultée pour identifier les composants et tests présents. Les essais du site, de la voix et des connecteurs n'ont pas été exécutés pendant la rédaction.

## Registre de vérification à maintenir

À chaque lot, ajouter date, source, version, constat, compte/environnement concerné, test et limite. Une évolution d'éditeur peut invalider un exemple de configuration sans invalider l'architecture globale. Cursor doit corriger les exemples concernés et garder une trace de la décision.
