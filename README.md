# InfoServ2A — site local

Site professionnel d'InfoServ2A, destiné aux tests locaux. Aucun déploiement GitHub Pages, Cloudflare Pages, DNS ou domaine de production n'est configuré à ce stade.

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
