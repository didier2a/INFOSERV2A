# Fiche procédure métier — modèle

Cette fiche décrit une procédure à formaliser. Elle n'installe pas une capacité ni un skill Hermes/Cursor. La conversion vers un format exécutable suit les conventions réellement utilisées et une recette.

## Métadonnées

Identifiant, version, métier, propriétaire, date de validation, statut (`draft`, `validated`, `deprecated`), documents sources et procédure remplacée.

## Déclenchement et résultat

Décrire l'événement déclencheur, les entrées requises, l'acteur habilité, les cas non applicables et le résultat métier. Préciser si la routine peut être rejouée et selon quelle clé elle est dédupliquée.

## Préconditions

Identité et espace confirmés ; connecteurs disponibles ; paramètres et cibles déterminés ; autorisation existante pertinente ; plafond de coût ; fenêtre d'exécution ; état initial connu. Indiquer comment vérifier chaque précondition avec les outils du métier.

## Étapes

| Ordre | Action et capacité | Entrée | Résultat attendu | Preuve | Reprise si interruption |
|---|---|---|---|---|---|
| 1 | À renseigner | À renseigner | À renseigner | À renseigner | À renseigner |
| 2 | À renseigner | À renseigner | À renseigner | À renseigner | À renseigner |
| 3 | À renseigner | À renseigner | À renseigner | À renseigner | À renseigner |

Pour une mutation externe, enregistrer l'intention, l'identifiant de demande, la réponse et la relecture. Une absence de réponse n'établit pas que l'action a échoué.

## Exceptions et décisions

Information manquante ; accès indisponible ; conflit d'état ; coût dépassé ; résultat inconnu ; demande annulée. Pour chacun, définir l'état visible, l'action déjà effectuée, la reprise sûre et l'information à demander si nécessaire. Réutiliser les délégations valides au lieu de redemander les décisions routinières.

## Vérification et compte rendu

Référence de recette, environnement, données fictives ou pilote autorisé, résultat observé, preuve de réussite, limites. Expliquer le résultat en termes métier et conserver les détails techniques dans la trace.

## Amélioration proposée

Observation, fréquence, bénéfice estimé, modification proposée et test nécessaire. Une observation isolée ne remplace pas automatiquement une règle durable de l'entreprise.
