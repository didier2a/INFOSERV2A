# 19 — Recette, qualité et preuves

## Principe

Une capacité est recettée lorsqu'un scénario a été exécuté dans un environnement identifié et qu'une preuve permet de contrôler son résultat. La présence d'un fichier de test, d'un SDK ou d'un bouton ne suffit pas. Cette livraison vérifie la documentation ; les recettes ci-dessous sont à réaliser pendant l'implémentation.

## Niveaux de vérification

| Niveau | But | Exemple |
|---|---|---|
| Structure | Contrats et configurations cohérents | JSON valide, champ requis, lien interne |
| Unitaire ciblé | Règle déterministe correcte | Arrondi monétaire, transition d'état |
| Contrat connecteur | Adaptation conforme au fournisseur | Réponse Abby normalisée et erreur traitée |
| Intégration | Plusieurs composants coopèrent | Job persistant et résultat externe relu |
| Métier | Résultat utilisable par la personne | Rendez-vous correct dans l'agenda |
| Matériel/voix | Fonctionnement réel sur appareil | Dialogue Claire sur S22 |
| Reprise | Continuité après incident | Job réconcilié après coupure |

Les mocks servent à reproduire les erreurs ; ils ne prouvent pas une connexion réelle. Une requête de lecture peut prouver l'authentification ; elle ne prouve pas les droits d'écriture. Les preuves distinguent simulation, bac à sable fournisseur et pilote réel.

## Scénarios de bout en bout

**E2E-01 — demande de site.** Claire recueille une demande fictive, identifie le besoin, Hermes retrouve le catalogue et produit une proposition. Un créneau est proposé puis confirmé dans l'environnement choisi. Le projet et la mission de code sont créés. Une prévisualisation est produite. La chaîne de devis/facturation est vérifiée séparément avant tout engagement réel.

**E2E-02 — intervention réseau.** Un incident de laboratoire est rattaché à un équipement, un diagnostic est exécuté, une mesure est conservée, un compte rendu est produit et le dossier mis à jour. Une cible non autorisée est refusée.

**E2E-03 — continuité documentaire.** Une décision est donnée à Hermes puis la session est fermée. Une autre session retrouve la décision et sa source. Un document corrigé remplace la version dans les résultats. Un accès retiré empêche la consultation.

**E2E-04 — panne pendant une mutation.** La réponse du fournisseur est perdue après création d'un objet. Le système passe en réconciliation, retrouve l'objet et termine sans créer de doublon.

**E2E-05 — PC éteint.** Une mission cloud continue et une mission Windows attend avec un état clair. Le NAS reste accessible si sa liaison privée est indépendante. Au retour du PC, seules les missions encore valides peuvent reprendre.

## Objectifs initiaux du pilote

Ces seuils sont des cibles proposées, à ajuster après référence et non des garanties produit : retrouver correctement au moins 18 documents sur un jeu de 20 questions représentatives ; zéro fuite entre espaces sur les essais d'isolation ; zéro doublon sur les scénarios de reprise ; 100 % des mutations du pilote reliées à une preuve et un acteur ; restauration dans l'objectif défini au chapitre 16.

Pour Claire, fixer les seuils de latence après mesure sur PC et S22. Ne pas imposer une valeur arbitraire à une chaîne dont le fournisseur et le réseau n'ont pas encore été évalués. Le test exige au moins une conversation réelle dépassant une minute et un scénario d'expiration selon la durée effective.

## Preuve minimale

Chaque ligne de recette contient ID, date, environnement, versions, données de test, préconditions, étapes, attendu, observé, verdict, liens de preuve et anomalies. Les captures sont expurgées. Pour une action externe, conserver l'ID fournisseur et une relecture. Pour un déploiement, conserver le commit et l'URL. Pour un fichier, conserver le chemin, l'empreinte et les contrôles de contenu.

Les états `not_run`, `passed`, `failed`, `blocked` et `not_applicable` sont distincts. Une fonction bloquée faute de compte n'est pas un succès. Un test non applicable possède une justification.

## Régressions à éviter

| Risque | Vérification |
|---|---|
| Ancienne version Claire servie | Comparer la référence de build et les actifs |
| Double parole ou accueil | Compter les événements et écouter la session |
| Mauvais client | Vérifier les IDs avant lecture et mutation |
| Montant erroné | Comparer calcul attendu et résultat Abby |
| Rendez-vous doublé | Rejouer même demande et simuler timeout |
| Fichier supprimé encore trouvé | Tester invalidation de l'index |
| Secret dans les traces | Contrôler les journaux et exports |
| Job perdu à la fermeture | Redémarrer et reprendre depuis le registre |
| Réseau indisponible | État explicite, pas de réussite inventée |
| Deux agents écrivant au même endroit | Tester verrou/propriété de mission |

## Organisation de la recette

Chaque lot apporte ses tests indispensables. Réexécuter les tests touchés par le changement et les parcours métier critiques ; ne pas multiplier les tests sans risque concret à couvrir. La recette finale rassemble les chaînes entre métiers et une restauration. Le registre CSV d'annexe sert de point de départ, pas de preuve d'exécution.

## Acceptation

Un lot est accepté sur les résultats et les limites explicitement documentés. Une anomalie majeure sur l'identité, l'argent, le double traitement ou la reprise empêche d'activer la routine concernée. Les fonctions indépendantes déjà vérifiées peuvent rester disponibles. Le compte rendu indique précisément ce que l'entreprise peut utiliser à la fin du lot.
