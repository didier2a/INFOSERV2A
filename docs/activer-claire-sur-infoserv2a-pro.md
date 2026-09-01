# Activer Claire Live Avatar sur infoserv2a.pro

Date : 1er septembre 2026  
Objectif : que `https://infoserv2a.pro/?claire=1` serve **le même Worker Cloudflare** que la preview, et plus GitHub Pages.

## 0. Où on en est (mesure du 1er septembre 2026, 19:30 UTC)

Les serveurs de noms sont bien Cloudflare (`ian.ns.cloudflare.com` / `sarah.ns.cloudflare.com`). `www` est déjà le Worker. **La racine `infoserv2a.pro` est encore GitHub Pages.**

| URL | Qui répond | `/api/liveavatar-status` | LiveAvatar |
|---|---|---|---|
| [Preview Workers](https://cursor-live-avatar-aidant-8f54-infoserv2a.infoserv2a.workers.dev/?claire=1) | Worker de la branche (Aidant 1.7) | `configured: true` | OK |
| [https://www.infoserv2a.pro](https://www.infoserv2a.pro/?claire=1) | Worker **production** (`claire-companion.js?v=20260830-live2`) | JSON `configured: false` | Non (clé OpenAI absente) |
| [Worker `main`](https://infoserv2a.infoserv2a.workers.dev/) | Worker production | `configured: false` (`openAIRealtime: false`) | Non |
| [https://infoserv2a.pro](https://infoserv2a.pro/?claire=1) | **GitHub Pages** (`server: GitHub.com`, `x-github-request-id`) | **404 HTML** | Non |

Deux clics restent, dans cet ordre :

1. **Domaine racine** — attacher `infoserv2a.pro` (sans `www`) au Worker. Tant que les enregistrements A GitHub (`185.199.x.x`) existent pour `@`, Cloudflare refuse ou ignore le Custom Domain de la racine. Voir [B4](#b4-attacher-le-domaine-au-worker).
2. **Secret OpenAI en production** — même valeur que la preview. Sans ça, même `www` et le Worker `main` restent en `configured: false`. Voir [étape A](#étape-a--secrets-production-5-minutes-aucun-dns).

Ne fusionner la [PR #4](https://github.com/didier2a/INFOSERV2A/pull/4) que lorsque vous le demanderez : aujourd’hui la production sert encore l’ancien client `live2`, pas Aidant 1.7.

## 1. Pourquoi la preview marche et pas le domaine public

GitHub Pages ne peut pas exécuter `functions/api/liveavatar-session.js`. Sans ce jeton éphémère, LiveAvatar ne démarre pas. Un simple « transfert d’URL » dans GitHub ne suffit pas : il faut que **le nom de domaine arrive sur le Worker**.

Le client encore publié sur l’apex (`claire-companion.js?v=20260831-live11`) n’appelle que `/api/liveavatar-status` en même origine. Il n’a pas encore le repli vers `*.workers.dev`.

Historique DNS (avant la bascule NS) : zone chez OVH (`ns13.ovh.net` / `dns13.ovh.net`), A GitHub Pages `185.199.108–111.153`, CNAME `www → didier2a.github.io`. GitHub Pages est toujours déclaré : `cname: infoserv2a.pro`, source `main`.

## 2. Ce que Cursor ne peut pas faire à votre place

Ces actions sont dans **votre** compte Cloudflare (et OVH pour les NS, déjà faits). Pas de jeton API dans cet environnement, donc je ne peux pas cliquer à votre place :

1. ~~Ajouter la zone `infoserv2a.pro` dans Cloudflare.~~ **Fait** (zone Active, NS `ian` / `sarah`).
2. ~~Changer les serveurs de noms chez OVH.~~ **Fait**.
3. Coller le secret `OPENAI_API_KEY` sur le Worker **production** (la preview l’a déjà ; `main` non).
4. Attacher le Custom Domain **`infoserv2a.pro`** (sans `www`) au Worker — `www` est déjà le Worker.

L’e-mail OVH (`mx1/2/3.mail.ovh.net`, SPF `include:mx.ovh.com`) doit rester en proxy **gris**. Ne pas orange-clouder les MX.

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

4. Fusionner la PR [#4](https://github.com/didier2a/INFOSERV2A/pull/4) dans `main` **seulement si vous le demandez** : ça publie Aidant 1.7 (interruption + synchro de l’onglet) sur le Worker production. Sans fusion, `www` et la racine resteront sur l’ancien client `live2`.

### Étape B — DNS Cloudflare + domaine du Worker (le vrai transfert d’URL)

B1–B3 sont **faits**. Il reste B4 (racine) puis B5 après recette.

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

Quand la zone est **Active**. `www.infoserv2a.pro` est déjà le Worker ; il manque **uniquement** la racine.

Cloudflare **ne peut pas** créer un Custom Domain sur un nom qui a déjà un CNAME, et ignore souvent la racine tant que les A GitHub sont encore là. Il faut d’abord les retirer.

1. [DNS → Records de `infoserv2a.pro`](https://dash.cloudflare.com/45aac699cfed86fedb9631852dc1aaeb/infoserv2a.pro/dns/records).
2. Pour le nom `@` / `infoserv2a.pro`, **supprimer** les A (et AAAA) vers GitHub Pages : `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`. Ne **pas** toucher aux MX, SPF, `autoconfig`, `autodiscover`.
3. Worker `infoserv2a` → [Settings → Domains & Routes](https://dash.cloudflare.com/45aac699cfed86fedb9631852dc1aaeb/workers/services/view/infoserv2a/production) → **Add → Custom Domain**.
4. Taper exactement `infoserv2a.pro` (sans `www`, sans `https://`) → **Add Custom Domain**.
5. Vérifier que `www.infoserv2a.pro` figure déjà dans la liste. S’il n’y est pas, l’ajouter aussi.

Attendu ensuite : `curl -sI https://infoserv2a.pro/` affiche `server: cloudflare` et **plus** `x-github-request-id`. `/api/liveavatar-status` doit renvoyer du JSON (même si `configured` est encore `false` tant que l’étape A n’est pas faite).

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
| `www` est le Worker, l’apex reste `server: GitHub.com` | Custom Domain seulement sur `www`, A GitHub encore sur `@` | Supprimer les A `185.199.x.x` puis ajouter le Custom Domain `infoserv2a.pro` (B4) |
| Custom Domain refusé (« existing CNAME / DNS record ») | Enregistrements GitHub encore présents | Les supprimer dans DNS → Records, puis réessayer B4 |
| Claire en mode local sur `.pro`, API 404, `server: GitHub.com` | Racine encore GitHub Pages | B4 incomplet |
| API JSON `"configured":false` / `"openAIRealtime":false` | Secret OpenAI absent en production | Étape A |
| Site OK, plus aucun mail | MX / SPF oubliés dans Cloudflare | Recréer le tableau B1, proxy gris |
| Preview OK, `www` cassé | Custom Domain seulement sur l’apex | Ajouter `www.infoserv2a.pro` |
| Certificat en erreur | Zone pas encore Active | Attendre les NS, ne pas forcer HTTPS chez OVH |
