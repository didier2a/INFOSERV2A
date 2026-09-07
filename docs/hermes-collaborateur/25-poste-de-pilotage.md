# 25 — Poste de pilotage de la collaboration

## Expérience souhaitée

Didier doit pouvoir diriger l'activité sans naviguer entre les consoles techniques. Cursor reste l'interface principale de développement ; un tableau de collaboration accessible depuis Cursor et depuis le téléphone expose les missions et les décisions. Le premier lot peut utiliser des documents structurés et une page simple ; une extension Cursor dédiée n'est pas un prérequis.

## Vues proposées

| Vue | Informations essentielles | Actions |
|---|---|---|
| Aujourd'hui | Rendez-vous, priorités, dossiers prêts et exceptions | Ouvrir une mission, demander une synthèse |
| Missions | État, responsable, échéance, progression et coût | Créer, préciser, suivre, arrêter selon état |
| Clients et projets | Contexte, documents, contrats et dernières décisions | Rechercher, consulter, préparer une suite |
| Documents | Résultats sourcés et version | Ouvrir l'original, signaler une erreur |
| Décisions | Résultat préparé, impact et mandat manquant | Arbitrer sur un objet concret |
| Mémoire | Préférences et procédures retenues | Corriger, consulter la source, retirer |
| Comptabilité | Documents et écarts utiles issus d'Abby | Ouvrir l'objet, préparer un contrôle |
| Exploitation | Fonctions disponibles et incidents | Consulter diagnostic et procédure |
| Budget | Coût réel/estimé et répartition | Ajuster les limites et priorités |

## Carte d'une mission

Afficher un titre métier, le client/projet, la demande, l'état et le prochain résultat attendu. Les détails techniques sont accessibles à la demande. Le statut « en attente » précise de quoi : accès, information, décision, disponibilité du PC ou fournisseur. Les boutons ne suggèrent pas qu'une action a réussi avant son retour.

Une preuve est visible à côté du résultat : lien vers le devis, événement, fichier, commit ou déploiement. Un utilisateur peut vérifier la conclusion sans lire toute la trace technique. Le coût porte la mention estimé ou constaté.

## Écrans Claire

L'espace public met en avant les services, la demande et les options de rendez-vous. L'espace privé permet de consulter les missions et d'agir selon l'identité de Didier. L'avatar conserve les règles visuelles validées. Le mode manuel reste utilisable lorsque le microphone, le fournisseur ou la connexion échoue.

La voix confirme les informations ambiguës, notamment les dates, montants, noms et destinataires. Elle ne lit pas spontanément une grande quantité de données privées à voix haute ; la restitution s'adapte au contexte et au choix de Didier.

## États de connexion

| État | Présentation |
|---|---|
| Connecteur prêt | Fonction disponible, dernier contrôle consultable |
| Authentification requise | Action guidée vers le fournisseur |
| NAS hors ligne | Dernière mise à jour et fonctions affectées |
| PC hors ligne | Missions locales en attente et expiration |
| Mission en réconciliation | Résultat externe à vérifier, pas de relance aveugle |
| Budget atteint | Travail déjà fait et décision nécessaire |

## Notifications

Notifier un résultat utile, une échéance ou une décision. Regrouper les incidents similaires. Une préférence de silence suspend les notifications non urgentes mais ne supprime pas les tâches. Le statut reste consultable depuis un autre canal après reconnexion.

## Accessibilité et mobilité

Prévoir navigation clavier, contrastes lisibles, labels, focus cohérent, texte alternatif et affichage mobile. Les tableaux larges ont une présentation adaptée au téléphone. Les informations importantes ne dépendent pas seulement d'une couleur ou d'un effet d'animation. Le panneau technique ne doit pas recouvrir le visage de Claire ni empêcher les actions principales.

## Définition de la première interface livrable

Une page privée avec liste de missions, fiche détaillée, recherche documentaire, liens de preuve et état des connecteurs suffit pour L1/L2. Les vues comptables et agenda arrivent avec leurs connecteurs. Une maquette Figma pourra être produite à partir de ces contrats, mais ne remplacera pas les règles métier et la recette.
