# 24 — Scénarios concrets de collaboration

Tous les cas ci-dessous sont fictifs. Ils décrivent la cible fonctionnelle et servent à construire des tests. Ils ne rapportent pas des opérations réellement exécutées pour un client.

## Une journée de Didier

Le matin, Didier ouvre Cursor ou l'espace privé de Claire. Il retrouve les rendez-vous du jour, les dossiers prêts, les missions qui attendent une décision et les incidents utiles. Hermes a préparé les pièces nécessaires, mais ne prétend pas avoir terminé une tâche dont le NAS était indisponible.

Didier demande : « Où en est le site du client A ? » Hermes recherche le projet, le dernier commit livré, les retours et les contenus manquants. Il répond avec une situation datée et des liens. Didier précise : « Les photos sont maintenant sur le NAS ; prépare la nouvelle version. » Une mission de code est créée, le dossier actualisé et Cursor/Codex reçoit les sources pertinentes.

Pendant une intervention, Claire aide Didier à retrouver la procédure de l'équipement de laboratoire. Il dicte une mesure et une observation. Le système confirme la valeur utile, l'attache au dossier et prépare le compte rendu. Au retour, Hermes rapproche la réalisation et le devis puis prépare la facturation selon le mandat applicable.

En fin de journée, Didier voit les résultats et les anomalies restantes. Les enseignements réutilisables deviennent des procédures candidates. Le système ne lui demande pas de redonner le contexte déjà documenté.

## Scénario A — nouveau site web

1. Le visiteur explique son activité à Claire et précise les langues et l'échéance.
2. Claire résume et enregistre une demande avec les coordonnées confirmées.
3. Hermes retrouve l'offre de référence et prépare les hypothèses du devis.
4. L'agenda propose un créneau adapté à l'entretien.
5. Le projet est créé et les documents reçus sont classés sans déplacer les originaux arbitrairement.
6. Le modèle de site choisi est identifié par version. Une branche est attribuée à l'exécuteur.
7. La prévisualisation est testée et présentée avec les points à vérifier.
8. La livraison autorisée est reliée au déploiement réel.
9. Le dossier commercial et la maintenance sont mis à jour.

Preuves : demande, événement, proposition, commit, URL et compte rendu. Une seule demande ne génère pas plusieurs projets lors de la reprise d'une session.

## Scénario B — incident Wi-Fi

Le client signale une dégradation. Hermes retrouve le site, les équipements et les dernières mesures. Une question précise distingue une panne générale d'un problème local à une zone. Un diagnostic autorisé collecte des observations. Si une intervention est nécessaire, le dossier et le matériel sont préparés. Après correction, les mesures sont comparées dans des conditions documentées.

La clôture exige un résultat vérifié et une réserve éventuelle ; « commande exécutée » ne signifie pas « couverture satisfaisante ». Le compte rendu alimente la mémoire du projet et une procédure seulement si la leçon est généralisable.

## Scénario C — devis retrouvé dans les archives

Didier demande une proposition similaire à un ancien dossier. Hermes cherche le document, sa date et le contexte. Il vérifie le catalogue courant et les différences du nouveau besoin. Il produit une nouvelle proposition avec les hypothèses visibles. Il ne recopie pas automatiquement un ancien tarif ni les coordonnées de l'ancien client.

Si l'ancien document est seulement une image, l'OCR aide à l'extraction. Les montants incertains sont vérifiés sur la pièce. La source reste citée et la nouvelle version possède sa propre identité.

## Scénario D — session Claire interrompue

Un client choisit un créneau puis sa connexion coupe. Le job de réservation a déjà été envoyé. Le système relit l'agenda pour établir le résultat. À la reconnexion, Claire retrouve la demande et l'état existant ; elle ne lance pas une deuxième réservation. Si le créneau n'a pas été créé, elle propose une reprise explicite.

## Scénario E — PC et NAS indisponibles

Hermes reçoit une mission nécessitant un fichier uniquement sur le PC. Il enregistre la demande, indique l'indisponibilité et l'échéance. Il peut préparer les étapes à partir des données disponibles, mais ne prétend pas avoir lu le fichier. Lorsque le PC revient, le relais annonce sa disponibilité et vérifie que la mission est encore pertinente avant exécution.

## Scénario F — changement d'habitude

Didier corrige la façon de rédiger les comptes rendus : plus de mesures, moins de texte général. Le système enregistre cette préférence dans son périmètre professionnel et propose de mettre à jour la procédure concernée. Les anciens rapports restent inchangés. Le prochain rapport est évalué sur ce critère.

## Scénario G — nouvelle application avec Claire

Le projet réutilise le contrat de capacités et d'identité, mais possède son propre état applicatif. La commande vocale appelle la même opération métier que l'interface. Les scénarios sont testés sur les appareils cibles. Le contexte de cette application n'ouvre pas les documents comptables d'InfoServ2A à ses utilisateurs.

## Ce que Didier doit pouvoir demander

- « Retrouve la décision actuelle et le document qui la justifie. »
- « Prépare le rendez-vous avec les pièces et questions manquantes. »
- « Montre ce qui a réellement été publié et ce qui attend encore. »
- « Compare la réalisation au devis et prépare la suite. »
- « Explique ce que tu as retenu sur ma façon de travailler et corrige-le. »
- « Reprends la mission interrompue sans refaire les opérations déjà réalisées. »

Ces demandes sont des critères de produit. Leur réussite dépend des données et connecteurs configurés, et doit être démontrée pendant les lots correspondants.
