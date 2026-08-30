# InfoServ2A — site local

Site professionnel d'InfoServ2A, relié à Cloudflare Workers Builds. La branche `main` alimente le déploiement stable Cloudflare et les autres branches produisent des versions d’aperçu isolées avant validation.

Environnement de validation Cloudflare : `https://infoserv2a.infoserv2a.workers.dev/`.

Futur domaine : `https://infoserv2a.pro`

## Lancement local

Un serveur HTTP est nécessaire (les chemins, formulaires et éventuels chargements JSON ne sont pas prévus pour un simple double-clic sur `index.html`).

```bash
cd infoserv2a
python -m http.server 8000
```

Puis ouvrir :

```text
http://localhost:8000
```

## Structure du projet

- `*.html` — pages du site
- `assets/css/` — variables, styles globaux, composants, responsive
- `assets/js/` — navigation, formulaires (mode simulation en local)
- `assets/images/` — logo, visuels d'accueil, vidéosurveillance, web, réalisations
- `assets/icons/` — pictogrammes SVG
- `data/` — contenus JSON (services, réalisations, FAQ)
- `partials/` — header et footer de référence (également intégrés dans chaque page pour fonctionner sans injection JavaScript)

## Claire Live Companion

Le site intègre un compagnon de navigation mobile-first sans exposer de secret :

- arrivée immersive au premier accès, puis dialogue partagé et médaillon en mode manuel ;
- dictée et synthèse vocales natives lorsque le navigateur les propose ;
- index explicite de toutes les pages dans `data/site-knowledge.json` ;
- routage déterministe vers les pages et sections, sans invention de contenu ;
- mode manuel toujours accessible et préférence conservée pendant la session ;
- API cliente `window.InfoServClaire.registerProvider(provider)` pour brancher ultérieurement LiveAvatar depuis un service sécurisé.

Le navigateur ne contient aucune clé LiveAvatar ou OpenAI. Un fournisseur temps réel doit obtenir ses jetons éphémères côté serveur, par exemple dans une Cloudflare Pages Function utilisant des secrets Cloudflare.

L’adaptateur prêt à brancher se trouve dans `assets/js/claire-liveavatar-provider.js`. Il reprend le contrat éprouvé dans PocketGuide : jeton éphémère, flux vidéo LiveAvatar, transcription, interruption et narration d’un résultat vérifié par l’application. Il n’est pas chargé tant que l’endpoint serveur n’est pas disponible, afin que le site reste autonome et que la voix locale assure le repli.

Exemple d’activation après création de `/api/liveavatar-session` :

```js
import { InfoServ2ALiveAvatarProvider } from "./assets/js/claire-liveavatar-provider.js";

addEventListener("infoserv:claire-ready", (event) => {
  event.detail.registerProvider(new InfoServ2ALiveAvatarProvider());
}, { once: true });
```

La politique CSP du dépôt autorise uniquement la version épinglée du SDK, l’API LiveAvatar et les flux média nécessaires. Les clés restent exclusivement dans les secrets Cloudflare.

Les Pages Functions prêtes au déploiement sont dans `functions/api/` :

- `liveavatar-status.js` active automatiquement l’adaptateur seulement si les bindings requis existent ;
- `liveavatar-session.js` accepte uniquement une requête de même origine, crée ou réutilise le contexte Claire et renvoie un jeton de session de cinq minutes ;
- en cas d’absence ou d’échec LiveAvatar, Claire repasse automatiquement à la voix native du navigateur.

Bindings Cloudflare à créer sans fichier local :

- secret chiffré `LIVEAVATAR_API_KEY` ;
- secret chiffré `OPENAI_API_KEY`, ou identifiant `LIVEAVATAR_OPENAI_SECRET_ID` si le secret OpenAI existe déjà chez LiveAvatar ;
- variable `LIVEAVATAR_AVATAR_ID` ;
- variable optionnelle `LIVEAVATAR_CONTEXT_ID` après la première création du contexte.

Les fichiers `.env*` et `.dev.vars*` sont ignorés par Git. Aucun n’est nécessaire pour le déploiement : les valeurs de production et de prévisualisation doivent être définies dans **Cloudflare > Workers & Pages > projet > Settings > Variables and Secrets**.

Pour reconstruire les blocs partagés et injecter les assets Claire dans toutes les pages :

```bash
python build_pages.py
```

Pour tester le moteur de routage :

```bash
node --test tests/claire-core.test.mjs
```

## Formulaires

En local, l'envoi est simulé. Un message indique clairement qu'aucun e-mail n'a été envoyé.

Plus tard, brancher :

- contact → `contact@infoserv2a.pro` via `data-endpoint` sur `#contact-form`
- devis → `devis@infoserv2a.pro` via `data-endpoint` sur `#devis-form`

L'assistance client est prévue à `support@infoserv2a.pro`.

## Points restant à faire avant la mise en production

- configuration réelle des formulaires (Cloudflare Workers / Pages Functions ou autre backend)
- création et configuration des boîtes e-mail (`contact@`, `devis@`, `support@`)
- vérification des mentions légales (identité, adresse, directeur de publication, hébergeur)
- politique de confidentialité définitive, notamment la durée de conservation
- éventuelle optimisation finale des images
- configuration GitHub
- configuration Cloudflare Pages
- configuration DNS
- activation du domaine `infoserv2a.pro`
- remplacement éventuel du logo par une version vectorielle définitive
