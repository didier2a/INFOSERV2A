# 03 — Couverture complète des activités InfoServ2A

## Principe de couverture

Une activité est couverte lorsqu'elle dispose de données de référence, d'un point d'entrée, de missions exécutables, d'un résultat vérifiable et d'un responsable. Tous les domaines ci-dessous appartiennent à la cible. La priorité de réalisation dépend de la valeur et des accès disponibles ; elle ne traduit pas une hiérarchie entre les métiers.

## Matrice fonctionnelle

| Domaine | Entrées | Travail de Hermes et Claire | Sortie/autorité | Preuve de réussite |
|---|---|---|---|---|
| Direction et priorités | Demandes, échéances, charge et trésorerie | Préparer le point du jour, proposer les arbitrages, repérer les engagements en retard | Tableau des missions | Priorités datées et reliées aux demandes |
| Prospection locale | Contacts apportés, demandes entrantes, partenaires | Qualifier le besoin et préparer une proposition adaptée | Fiche prospect | Besoin, contact et prochaine étape explicites |
| Accueil par Claire | Dialogue web, voix, texte | Expliquer les services, demander les précisions, transmettre à Hermes | Demande structurée | Résumé fidèle et accord sur les coordonnées |
| Gestion client | Historique, organisations, contrats | Rapprocher les identités, retrouver le dossier et le contexte | Référentiel client relié à Abby | Absence de doublon et traçabilité du rapprochement |
| Rendez-vous | Motif, durée, localisation, disponibilités | Proposer un créneau, vérifier le conflit, enregistrer et rappeler | Agenda principal | Identifiant événement et confirmation réelle |
| Devis | Catalogue, quantités, contraintes | Préparer les lignes et hypothèses, créer le brouillon et suivre la réponse | Abby | Totaux exacts et document retrouvé par ID |
| Facturation | Devis accepté, réalisation, acomptes | Préparer/finaliser selon délégation, transmettre et suivre | Abby | État fournisseur, numéro et pièce archivés |
| Achats et dépenses | Factures fournisseurs, justificatifs | Extraire, rapprocher, signaler les doublons et préparer le classement | Abby ou import documenté | Montants et pièces rapprochés sans double saisie |
| Encaissements et suivi comptable | Paiements, factures, exports | Identifier les écarts et préparer les états de contrôle | Données comptables de référence | Solde justifié et écarts expliqués |
| Déclarations et administratif | Périodes, catégories, encaissements | Préparer les données et les preuves, suivre les échéances | Service agréé ou portail concerné | Accusé officiel conservé si transmission |
| Sites web clients | Brief, modèle, contenus, médias | Créer le projet, construire, tester, proposer la livraison | Git + hébergement | Commit, déploiement et recette |
| Applications métier | Besoins, maquettes, contraintes | Découper, implémenter, tester, documenter et maintenir | Dépôt applicatif | Scénarios métier réussis |
| Claire et interfaces vocales | Catalogue d'actions, état d'interface | Dialoguer, naviguer, exécuter une action métier et restituer | Contrôleur métier + interface | Action vérifiée, narration conforme |
| Réseaux critiques | Inventaire, topologie, mesures | Préparer le diagnostic, comparer les mesures, proposer une configuration | Dossier d'intervention | Mesures avant/après et configuration archivée |
| Wi-Fi, liaisons et Starlink | Couverture, terrain, débit, obstacles | Étudier les options, produire schéma et liste de matériel | Projet réseau | Critères d'acceptation et relevés terrain |
| Vidéosurveillance | Besoin client, alimentation, connectivité | Dimensionner, documenter et vérifier l'installation | Dossier équipement | Tests convenus et remise au client |
| Cyber et surveillance | Journaux autorisés, alertes, inventaire | Trier, contextualiser, proposer la remédiation et suivre | Incident/ticket | Cause, action et vérification conservées |
| Assistance à distance | Demande, diagnostic, accès consenti | Guider, exécuter les opérations déléguées et journaliser | Ticket + compte rendu | Service rétabli et confirmation utilisateur |
| Intervention sur site | Rendez-vous, matériel, historique | Préparer la tournée, la liste de contrôle et la saisie du compte rendu | Rapport terrain | Photos utiles, mesures, temps et suite |
| Matériel et fournisseurs | Catalogue, devis d'achat, stock | Préparer la commande, suivre les garanties et rattacher l'équipement | Inventaire d'actifs | Référence et destination vérifiées |
| Maintenance web récurrente | Contrat, versions, disponibilité | Surveiller, préparer les correctifs et produire le bilan | Rapport client | Périmètre contractuel et temps consommé |
| Marketing et SEO | Services, demandes, statistiques | Proposer contenus, améliorer les pages, analyser les requêtes | Calendrier éditorial + Git/CMS | Mesures avant/après et contenu publié identifié |
| Réseaux sociaux | Contenus validés, photos, calendrier | Préparer les publications et suivre les résultats | Plateforme choisie | ID de publication et compte cible |
| Vidéo et création multimédia | Script, planche contact, MP3, contraintes | Préparer les plans, orchestrer les rendus et contrôler les livrables | Fournisseur média + NAS | Fichiers, formats, durée et coûts constatés |
| Formation et transmission | Public, objectifs, ressources | Préparer supports, exercices et compte rendu | Dossier pédagogique | Support utilisable et retours intégrés |
| Veille commerciale/technique | Sources officielles et versions utilisées | Résumer les changements applicables, ouvrir une mission si utile | Rapport sourcé | Impact rattaché à un actif ou contrat |
| Documentation et archives | PC, NAS, cloud, Git | Indexer, versionner, retrouver et classer | Sources + catalogue | Recherche exacte et actualisation testée |
| Exploitation interne | État VPS, PC, Pi, sauvegardes | Surveiller les services, traiter les incidents et préparer la reprise | Registre d'exploitation | Restauration réellement testée |

