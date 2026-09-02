# InfoServ2A — site local

Site professionnel d'InfoServ2A, relié à Cloudflare Workers Builds. La branche `main` alimente le déploiement stable Cloudflare et les autres branches produisent des versions d’aperçu isolées avant validation.

Environnement de validation Cloudflare : `https://infoserv2a.infoserv2a.workers.dev/`.

Preview Claire (cette branche) : `https://cursor-claire-it-only-8f54-infoserv2a.infoserv2a.workers.dev/?claire=1`.

Le domaine public `https://infoserv2a.pro` pointe encore vers **GitHub Pages** (DNS OVH). LiveAvatar n’y démarre pas : Pages ne sert pas `/api/liveavatar-session`. Pour transférer l’URL vers le Worker Cloudflare (sans casser l’e-mail OVH), suivre `docs/activer-claire-sur-infoserv2a-pro.md`.

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

## Claire Live Companion — aidante Live Avatar

Le site intègre Claire, **aidante Live Avatar** mobile-first, sans exposer de secret :

- arrivée immersive avec la même Claire verticale que Pocket Guide, puis scène plein écran ou rail guidé occupant 38 % de l’écran sur ordinateur ;
- sur mobile 9:16, Claire conserve une scène haute et le site défile en dessous ; aucune bulle de support en bas à droite n’est utilisée ;
- LiveAvatar est relié à OpenAI Realtime (`gpt-realtime`, voix `marin`) : Claire accueille à la voix, parle comme une experte professionnelle (IT, sciences, métiers numériques), et le site est un catalogue d’onglets qu’elle peut parcourir ;
- Runtime V2 conserve Claire pendant la navigation interne (`#contenu`, `history.pushState`) ;
- index explicite de toutes les pages dans `data/site-knowledge.json` ;
- catalogue d’actions déclaré : `search_site`, `open_service`, `scroll_to`, `open_contact`, `prefill_quote`, `list_catalog`, `explain_page`, `go_home`, `next_page`, `prev_page`, `next_section`, `prev_section` ;
- mode manuel toujours accessible et préférence conservée pendant la session.

Plan complet : `docs/claire-aidant-plan.md`.  
Spec Figma versionnée : `/claire-aidant-figma.html` et `data/claire-aidant-figma.json`.

Le navigateur ne contient aucune clé LiveAvatar ou OpenAI. Un fournisseur temps réel doit obtenir ses jetons éphémères côté serveur, par exemple dans une Cloudflare Pages Function utilisant des secrets Cloudflare.

L’adaptateur prêt à brancher se trouve dans `assets/js/claire-liveavatar-provider.js`. Il reprend le contrat de PocketGuide : jeton éphémère, flux vidéo LiveAvatar, transcription, interruption et narration d’un résultat vérifié par l’application. Il n’est pas chargé tant que l’endpoint serveur n’est pas disponible. En cas d’échec, le mode manuel reste disponible, mais l’ancienne synthèse vocale locale est volontairement silencieuse afin de ne pas imiter la voix OpenAI Realtime de Claire.

Exemple d’activation après création de `/api/liveavatar-session` :

```js
import { InfoServ2ALiveAvatarProvider } from "./assets/js/claire-liveavatar-provider.js";

addEventListener("infoserv:claire-ready", (event) => {
  event.detail.registerProvider(new InfoServ2ALiveAvatarProvider());
}, { once: true });
```

La politique CSP du dépôt autorise uniquement la version épinglée du SDK, l’API LiveAvatar et les flux média nécessaires. Les clés restent exclusivement dans les secrets Cloudflare.

Les fonctions serveur sont dans `functions/api/` et le point d’entrée Cloudflare Worker dans `src/worker.js` les expose sous `/api/` tout en servant les fichiers statiques via le binding `ASSETS` :

- `liveavatar-status.js` active automatiquement l’adaptateur seulement si les bindings requis existent ;
- `liveavatar-session.js` accepte uniquement une requête de même origine, crée ou réutilise le contexte Claire et renvoie un jeton de session de cinq minutes ;
- `send-email.js` envoie réellement contact et devis vers `contact@` / `devis@infoserv2a.pro` (Resend si `RESEND_API_KEY`, sinon FormSubmit). Claire ne dit « c’est parti » que si cette route confirme l’envoi ;
- en cas d’absence ou d’échec LiveAvatar, l’interface indique explicitement que la voix native du navigateur est un mode local de secours.

Bindings Cloudflare à créer sans fichier local :

- secret chiffré `LIVEAVATAR_API_KEY` ;
- secret chiffré `OPENAI_API_KEY`, ou identifiant `LIVEAVATAR_OPENAI_SECRET_ID` si le secret OpenAI existe déjà chez LiveAvatar ;
- variable optionnelle `LIVEAVATAR_AVATAR_ID` (l’identité Claire de Pocket Guide est utilisée par défaut) ;
- variable optionnelle `LIVEAVATAR_CONTEXT_ID` après la première création du contexte.

Les fichiers `.env*` et `.dev.vars*` sont ignorés par Git. Aucun n’est nécessaire pour le déploiement : les valeurs de production et de prévisualisation doivent être définies dans **Cloudflare > Workers & Pages > projet > Settings > Variables and Secrets**. La configuration `wrangler.jsonc` exécute le Worker uniquement pour `/api/*` et laisse Cloudflare servir directement les autres actifs.

Pour reconstruire les blocs partagés et injecter les assets Claire dans toutes les pages :

```bash
python build_pages.py
```

Pour tester le moteur de routage :

```bash
node --test tests/claire-core.test.mjs
```

## Claire Runtime V2 — laboratoire P0

La route isolée **/claire-lab** valide le contrôleur avant de rebrancher la
voix et l’avatar. Elle ne charge ni OpenAI Realtime, ni LiveKit, ni LiveAvatar
et n’utilise aucun secret côté navigateur.

```bash
python -m http.server 8000
```

Puis ouvrir **http://localhost:8000/claire-lab.html**.

Le laboratoire sépare :

- le manifeste **data/claire-capabilities.json**, qui limite les actions au
  catalogue d’onglets déclaré (recherche, ouverture, sections, contact, devis,
  accueil, onglet suivant/précédent) ;
- le contrôleur **assets/js/claire-runtime-v2.mjs**, source de vérité de la
  machine à états et du journal ;
- l’adaptateur **assets/js/claire-site-adapter.mjs**, qui simule le site sans
  navigation ni soumission ;
- l’interface **claire-lab.html**, responsive S22, tablette et ordinateur.

Le scénario P0 de référence est : « Affiche les solutions de vidéosurveillance
sans fibre. » Il doit exécuter dans l’ordre **search_site**, **open_service**,
**scroll_to**, puis vérifier la page et l’ancre attendues.

```bash
node --test tests/claire-runtime-v2.test.mjs
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
