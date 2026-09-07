# 12 — Terrain, réseaux critiques, cyber et vidéosurveillance

## Place du collaborateur

Hermes prépare et documente les interventions, rapproche les mesures et aide à résoudre les incidents. Claire peut servir d'interface vocale pour dicter un constat ou retrouver une procédure pendant le travail. Les opérations physiques restent réalisées par Didier ou les intervenants concernés.

## Dossier technique d'un site

Un site client possède : objectif, contacts autorisés, plan logique, équipements, rôles, versions, emplacement, alimentation, liens, dépendances, contrats, incidents et critères de qualité. Les secrets des équipements sont référencés dans le coffre prévu, pas inscrits dans les notes ou mémoires.

| Objet | Informations utiles | Exemple de contrôle |
|---|---|---|
| Accès Internet | Opérateur, type, contrat, routeur, contraintes | Connectivité et mesure de référence |
| Liaison radio | Extrémités, visibilité, fréquence, rôle | Signal, stabilité et débit mesurés |
| Wi-Fi | Zones, profils d'usage, points d'accès | Couverture et parcours utilisateur |
| Commutateur | Ports, VLAN, alimentation PoE | Correspondance au schéma |
| Caméra | Rôle, stockage, connectivité, accès | Image, enregistrement et consultation autorisée |
| NAS | Stockage, partages, sauvegardes | Lecture, écriture et restauration |
| Terminal | Système, logiciel, usages et accès | Reproduction du problème et correction |

Les valeurs réelles sont privées. Les schémas publics du présent dossier restent génériques.

## Avant l'intervention

Hermes retrouve le contrat, les incidents précédents et la configuration connue. Il prépare la liste des questions, du matériel, des outils et des étapes. Il distingue une mesure réelle d'une hypothèse : débit annoncé, débit mesuré, distance estimée et observation sur place ne sont pas interchangeables.

Il propose le rendez-vous selon durée, trajet et disponibilité. Le dossier de préparation est consultable depuis le téléphone. Une copie utile hors ligne peut contenir les procédures et schémas nécessaires, avec une politique adaptée aux données présentes.

## Pendant l'intervention

Didier peut dicter un constat à Claire. La transcription est reformulée avant de devenir une donnée critique, notamment pour une référence, une adresse réseau ou un résultat chiffré. Les photos et mesures sont rattachées au site, à l'équipement et à l'heure. Une action sur un équipement garde un avant/après et une procédure de retour.

Le connecteur réseau expose uniquement les capacités et cibles autorisées. Préférer les commandes de diagnostic et les API documentées des équipements. Une capacité générique de shell n'est pas une autorisation de scanner l'ensemble d'un réseau client ou Internet.

## Réseaux, Wi-Fi et Starlink

La procédure d'étude rassemble les usages, les zones à couvrir, obstacles, alimentation et contraintes d'accès. Elle compare les solutions avec leurs hypothèses et produit une liste de matériel. La validation repose sur des critères convenus : stabilité, couverture utile, débit ou qualité applicative selon le besoin.

Les mesures sont comparables seulement si les conditions sont notées : point de test, client Wi-Fi, heure, charge, serveur de mesure et type de liaison. Hermes évite de conclure qu'un lien est meilleur à partir de deux mesures prises dans des contextes incompatibles.

## Vidéosurveillance

Séparer la conception, l'installation, la vérification technique et les paramètres de conservation/accès applicables au client. Le système aide à produire l'inventaire, les notices et les tests. Il ne suppose pas qu'une caméra donne une API standard. Les capacités de visionnage, d'alerte et d'enregistrement sont vérifiées pour chaque modèle et compte.

Les contenus vidéo clients ne sont pas automatiquement envoyés à un modèle IA pour indexation. Le périmètre documentaire initial peut se limiter aux fiches, configurations, schémas et preuves d'installation. Une fonction d'analyse vidéo est un projet distinct avec ses données, finalités et contrôles.

## Cybersécurité et surveillance

Une alerte crée ou enrichit un incident. Hermes la rapproche d'un actif, d'une version et d'un contexte connu, puis propose la priorité. Les actions de remédiation sont liées à une procédure et à la délégation du client. Conserver l'alerte source, les observations, la décision, l'action et sa vérification.

La veille technique utilise les versions réellement installées et les avis des éditeurs. Ne pas transformer chaque actualité générale en urgence. Si un avis ne permet pas de déterminer l'impact, créer une vérification ciblée.

## Assistance à distance

La demande identifie le client, la machine et le problème. Le système vérifie la session disponible et le périmètre d'intervention. Les scripts sont nommés, versionnés et paramétrés ; le résultat est relu. Le contrôle du bureau peut être nécessaire pour certains logiciels, mais il doit être testé séparément des commandes PowerShell.

Une session interrompue conserve le dernier état et le résultat partiel. L'agent ne relance pas automatiquement une opération de modification dont le résultat est inconnu. Il commence par constater l'état réel.

## Après l'intervention

Produire un compte rendu : demande, diagnostic, actions, mesures, matériel, temps, résultat, réserves et prochaine étape. Mettre à jour le dossier technique, préparer les lignes de facturation selon contrat et archiver les pièces. Les photos utiles sont sélectionnées ; les données sans utilité ne s'accumulent pas indéfiniment.

## Recette

Pilote sur un équipement de laboratoire : retrouver la fiche, lire son état, exécuter une commande de diagnostic, consigner une mesure et générer un rapport. Tester une cible hors périmètre, un équipement indisponible et une session coupée. La réussite exige que le rapport corresponde aux commandes réellement exécutées et ne contienne aucun secret.
