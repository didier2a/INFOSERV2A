# 17 — Budget, coûts récurrents et valeur mesurée

## Structure du coût total

Le coût comprend l'hébergement, les sauvegardes, les appels aux modèles, la voix, l'avatar, les générations média, les logiciels existants et le temps de maintenance. Le prix du VPS n'est pas le prix complet du collaborateur. Les outils déjà payés sont distingués des nouveaux coûts afin de mesurer le supplément réel.

| Poste | Unité à mesurer | Risque de sous-estimation |
|---|---|---|
| VPS | Mois, durée d'engagement, options | Promotion puis renouvellement |
| Sauvegardes | Go, rétention, restauration | Copie indépendante et trafic |
| Modèle texte/code | Tokens ou quota réel | Contextes longs, reprises et revues |
| Recherche documentaire | Extraction, OCR, index | Premier inventaire volumineux |
| Realtime/voix | Durée et consommation fournisseur | Sessions abandonnées ou longues |
| Avatar | Minutes, sessions, plan | Concurrence et durée maximale |
| Génération vidéo/image | Plan, seconde ou crédit | Tentatives rejetées et rerendus |
| Mail/agenda/connecteurs | Abonnement ou volume | Fonctions non incluses dans l'offre |
| Réseau privé | Plan et utilisateurs/appareils | Conditions d'usage professionnel |
| Temps de supervision | Heures réelles | Corrections et incidents |

Les prix des offres VPS évoquées doivent être vérifiés au panier avec durée, TVA, renouvellement, adresse IP, sauvegardes et localisation. Ce dossier ne vaut pas commande ni devis fournisseur. Les éditions open source ne rendent pas l'inférence, la maintenance et l'hébergement gratuits. Le [comparatif documentaire Hermes/OpenClaw](21-decisions-architecture.md) distingue la licence du coût réel d'exploitation.

## Scénarios budgétaires purement illustratifs

Les montants suivants sont des enveloppes de travail inventées pour tester le modèle économique. Ils ne sont pas des tarifs d'éditeur, ne garantissent aucun volume et n'incluent pas les abonnements existants déjà payés. La présentation fiscale des dépenses sera harmonisée dans le budget privé.

| Hypothèse mensuelle | Pilote documentaire | Usage métier modéré | Usage plus intensif |
|---|---:|---:|---:|
| Serveur | 12 EUR | 12 EUR | 20 EUR |
| IA texte et recherche | 15 EUR | 45 EUR | 120 EUR |
| Supplément voix/avatar | 0 EUR | 30 EUR | 80 EUR |
| Sauvegardes/autres | 3 EUR | 5 EUR | 10 EUR |
| Total illustratif | 30 EUR | 92 EUR | 230 EUR |
| Équivalent annuel | 360 EUR | 1 104 EUR | 2 760 EUR |

Zéro sur une ligne signifie « pas de coût supplémentaire prévu dans ce scénario », pas « service gratuit et illimité ». Les productions vidéo importantes doivent recevoir leur budget de projet propre.

## Mesurer la valeur

Pour chaque type de tâche, mesurer le temps manuel de référence, le temps avec Hermes, la correction, la supervision et la maintenance attribuable. Le gain net en heures est la différence. Le valoriser avec une hypothèse horaire choisie par Didier, distincte d'un revenu encaissé.

Formule proposée : `valeur mensuelle = heures nettes gagnées × valeur horaire retenue − coût supplémentaire mensuel`. Le point d'équilibre en temps est `coût supplémentaire / valeur horaire` lorsque cette valeur est positive.

Exemple fictif : 92 EUR de coût mensuel et une valeur de 40 EUR par heure donnent 2,3 heures à économiser pour atteindre cet équilibre théorique. Avec 8 heures nettes gagnées, la valeur estimée serait 228 EUR après ce coût. Ce n'est ni une marge comptable garantie, ni un revenu automatiquement créé.

## Réduction des dépenses

Utiliser une recherche ciblée plutôt que relire les archives. Traiter l'indexation en incrémental. Affecter un modèle adapté à la difficulté et conserver une limite de tentatives. Mettre en cache les résultats stables avec date et invalidation. Mesurer le coût des revues de mémoire et des appels d'outils, pas seulement celui des réponses visibles.

Un modèle moins cher qui multiplie les erreurs peut coûter davantage en correction. Le choix doit s'appuyer sur un lot témoin représentatif : devis, recherche, développement et compte rendu. Les modèles et tarifs exacts sont des paramètres d'exploitation révisables.

## Budget par client et projet

Attribuer la consommation à une mission, puis au projet. Les tâches internes sont séparées des prestations refacturables. Une génération vidéo rejetée reste une consommation réelle du projet. Les plafonds de dépense se vérifient avant les lots payants, avec arrêt ou nouvelle décision si le périmètre change.

## Décision de poursuite du pilote

Après une période de référence choisie, examiner gain net, fiabilité, coûts et charge de maintenance. Étendre les automatismes qui donnent des résultats reproductibles. Revoir les fonctions dont le coût ou les corrections dépassent la valeur. La mémoire persistante apporte de la valeur seulement si la reprise des projets et la qualité des opérations s'améliorent réellement.
