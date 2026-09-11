# Claire Platform P0

Plateforme Claire multi-tenant isolée : un Worker héberge le cerveau LiveAvatar + OpenAI, tandis qu’un petit script ajoute une iframe sur un site client. L’iframe possède son propre formulaire de contact et ne lit ni ne modifie le DOM du site hôte.

> Cette zone est nouvelle et autonome. Elle ne modifie pas `src/worker.js`, `functions/api/*`, `assets/js/claire-liveavatar-provider.js`, `wrangler.jsonc`, les routes DNS ou le comportement de `www.infoserv2a.pro`. InfoServ2A n’est pas encore déclaré comme tenant.

## Architecture P0

1. `claire-embed.js`, chargé par le site client, appelle `GET /api/embed/bootstrap` depuis l’origine réelle du client.
2. Le Worker compare l’en-tête navigateur `Origin` à l’allowlist exacte du tenant.
3. Il délivre un ticket de 10 minutes lié au tenant et à cette origine.
4. Le loader monte `/embed/?tenant=…`; l’iframe utilise le ticket pour ses appels same-origin.
5. `POST /api/liveavatar-session` crée un jeton LiveAvatar éphémère. Les clés LiveAvatar/OpenAI ne quittent jamais le Worker.
6. Le début et la fin de session alimentent un compteur P0 en mémoire, par tenant et par mois.

En production, `EMBED_SIGNING_SECRET` signe les tickets HMAC. Sans ce secret, le mode local utilise des tickets opaques en mémoire : pratique pour un seul processus `wrangler dev`, mais non adapté à plusieurs isolates. Pour une phase suivante, le compteur et/ou les tickets devront passer dans Durable Objects ou KV.

## Lancer localement

Prérequis : Node.js 20+ et Python 3 (uniquement pour les deux serveurs statiques de démo).

```bash
cd claire-platform
cp .dev.vars.example .dev.vars
# Renseigner les secrets dans .dev.vars si une vraie session est souhaitée.
npm test
npm run dev
```

Dans deux autres terminaux :

```bash
python3 -m http.server 4173 --directory claire-platform/demos/site-a
python3 -m http.server 4174 --directory claire-platform/demos/site-b
```

Ouvrir ensuite :

- `http://localhost:4173` — Boulangerie du Soleil
- `http://localhost:4174` — Atelier Lumière

L’interface, le bootstrap, l’allowlist et le formulaire s’affichent sans clés fournisseur. Cliquer sur « Parler à Claire » sans secrets retourne volontairement `503 PLATFORM_NOT_CONFIGURED` avec la liste des secrets manquants. Le Worker n’émet aucun trafic LiveAvatar factice.

## Secrets

Obligatoires pour une session réelle :

- `LIVEAVATAR_API_KEY`
- `OPENAI_API_KEY` **ou** `LIVEAVATAR_OPENAI_SECRET_ID`
- `EMBED_SIGNING_SECRET` pour tout environnement partagé/déployé

Facultatifs :

- `LIVEAVATAR_AVATAR_ID`
- `LIVEAVATAR_OPENAI_MODEL` (défaut : `gpt-realtime`)
- `LIVEAVATAR_CONTEXT_ID_<TENANT>` pour réutiliser un contexte
- `LEAD_WEBHOOK_<TENANT>` et `LEAD_EMAIL_<TENANT>` pour le formulaire

Exemple pour le Worker non-production dédié :

```bash
cd claire-platform
npx wrangler secret put LIVEAVATAR_API_KEY --config wrangler.claire-platform.jsonc
npx wrangler secret put OPENAI_API_KEY --config wrangler.claire-platform.jsonc
npx wrangler secret put EMBED_SIGNING_SECRET --config wrangler.claire-platform.jsonc
```

Ne jamais exécuter ces commandes avec `../wrangler.jsonc`. La configuration dédiée porte le nom distinct `claire-platform-dev`, ne déclare aucune route et ne doit jamais être renommée `infoserv2a`.

## Ajouter un tenant

Ajouter une entrée dans `src/tenants.js` avec :

- un `id` stable ;
- les origines exactes autorisées (apex et `www` séparément) ;
- le nom, l’accueil et les instructions de persona ;
- quelques connaissances vérifiées ;
- les noms de variables d’environnement pour le webhook/l’e-mail ;
- le quota mensuel et la durée maximale d’une session.

Exemple d’intégration côté client :

```html
<script
  defer
  src="https://claire-platform-dev.<account>.workers.dev/claire-embed.js"
  data-tenant="mon-tenant"
  data-origin="https://www.client.example">
</script>
```

`data-origin` est un garde-fou lisible côté client ; l’autorisation serveur se fonde sur le véritable en-tête `Origin`, puis sur le ticket signé. Aucun secret n’est placé dans ce snippet.

Les deux démos sont des sites statiques autonomes. Leur seule intégration Claire est cette balise `<script>` ; elles n’importent aucun composant, formulaire ou module du dépôt InfoServ2A.

## API

| Route | Rôle |
|---|---|
| `GET /api/embed/bootstrap?tenant=…` | Valide l’origine et émet un ticket court |
| `GET /api/tenant?tenant=…` | Configuration publique de l’iframe |
| `GET /api/liveavatar-status?tenant=…` | Prérequis fournisseur et quota |
| `POST /api/liveavatar-session` | Contrat compatible (`sessionToken`, `sessionId`, `maxSessionDuration`, etc.) |
| `POST /api/sessions/end` | Termine le comptage de la session |
| `POST /api/leads` | Envoie le lead vers le webhook du tenant |
| `GET /health` | Santé du Worker dédié |

## Limites explicites du P0

- Le metering est en mémoire : il se réinitialise au redémarrage et n’est pas coordonné entre isolates.
- La livraison d’un lead nécessite un webhook HTTPS par tenant. Sans lui, l’API répond clairement `503 LEAD_DELIVERY_NOT_CONFIGURED` au lieu de perdre silencieusement les données.
- Les connaissances sont de petits stubs versionnés. Il n’y a aucun scraping du DOM ou d’un site tiers.
- Le déploiement n’ajoute aucune route de production. Un éventuel essai doit viser uniquement `claire-platform-dev` sur `workers.dev`.

## Validation

```bash
cd claire-platform
npm test
npx wrangler@latest deploy --dry-run --config wrangler.claire-platform.jsonc
```

Le déploiement réel n’est pas nécessaire pour valider ce lot et ne doit jamais cibler `infoserv2a`.
