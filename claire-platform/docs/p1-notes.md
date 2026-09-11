# Notes P1 — non bloquantes

Ces pistes ne font pas partie du P0 dogfood.

## Tenant store

- Remplacer le registre JSON versionné par un store administrable (KV pour la lecture, D1 si historique/audit requis).
- Valider les changements de tenant avec un schéma et publier une version atomique.
- Garder les secrets uniquement dans les bindings Cloudflare ; le tenant stocke des noms de bindings, jamais leur valeur.

## Knowledge

- Versionner les connaissances par tenant et conserver la version utilisée dans chaque session.
- Prévoir ingestion contrôlée, approbation humaine et rollback.
- Ne pas réintroduire de scraping du DOM hôte.

## Communication iframe

- Remplacer le `postMessage(..., "*")` de fermeture par un `targetOrigin` transmis et vérifié depuis le ticket de bootstrap.
- Définir un schéma/version des messages (`claire:v1:*`) et rejeter toute commande inconnue.
- Ne transmettre ni ticket, ni lead, ni transcript au document hôte.

## Exploitation

- Ajouter export de consommation, alertes quota et rétention/cleanup des tickets expirés.
- Ajouter rotation du secret HMAC avec une courte fenêtre de double validation.
- Séparer explicitement les futurs environnements par compte Cloudflare tout en conservant l’interdiction absolue de cibler le Worker `infoserv2a`.
