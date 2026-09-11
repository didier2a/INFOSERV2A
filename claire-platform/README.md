# Claire Platform P0

Plateforme Claire multi-tenant isolée : un Worker héberge le cerveau LiveAvatar + OpenAI, tandis qu’un petit script ajoute une iframe sur un site client. L’iframe possède son propre formulaire de contact et ne lit ni ne modifie le DOM du site hôte.

> Cette zone est nouvelle et autonome. Elle ne modifie pas `src/worker.js`, `functions/api/*`, `assets/js/claire-liveavatar-provider.js`, `wrangler.jsonc`, les routes DNS ou le comportement de `www.infoserv2a.pro`. InfoServ2A n’est pas encore déclaré comme tenant.

## Architecture P0

1. `claire-embed.js`, chargé par le site client, appelle `GET /api/embed/bootstrap` depuis l’origine réelle du client.
2. Le Worker compare l’en-tête navigateur `Origin` à l’allowlist exacte du tenant.
3. Il délivre un ticket de 10 minutes lié au tenant et à cette origine.
4. Le loader monte `/embed/?tenant=…`; l’iframe utilise le ticket pour ses appels same-origin.
   Une ouverture dogfood directe de `/embed/?tenant=…` sans fragment demande elle-même ce ticket au bootstrap.
5. `POST /api/liveavatar-session` crée un jeton LiveAvatar éphémère. Les clés LiveAvatar/OpenAI ne quittent jamais le Worker.
6. Un Durable Object SQLite par tenant persiste les tickets, les sessions actives et le quota mensuel.

`EMBED_SIGNING_SECRET` signe les tickets HMAC. Il est obligatoire dès que `CLAIRE_ENVIRONMENT` n’est pas `local`, `development` ou `test`. En local/dev seulement, des tickets opaques restent possibles, mais ils sont eux aussi conservés dans le Durable Object et non dans la mémoire d’un isolate.

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

Configuration non secrète :

- `CLAIRE_ENVIRONMENT` vaut `development` dans la configuration dogfood. Toute autre valeur hors `local|development|test` fait échouer le bootstrap avec un `503` tant que `EMBED_SIGNING_SECRET` manque.

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

Ne jamais exécuter ces commandes avec `../wrangler.jsonc`. La configuration dédiée porte le nom distinct `claire-platform-dev`, ne déclare aucune route et ne doit jamais être renommée `infoserv2a`. Le script `npm run guard:worker` bloque tout autre nom, toute route et toute autre entrée Worker.

### Étape exacte pour Didier après authentification

Cet environnement agent n’est pas authentifié auprès de Cloudflare ; aucun Worker distant n’a donc été créé. Depuis un poste autorisé :

```bash
cd claire-platform
npx wrangler@latest login
npx wrangler@latest whoami
npx wrangler@latest secret put LIVEAVATAR_API_KEY --config wrangler.claire-platform.jsonc
npx wrangler@latest secret put OPENAI_API_KEY --config wrangler.claire-platform.jsonc
npx wrangler@latest secret put EMBED_SIGNING_SECRET --config wrangler.claire-platform.jsonc
npm run deploy:dev
```

La dernière commande exécute d’abord le garde-fou, puis doit annoncer une URL `https://claire-platform-dev.<sous-domaine>.workers.dev`. Vérifier `https://…/health`, puis remplacer uniquement le `src` du snippet de démo par cette origine. Cette procédure ne touche pas le Worker `infoserv2a` et n’ajoute aucune route à `infoserv2a.pro`.

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

Le Worker dogfood expose aussi deux pages hôtes autonomes :

- `/demo-boulangerie.html`
- `/demo-atelier.html`

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

- Le metering et les tickets sont persistés et coordonnés par un Durable Object par tenant. Ce P0 ne fournit pas encore de tableau de bord ni d’export de consommation.
- La livraison d’un lead nécessite un webhook HTTPS par tenant. Sans lui, l’API répond clairement `503 LEAD_DELIVERY_NOT_CONFIGURED` au lieu de perdre silencieusement les données.
- Les connaissances sont de petits stubs versionnés. Il n’y a aucun scraping du DOM ou d’un site tiers.
- Le déploiement n’ajoute aucune route de production. Un éventuel essai doit viser uniquement `claire-platform-dev` sur `workers.dev`.

## Garde-fous CI / Workers Builds

- La racine `.assetsignore` contient `claire-platform/` : aucun fichier plateforme ne peut entrer dans les assets des previews du Worker InfoServ2A.
- `.github/workflows/claire-platform-guard.yml` exécute les tests et un bundle dry-run sur toute modification de cette zone.
- `scripts/assert-safe-worker-config.mjs` exige exactement `name = "claire-platform-dev"`, `main = "src/worker.js"` et aucune route.
- Pour Workers Builds, définir **Root directory** sur `claire-platform`, **Build command** sur `npm test` et **Deploy command** sur `npm run deploy:dev`. Ne jamais sélectionner `wrangler.jsonc` à la racine.

Les tests incluent un contre-test qui injecte volontairement `name: "infoserv2a"` et vérifie le refus.

## Validation

```bash
cd claire-platform
npm test
npm run deploy:dry-run
```

Le déploiement réel n’est pas nécessaire pour valider ce lot et ne doit jamais cibler `infoserv2a`.

Les pistes P1 non bloquantes sont consignées dans `docs/p1-notes.md`.