## Règles métier transversales

Chaque demande reçoit un identifiant interne stable. Les identifiants externes restent séparés : contact Abby, événement agenda, issue GitHub ou session Claire. Une modification de nom client ne doit pas rompre ces liens. Un même projet peut avoir plusieurs prestations, factures, équipements et dépôts ; éviter une structure « un client = un dossier = une facture ».

Les données commerciales applicables sont datées : offre, tarif, unités, taxes, durée de validité, conditions, déplacements et seuils de délégation. Aucun taux social ou fiscal n'est codé en dur à partir d'une ancienne conversation. Le système utilise les paramètres métier actuels et prépare un contrôle lorsque ceux-ci manquent.

Une urgence déclarée par un visiteur est qualifiée. Elle ne justifie pas automatiquement l'interruption d'autres missions ni une promesse d'intervention. Une indisponibilité réseau locale n'empêche pas Hermes de travailler sur les dossiers déjà présents sur le VPS, mais les résultats doivent préciser la fraîcheur de leurs sources.

## Frontières entre activités

Une mission de développement peut produire une dépense API et une tâche de facturation, mais elle ne modifie pas elle-même les données comptables sans passer par l'adaptateur métier. Une demande d'assistance peut ouvrir un rendez-vous, mais ne transforme pas un créneau proposé en événement confirmé. Une alerte cyber peut déclencher une analyse autorisée, mais pas une exploration arbitraire de réseaux tiers.

Les projets associatifs ou personnels que Didier souhaite suivre sont des espaces distincts. Leur présence dans le même outil de collaboration ne fusionne ni leur facturation, ni leurs documents, ni les droits des personnes qui y participent.

## Extension aux projets applicatifs existants

Le README existant mentionne un contrat Claire partagé avec PocketGuide. La réutilisation proposée porte sur les missions, l'identité et le contexte ; le périmètre précis des autres applications reste à inventorier. Les particularités GPS, cartographie, itinéraires et fonctionnement mobile appartiennent à leurs dépôts applicatifs.

Une extension vers Home Assistant, Android TV ou la domotique est une option à étudier si elle entre dans le portefeuille d'InfoServ2A. La capacité à gérer une entreprise ne prouve pas la capacité à piloter chaque appareil. Une matrice de commandes réellement disponibles précédera cette extension.
