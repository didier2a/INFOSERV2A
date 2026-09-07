# 21 — Registre des décisions d'architecture

Les décisions suivantes sont des choix de conception du dossier. Elles sont révisables à partir de preuves et d'une décision de Didier. Leur adoption n'implique pas que les composants sont déployés.

| ID | Décision | Motif | Condition de révision |
|---|---|---|---|
| ADR-01 | Hermes comme coordonnateur durable | Préférence exprimée et intérêt de la mémoire/procédures | Limite bloquante démontrée ou nouveau choix de Didier |
| ADR-02 | Cursor comme poste principal | Outil quotidien déjà utilisé | Besoin d'une autre interface clairement établi |
| ADR-03 | Codex comme exécuteur/relecteur de code | Complément de réalisation et de revue | Capacités/authentification réellement disponibles |
| ADR-04 | VPS pour le service principal | Continuité hors PC et marge de traitement | Pilote local montrant une meilleure adéquation |
| ADR-05 | Pi/OMV conservé pour les documents | Réutiliser le NAS existant | Charge, fiabilité ou stockage insuffisants |
| ADR-06 | Liaison privée VPS/PC/NAS | Accès aux ressources locales avec identité | Solution équivalente plus adaptée |
| ADR-07 | Une mémoire principale avec propriétaire unique | Éviter les écritures concurrentes et contradictions | Fournisseur externe avec modèle de partage validé |
| ADR-08 | Documentation séparée de la mémoire synthétique | Volume et provenance des archives | Aucun changement de ce principe ; moteur révisable |
| ADR-09 | Abby comme autorité de facturation | Éviter les doubles référentiels | Changement officiel de logiciel métier |
| ADR-10 | Un agenda principal | Éviter les synchronisations divergentes | Besoin multi-agendas modélisé et testé |
| ADR-11 | Claire publique séparée de Claire privée | Identités et corpus différents | Aucun assouplissement par simple prompt |
| ADR-12 | Préserver le moteur Claire validé | Limiter les régressions visuelles et audio | Prototype prouvant la nécessité d'un changement |
| ADR-13 | Actions métier asynchrones | Missions plus longues que les sessions média | Actions très courtes gardant les mêmes contrôles |
| ADR-14 | API internes explicites | Découpler dialogue et fournisseurs | Contrat équivalent standardisé et vérifié |
| ADR-15 | Idempotence et réconciliation | Éviter les doubles effets externes | Mécanisme fournisseur démontré et suffisant |
| ADR-16 | Délégations permanentes bornées | Autonomie sans répétition des confirmations | Modification des mandats de Didier |
| ADR-17 | Versionner les procédures | Apprentissage corrigeable et audit | Aucun remplacement par une mémoire opaque non contrôlable |
| ADR-18 | Mise en œuvre par chaînes métier | Montrer une valeur utilisable rapidement | Réorganisation motivée par dépendances réelles |
| ADR-19 | Documentation publique sans données d'exploitation | Lisibilité Cursor et publication GitHub | Déplacement dans un dépôt privé décidé |
| ADR-20 | Coûts et valeur mesurés au pilote | Éviter les promesses d'économie sans preuve | Réévaluation avec mesures réelles |

## Format d'une nouvelle décision

Une décision ajoute : date, auteur, contexte, options examinées, choix, raisons, conséquences, coût estimé, critères de réussite et date de révision. Les décisions remplacées restent consultables avec le lien vers la nouvelle. Une correction mineure de code n'exige pas une nouvelle ADR ; une modification de l'autorité des données ou du transport Claire, oui.

## Hermes et OpenClaw : comparaison documentaire

Le projet Hermes visé est [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent). OpenClaw désigne [openclaw/openclaw](https://github.com/openclaw/openclaw), à distinguer du nom OpenCL d'une autre technologie. Le tableau porte sur l'adéquation au projet ; aucun benchmark chronométré n'a été exécuté ici.

| Critère | Hermes | OpenClaw | Conséquence pour InfoServ2A |
|---|---|---|---|
| Licence du dépôt principal consulté | MIT | MIT | Le choix ne se résume pas à un logiciel payant contre un gratuit |
| Mémoire entre sessions | Mémoire synthétique, profil et recherche des sessions documentés | Fichiers persistants, profil et recherche de mémoire documentés | La mémoire persistante existe dans les deux projets |
| Méthodes professionnelles | Cible du dossier : formaliser les procédures via Hermes | Une adaptation au système retenu devrait être étudiée | La qualité des procédures InfoServ2A se mesure au pilote |
| Intégration au PC et au NAS | Connecteurs, réseau et droits à configurer | Même besoin de raccordement à évaluer dans sa propre implémentation | Aucune prise en main universelle par simple installation |
| Claire et facturation | Passerelle métier décrite dans le dossier, à développer | Adaptation équivalente à concevoir et vérifier | Les règles d'identité, devis et agenda restent nécessaires |
| Coût mensuel | Dépend des modèles, hôtes et usages choisis | Dépend des modèles, hôtes et usages choisis | Aucun gagnant chiffré sans mêmes missions et mesures |
| Choix de ce dossier | Retenu selon la préférence de Didier | Alternative à réexaminer si un besoin le justifie | Démarrer un pilote Hermes avant de multiplier les socles |

Les licences MIT des deux dépôts sont consultables dans les fichiers [Hermes LICENSE](https://github.com/NousResearch/hermes-agent/blob/main/LICENSE) et [OpenClaw LICENSE](https://github.com/openclaw/openclaw/blob/main/LICENSE). Les services hébergés, modèles, dépendances et prestations peuvent avoir leurs propres coûts et conditions. Les fonctions de mémoire sont décrites séparément dans [Hermes Memory](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory) et [OpenClaw Memory](https://docs.openclaw.ai/concepts/memory).

Le choix Hermes est donc une décision de projet cohérente avec la préférence exprimée, pas une preuve de supériorité absolue. Pour une comparaison empirique ultérieure, utiliser le même modèle lorsque possible, les mêmes documents fictifs, les mêmes mandats, les mêmes outils et une machine comparable. Mesurer 20 recherches sourcées, une préparation de devis, une reprise après panne et une mission de code. Comparer réussite, doublons, temps humain, coût total et charge de maintenance ; conserver les versions et résultats bruts.

## Options non retenues au démarrage

Un grand modèle local sur le Pi n'est pas le moteur de la cible. Une installation Hermes sur ce Pi reste envisageable pour un usage léger après mesure, mais elle ne règle pas à elle seule la recherche documentaire et les outils Windows. Un cluster multi-machines n'est pas nécessaire pour le pilote. Un nouveau CRM complet n'est pas imposé avant d'évaluer les fonctions disponibles dans Abby et le registre de collaboration.

Cloudflare reste utile au site et aux accès web. Le dossier ne traite pas Workers comme une machine Linux persistante. Une évolution vers d'autres services Cloudflare ou conteneurs doit expliciter stockage, durée des tâches, coûts et redémarrages.

## Décisions ouvertes

Version et méthode d'installation Hermes ; hôte VPS réel ; agenda et messagerie ; stockage du registre ; moteur initial de recherche ; méthode de connexion OAuth sans interface pour chaque client ; interface Hermes réellement exploitable ; transport de la greffe métier Claire ; logiciel de contrôle visuel Windows ; fournisseur média/montage ; politiques de rétention ; niveau de délégation par activité.
