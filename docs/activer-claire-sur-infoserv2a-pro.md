# Activer Claire Live Avatar sur infoserv2a.pro

Date : 1er septembre 2026  
Objectif : que `https://infoserv2a.pro/?claire=1` serve **le même Worker Cloudflare** que la preview, et plus GitHub Pages.

## 1. Pourquoi la preview marche et pas le domaine public

Mesure du 1er septembre 2026 :

| URL | Qui répond | `/api/liveavatar-status` | LiveAvatar |
|---|---|---|---|
| [Preview Workers](https://cursor-live-avatar-aidant-8f54-infoserv2a.infoserv2a.workers.dev/?claire=1) | Cloudflare Worker de la branche | `configured: true` (clé LiveAvatar **et** OpenAI) | OK |
| [Worker `main`](https://infoserv2a.infoserv2a.workers.dev/) | Cloudflare Worker production | `configured: false` (`openAIRealtime: false`) | Non |
| [https://infoserv2a.pro](https://infoserv2a.pro/?claire=1) | **GitHub Pages** (`server: GitHub.com`) | **404 HTML** (pas de fonction serveur) | Non |

Le DNS public n’est **pas** chez Cloudflare :

- Serveurs de noms : `ns13.ovh.net` / `dns13.ovh.net` (OVH).
- `infoserv2a.pro` A → `185.199.108–111.153` (GitHub Pages).
- `www` CNAME → `didier2a.github.io`.
- GitHub Pages est bien déclaré : `cname: infoserv2a.pro`, source `main`.

GitHub Pages ne peut pas exécuter `functions/api/liveavatar-session.js`. Sans ce jeton éphémère, LiveAvatar ne démarre pas. Un simple « transfert d’URL » dans GitHub ne suffit pas : il faut que **le nom de domaine arrive sur le Worker**.

Le client actuellement publié sur `.pro` (`claire-companion.js?v=20260831-live11`) n’appelle que `/api/liveavatar-status` en même origine. Il n’a pas encore le repli vers `*.workers.dev`.

## 2. Ce que Cursor ne peut pas faire à votre place

Ces actions sont dans **votre** compte OVH et **votre** compte Cloudflare. Elles exigent d’être connecté en propriétaire du domaine :

1. Ajouter la zone `infoserv2a.pro` dans Cloudflare.
2. Changer les serveurs de noms chez OVH.
3. Coller le secret `OPENAI_API_KEY` sur le Worker **production** (la preview l’a déjà ; `main` non).
4. Attacher le domaine personnalisé au Worker `infoserv2a`.

L’e-mail OVH (`mx1/2/3.mail.ovh.net`, SPF `include:mx.ovh.com`) **doit** être recopié **avant** le changement de NS, sinon `contact@` / `devis@` / `support@` cassent.

## 3. Deux étapes, dans cet ordre

### Étape A — secrets production (5 minutes, aucun DNS)

Sans ça, même après la bascule DNS, Claire tombera en mode local.

1. Ouvrir [Workers & Pages → infoserv2a → Settings → Variables and Secrets](https://dash.cloudflare.com/45aac699cfed86fedb9631852dc1aaeb/workers/services/view/infoserv2a/production).
2. Recopier **sur production** les mêmes secrets que la preview :
   - `LIVEAVATAR_API_KEY` (déjà présent : `liveAvatar: true` sur le Worker `main`)
   - `OPENAI_API_KEY` **ou** `LIVEAVATAR_OPENAI_SECRET_ID` (**absent** aujourd’hui)
   - optionnel `LIVEAVATAR_AVATAR_ID`, `LIVEAVATAR_CONTEXT_ID`
3. Vérifier :

```bash
curl -s https://infoserv2a.infoserv2a.workers.dev/api/liveavatar-status
```

Attendu : `"configured":true` et `"openAIRealtime":true`.

4. Fusionner la PR [#4](https://github.com/didier2a/INFOSERV2A/pull/4) dans `main` pour que le Worker production et, tant que le DNS n’a pas bougé, GitHub Pages reçoivent Claire Aidant 1.7. Après fusion, le site `.pro` pourra aussi appeler le Worker en CORS (repli `LIVEAVATAR_CLOUD_FALLBACKS`) **en attendant** l’étape B.

### Étape B — DNS Cloudflare + domaine du Worker (le vrai transfert d’URL)

Prérequis : un compte Cloudflare, **le même** que le Worker `infoserv2a` (compte `45aac699cfed86fedb9631852dc1aaeb`).

#### B1. Inventaire DNS actuel à recopier tel quel

À créer dans Cloudflare **avant** de changer les NS chez OVH. Proxy **gris** (DNS only) pour tout ce qui n’est pas le site web.

| Type | Nom | Valeur | Proxy |
|---|---|---|---|
| MX | `@` | `mx1.mail.ovh.net` priorité **1** | n/a |
| MX | `@` | `mx2.mail.ovh.net` priorité **5** | n/a |
| MX | `@` | `mx3.mail.ovh.net` priorité **100** | n/a |
| TXT | `@` | `v=spf1 include:mx.ovh.com ~all` | n/a |
| TXT | `@` | `google-site-verification=B8FvRHnDps3h10uYUltEDUAmRmo2Betl48_u0DwMY-4` | n/a |
| CNAME | `autodiscover` | `mailconfig.ovh.net` | DNS only |
| CNAME | `autoconfig` | `mailconfig.ovh.net` | DNS only |

Ne **pas** recopier les A GitHub (`185.199.x.x`) ni le CNAME `www → didier2a.github.io` : Cloudflare les remplacera par le Worker.

Le TXT OVH `1|www.infoserv2a.pro` est une redirection interne OVH : inutile une fois Cloudflare autoritaire.

#### B2. Ajouter le site dans Cloudflare

1. [Add a site](https://dash.cloudflare.com/?to=/:account/add-site) → `infoserv2a.pro`.
2. Plan **Free** suffit.
3. Cloudflare scanne les enregistrements : **corriger** pour coller le tableau ci-dessus.
4. Noter les deux serveurs de noms attribués, du type `xxxx.ns.cloudflare.com`.

#### B3. Changer les NS chez OVH (le domaine reste enregistré chez OVH)

1. [OVHcloud → Noms de domaine → infoserv2a.pro → Serveurs DNS](https://www.ovh.com/manager/#/web/domain/infoserv2a.pro/dns).
2. Remplacer `ns13.ovh.net` / `dns13.ovh.net` par les deux `*.ns.cloudflare.com`.
3. Ne **pas** toucher aux MX dans le manager OVH une fois les NS changés : la zone autoritaire sera Cloudflare.
4. Attendre que `dig NS infoserv2a.pro` affiche Cloudflare (souvent minutes, parfois quelques heures). Le tableau de bord Cloudflare passe de *Pending Nameserver Update* à *Active*.

#### B4. Attacher le domaine au Worker

Quand la zone est **Active** :

1. Worker `infoserv2a` → **Settings → Domains & Routes → Add → Custom Domain**.
2. Ajouter `infoserv2a.pro`.
3. Ajouter `www.infoserv2a.pro` (sinon `www` ne reçoit pas Claire).
4. Cloudflare crée les DNS et le certificat. Les A GitHub Pages disparaissent au profit du Worker.

Ne **pas** mettre `"custom_domain": true` dans `wrangler.jsonc` tant que la zone n’est pas Active : un déploiement de **preview** volerait le domaine. Après l’étape B4, on pourra l’ajouter sur `main` uniquement :

```jsonc
"routes": [
  { "pattern": "infoserv2a.pro", "custom_domain": true },
  { "pattern": "www.infoserv2a.pro", "custom_domain": true }
]
```

#### B5. Nettoyage GitHub Pages (après que `.pro` réponde `server: cloudflare`)

1. Dépôt INFOSERV2A → **Settings → Pages** : retirer le custom domain `infoserv2a.pro` (évite un certificat GitHub orphelin).
2. Le fichier `CNAME` du dépôt peut rester ou être retiré plus tard ; il ne pilote plus le DNS.

## 4. Recette après bascule

```bash
# Le domaine public est le Worker, plus GitHub Pages
curl -sI https://infoserv2a.pro/ | tr -d '\r' | grep -i '^server:'

# L’API existe enfin en même origine
curl -s https://infoserv2a.pro/api/liveavatar-status

# L’e-mail OVH est intact
dig +short MX infoserv2a.pro
dig +short TXT infoserv2a.pro
```

Attendu :

- `server: cloudflare`
- JSON `"configured":true`
- MX inchangés vers `mx*.mail.ovh.net`

Puis hard-reload `https://infoserv2a.pro/?claire=1` : Claire doit se connecter comme sur la preview, sans passer par `*.workers.dev`.

## 5. Si quelque chose casse

| Symptôme | Cause probable | Remède |
|---|---|---|
| Claire en mode local sur `.pro`, API 404, `server: GitHub.com` | DNS encore OVH → GitHub Pages | Étape B incomplète |
| API JSON `"openAIRealtime":false` | Secret OpenAI absent en production | Étape A |
| Site OK, plus aucun mail | MX / SPF oubliés dans Cloudflare | Recréer le tableau B1, proxy gris |
| Preview OK, `www` cassé | Custom Domain seulement sur l’apex | Ajouter `www.infoserv2a.pro` |
| Certificat en erreur | Zone pas encore Active | Attendre les NS, ne pas forcer HTTPS chez OVH |
