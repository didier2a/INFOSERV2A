# Audit UX oral + écrit — www.infoserv2a.pro

**Date :** 6 septembre 2026  
**Commanditaire :** Didier Aouizerate / InfoServ2A  
**Objectif :** évaluer l’expérience **à l’oral** (Claire LiveAvatar) et **à l’écrit** (site, composer, formulaires), puis la **pertinence** des réponses, pour améliorer le système public.

**Cible vécue :** `https://www.infoserv2a.pro`  
**Aussi mesuré :** `https://infoserv2a.pro` (apex, sans www) · preview it38 (non publiée)

---

## Résumé exécutif

Le site public **www** n’est plus l’ancien client `live2`. Au 6 septembre 2026 il sert le Worker **it37** (`claire-companion.js?v=20260905-it37`). LiveAvatar est **configuré** (`openAIRealtime: true`, voix `marin`, mode LITE). L’envoi Resend est **configuré**, destination = **e-mail saisi dans le formulaire**, Reply-To `contact@infoserv2a.pro`.

Ce que le visiteur **voit et peut faire** aujourd’hui est déjà un vrai produit : catalogue local, devis, contact, Claire en modal / rail, écriture « Écrire à Claire », voix qui se connecte.

Ce qui **empêche** encore une boucle simple (parler → Claire écrit le besoin → « c’est bon » → mail propre) :

1. **Le corps du mail sur www colle encore la conversation orale** (puces « Bonjour Claire… », « Je veux… »). La synthèse écrite (paragraphe) existe en preview **it38** (PR #8), pas sur www.
2. **L’apex `infoserv2a.pro` n’est pas le Worker.** Le HTML it37 y est servi par GitHub Pages. Toutes les API (`/api/liveavatar-status`, `/api/liveavatar-session`, `/api/send-email`) répondent **404**. Claire *s’affiche* ; elle **ne peut pas** tenir une session ni envoyer un mail en même origine.
3. **Double rituel d’accueil.** LiveAvatar dit le welcome long, puis la mémoire force « Je reprends. » Les deux se collent. Le visiteur ne sait pas s’il commence ou s’il reprend.
4. **Claire plein écran dès l’arrivée desktop** (`?claire=1` / première session). Fort, mais intrusif. L’écrit du site passe au second plan.
5. **Pertinence orale** : le prompt est bon (pas de tarif inventé, recentrage loisir). Le classifieur est un **filet d’expressions**. Un métier hors liste, ou un loisir mal cadré, tombe en `chat` générique. La vérité d’envoi dépend du Worker ; Claire peut encore **annoncer** trop tôt si le marqueur n’arrive pas.
6. **Formulaires écrits** complets et clairs, mais **sans placeholder**, **sans astérisque** « obligatoire », et **sans que Claire remplisse le champ** tant qu’on n’a pas vraiment parlé d’un besoin (boucle non visible pour un premier visiteur).
7. **Mobile :** hamburger → Contact **marche**. Un tap sur un champ devis **n’ouvre plus** Claire (progrès vs audit it34). La barre « Reprendre avec Claire » peut **chevaucher** le bas du formulaire.

**Indice d’optimalité (nouveau barème oral + écrit + pertinence, 27 critères) : 68 %.**  
**Cible après les P0 de ce rapport : 86 %.**

---

## 0. Méthode et limites

| Source | Quoi |
|---|---|
| Curl 6 sept. 10:56–11:13 UTC | Headers, assets `?v=`, JSON `/api/liveavatar-status`, `/api/send-email`, apex 404 |
| Navigateur Chrome | Accueil, Offres / Vidéosurveillance, Devis, Contact, Claire ouverte, Parler, composer |
| Mobile 390×844 | Hamburger, Contact, Devis, focus champ, rail Claire |
| Code `main` @ `2a872b4` | it37 : synthèse **à puces** (dump des tours) |
| Code preview it38 | PR #8 : paragraphe écrit, plus de dialogue |
| Audits antérieurs | 2 sept. (58 %) · 4 sept. it34 (65 %) |

**Non recetté ici (à faire par Didier, téléphone réel) :**

- Une session vocale **stable ≥ 60 s** avec micro humain.
- Un envoi oral « c’est bon » **réel** (on n’a pas cliqué Envoyer).
- Clic Contact **pendant** qu’elle parle caméras.
- Qualité de **pertinence** sur 10 phrases métier corses (resto, cabinet, chantier 4G).

Le labo a obtenu « Claire · LiveAvatar Realtime · son actif » et le welcome vocal. Ce n’est **pas** une recette humaine complète.

Contamination labo : le Chrome de l’agent avait une **mémoire de session** d’essais précédents (« Test Doigt », « Je reprends »). Un visiteur neuf ne verra pas « Test Doigt ». Il verra en revanche le **même** mécanisme (mémoire collante + cue « Je reprends »).

---

## 1. Carte du système (ce que le visiteur gouverne)

Trois gouvernails, pas deux.

| Gouvernail | Sens | Règle d’autorité aujourd’hui | Trous |
|---|---|---|---|
| **Écrit site** | Formulaire, nav, hamburger | Le visiteur tape / clique. Le site est la vérité des pages | Placeholders absents ; apex sans API |
| **Écrit Claire** | Composer « Écrire à Claire » | Marqueur `[INFOSERV2A_USER_TEXT]` → réponse Realtime | Invisible tant que Claire n’est pas ouverte ; en arrival, il faut d’abord « Parler » ou ouvrir Conversation |
| **Oral Claire** | Micro LiveAvatar | Realtime `gpt-realtime` / `marin` + runtime site (nav, devis, envoi) | Coupure de session ; 5 min si le plan refuse 10 ; accueil + « Je reprends » |

Règle produit visée (inchangée depuis it34) :

> Une action : parler ou écrire. Le site suit. Le devis se remplit. « C’est bon » envoie. Le mail contient **uniquement** la synthèse écrite du besoin.

Sur www it37, la dernière phrase est **fausse** : le mail contient les **tours oraux**.

---

## 2. Surfaces publiques mesurées

### 2.1 www.infoserv2a.pro — Worker production

| Mesure | Valeur 6 sept. 2026 |
|---|---|
| HTML / assets | `claire-companion.js?v=20260905-it37` |
| `/api/liveavatar-status` | `configured: true`, LITE, `marin`, `gpt-realtime`, `openAIRealtime: true` |
| `/api/send-email` GET | `configured: true`, Resend, `destination: visitor-email`, `replyTo: contact@infoserv2a.pro` |
| `/devis.html`, `/contact.html` | 307 → `/devis`, `/contact` |
| Temps TTFB accueil | ~80 ms |
| CSP | `script-src 'self' 'unsafe-inline' https://unpkg.com` — **bloque** `static.cloudflareinsights.com` |

Le Worker **sait** envoyer. Le secret OpenAI **est** là (contrairement au 2 septembre).

### 2.2 infoserv2a.pro (apex)

| Mesure | Valeur |
|---|---|
| Origine | GitHub Pages (`x-github-request-id`) |
| HTML | it37 (même client visuel) |
| `/api/liveavatar-status` | **404 HTML** |
| `/api/liveavatar-session` | **404** |
| `/api/send-email` | **404** |
| `/liveavatar-status` (sans `/api`) | **404** |

Conséquence : un client qui tape `infoserv2a.pro` (sans www) voit Claire, peut croire qu’elle marche, puis **échoue** à l’oral et à l’envoi. C’est le pire des deux mondes : UI complète, cerveau coupé.

Étape restante : Custom Domain apex sur le Worker (doc `activer-claire-sur-infoserv2a-pro.md`, B4). Un agent Cursor **ne peut pas** cliquer ça.

### 2.3 Preview it38 (pas www)

`https://cursor-claire-mail-synthesis-8f54-infoserv2a.infoserv2a.workers.dev/` · assets `20260905-it38` · contexte LiveAvatar **Aidant 1.29**.  
Corps de mail = paragraphe « Le visiteur a indiqué qu’il souhaite… ». PR : https://github.com/didier2a/INFOSERV2A/pull/8

---

## 3. Expérience écrite du site (sans parler)

### 3.1 Accueil

- Titre : « Un prestataire local pour sécuriser, publier et dépanner vos outils numériques ».
- Zone Porto-Vecchio / Corse-du-Sud lisible.
- CTA : **Demander un devis** (plein) · **Nous contacter** (contour).
- Trois cartes : Intervention locale · Devis gratuit · Un interlocuteur.
- Offres : Sécurité / Présence web / Assistance.

**Lecture :** le site écrit est clair, local, professionnel. Hiérarchie et contrastes OK.

**Friction :** sur desktop, **Claire s’ouvre tout de suite** (modal deux colonnes) et recouvre le catalogue. Le visiteur qui voulait *lire* doit cliquer « Naviguer sans Claire » ou « Ranger Claire ». Ce n’est pas un bug, c’est un **choix d’autorité** : Claire gagne l’arrivée.

### 3.2 Navigation

Desktop ≥900 px : Offres (méga-menu), Réalisations, À propos, Contact, Devis, téléphone `07 45 15 60 76`.

Mobile ≤899 px : hamburger. Recette 6 sept. : le menu **s’ouvre**, **Contact mène à Contact**. C’était un P0 cassé le 4 sept. (it34). **Corrigé sur www.**

Les clics internes passent par le runtime SPA (`handleSiteLink`) : pas de reload, Claire reste. En manuel, un clic Contact peut encore faire une navigation native (rechargement) — à surveiller.

### 3.3 Page service (Vidéosurveillance)

Titre local, 4G / zones blanches, CTA devis. Breadcrumb. Claire en barre bas si rangée. Rien à redire sur l’écrit catalogue.

### 3.4 Devis (écrit)

Champs : Nom / prénom · Téléphone · E-mail · Commune · Type de service (select) · Description · Pièces jointes (5 × 8 Mo, JPG/PNG/WEBP/PDF/DOC/DOCX/TXT).

Bouton : **Envoyer la demande**.

Note honnête : les fichiers **ne partent pas** avec le POST ; il faut les renvoyer ensuite. C’est juste, mais le libellé « Déposez vos fichiers » **promet** un envoi. Risque de « ça n’a pas marché ».

Manques écrits :

- Aucun placeholder sur Description.
- Aucun `*` obligatoire alors que 6 champs le sont (`devis.js` + Worker).
- Un premier visiteur **ne voit pas** Claire écrire dans Description. La boucle « elle remplit pour moi » n’existe que **après** des tours oraux / mémoire. Sans ça, devis et Claire semblent **deux produits séparés**.

Confidentialité : le texte dit bien que le mail part vers **l’e-mail du formulaire**. Aligné avec l’API it37.

### 3.5 Contact (écrit)

Coordonnées, horaires lun–sam 9–17 h, WhatsApp, OSM Porto-Vecchio (pas d’adresse de voie — bon), Itinéraire.

Formulaire : Nom · E-mail · Téléphone (facultatif) · Message. Bouton **Envoyer le message**.

Mêmes manques : pas de placeholder, pas de `*`, pas de synthèse visible au premier chargement.

### 3.6 Attente d’envoi (écrit)

Code : barre `.form-sending`, bouton disabled, carillon, timeout 12 s, overlay Claire `.claire-send-wait`. **Non exercé** dans cette recette (pas d’envoi). Les tests unitaires le couvrent.

---

## 4. Expérience écrite avec Claire

### 4.1 Composer

Placeholder exact : **« Écrire à Claire »**, 320 caractères, bouton envoyer.

Visible :

- en **Conversation / shared** : oui, bas du panneau blanc (vu sur Contact) ;
- en **guided** desktop : bandeau bas du rail (~44 px) ;
- en **arrival** : **non** — seulement « Parler à Claire en direct » et « Naviguer sans Claire ».

Un visiteur qui refuse le micro **doit** trouver « Conversation » ou le champ après ouverture. Ce n’est pas évident depuis l’arrivée.

Suggestions (chips) :

- Je cherche une vidéosurveillance sans fibre
- Je veux créer ou refaire un site web
- J’ai besoin d’un dépannage informatique

(La 4ᵉ suggestion knowledge « Je souhaite demander un devis » n’apparaissait pas sur la capture Contact.)

### 4.2 Transcript

Label **CLAIRE** / **Vous**. En mobile, plusieurs bulles d’accueil **identiques** se sont empilées (welcome + reprise de session). C’est illisible : on croit qu’elle bégaie.

Onglet **Conversation** : le labo n’a pas obtenu une transcription vocale utilisateur (pas de micro humain). À recetter.

### 4.3 Ce que l’écrit vers Claire devrait produire

Le texte tapé part en `[INFOSERV2A_USER_TEXT]`. Claire doit répondre dans le périmètre IT / métier numérique. Le site **peut** ouvrir un onglet si le runtime classe `site`.

Risque de pertinence : une phrase tapée « je veux juste comprendre » reste `chat`. Une phrase « ouvre le devis » est `site`. Le visiteur n’a **aucun** signal de quel monde il vient de déclencher.

---

## 5. Expérience orale

### 5.1 Démarrage

1. Modal arrivée : « Bonjour, je suis Claire. Je vous écoute. » + **Parler à Claire en direct** (point vert).
2. Clic → statut **« Connexion LiveAvatar… »** (~3 s dans le labo).
3. Statut **« Claire · LiveAvatar Realtime · son actif »**.
4. Texte / voix : welcome long (`CLAIRE_WELCOME`) **puis** « Je reprends. » si une mémoire existe.

Le 4 est un **défaut de pertinence rituelle**. Le prompt dit : mémoire = une phrase, pas d’accueil. LiveAvatar dit quand même l’`opening_text`. Les deux se jouent.

Welcome exact :

> Bonjour. Moi c’est Claire, votre aidante Live Avatar. Je suis là, avec vous, à Porto-Vecchio, chez InfoServ2A. Prenez votre temps. Qu’est-ce qui vous amène ? Je vous écoute.

### 5.2 Contrôles oraux

- **Parler à Claire** (actif = fond clair)
- **Conversation**
- **Ranger Claire**
- Badge technique : `LiveAvatar · OpenAI Realtime · marin`
- Interrompre : portrait / bouton / Escape si elle parle (code). Non recetté à l’oral ici.

**Ranger** → barre bas « Reprendre avec Claire · Aidante LiveAvatar + OpenAI Realtime » + **Ouvrir**. Vu desktop et mobile. Ça marche.

### 5.3 Chaîne orale (code, www it37)

```
Parole visiteur
  → transcription LiveAvatar
  → classifyUtterance (control | site | page | offtopic | chat)
  → si site / urgent : runtime (nav, prefill, submit_quote, compose_email)
  → si chat : Realtime répond
  → si offtopic : phrase fixe de recentrage
  → syncVisibleForms : Description / Message ← synthesizeMailBody()
  → « c’est bon » : POST /api/send-email
  → [INFOSERV2A_APP_RESULT] → Claire confirme
  → besoin vidé, identité gardée
```

Sur www, `synthesizeMailBody` **liste les tours utilisateur** :

```
Synthèse de l’échange :
• Bonjour Claire, comment tu vas ?
• Je veux une caméra 4G pour un hangar isolé à Porto-Vecchio.
• Oui et un enregistrement de quinze jours.
```

Ce n’est **pas** une synthèse écrite. C’est le bug que Didier a signalé. it38 le corrige (non publié).

### 5.4 Temps de session

Le Worker demande **600 s**. Si le plan LiveAvatar refuse, repli **300 s**. Alerte UI **45 s** avant la fin.  
En labo it34, les coupures étaient le P0. Le 6 sept., une connexion a tenu le temps du test (quelques secondes). **Pas de preuve à 60 s.**

### 5.5 Suivi de parole → onglet

Délai 360 ms. Un clic visiteur **verrouille** le suivi jusqu’à la prochaine phrase de Claire (`claimUserSiteNavigation`).  
**Non prouvé** clic-pendant-qu’elle-parle sur www. C’était déjà le trou des audits 2 et 4 sept.

---

## 6. Pertinence des réponses (cœur de la demande)

### 6.1 Ce que le prompt autorise / interdit

Claire est une **consultante IT ouverte** : métiers dès qu’ils touchent au numérique (cabinet, resto, commerce, collectivité). Pas une copine de salon. Pas un mur « je ne parle que d’informatique ».

Interdit d’inventer : tarif, délai, diagnostic définitif, coordonnée, « c’est parti » sans `[INFOSERV2A_APP_RESULT]`.

Le catalogue est injecté (`buildSiteBriefing` + `site-knowledge.json`, 13 onglets). La page visible part en `[INFOSERV2A_PAGE_CONTEXT]`.

**Force :** le modèle n’est pas libre de raconter n’importe quoi sur InfoServ2A.  
**Faiblesse :** tout ce qui n’est **pas** dans le knowledge (prix, délai réel, « je passe mardi ») doit être un **refus poli**. Si Realtime hallucine quand même, le site ne corrige que les **envois inventés** (`correctInventedSend`).

### 6.2 Classifieur (pertinence *avant* la phrase)

`classifyUtterance` est un **routeur à expressions**, pas un modèle.

| kind | Exemples | Effet |
|---|---|---|
| `site` | « ouvre le devis », « vidéosurveillance », « envoie » | Le site agit |
| `chat` | IT, métier, salutations | Realtime parle, pas de nav forcée |
| `offtopic` | recette, foot, horoscope, météo loisir | Phrase de recentrage |
| `control` | mode manuel | Ranger / reprendre |
| `page` | « où suis-je » | Contexte |

Trous de pertinence :

1. **Liste fermée** `OFF_TOPIC_PATTERN` / `PROFESSIONAL_PATTERN`. « Je tiens un food-truck » ou « je suis ostéopathe » peut mal classer.
2. **« caméra »** est à la fois besoin devis **et** mot IT : une aparté « j’ai vu une caméra dans un film » peut ouvrir Vidéosurveillance.
3. **Confirmation orale** (`c’est bon`, `vas-y`) est **urgente** même en `chat`. Sur une page incomplète, Claire doit dire ce qui manque — si le checklist ne parle pas, elle peut sembler sourde.
4. **Texte tapé vs voix** : même classifieur. Un visiteur qui *écrit* « merci » n’est pas un envoi ; un visiteur qui *dit* « c’est bon » sur un devis complet **envoie**. L’écrit n’a pas de bouton « comme si j’avais dit c’est bon » à côté du composer.

### 6.3 Mémoire et pertinence

- Identité (nom, tél, mail, commune) **très collante** — bien pour ne pas redemander.
- Besoin **trop collant** avant reset d’envoi : un reload ressort l’ancienne caméra.
- Briefing long (8 tours) envoyé à Realtime : aide à la continuité, **risque** qu’elle récite le dialogue (exactement ce qui se retrouvait dans le mail it37).
- Cue live : « Je reprends. » — trop souvent **collé à l’accueil**.

### 6.4 Pertinence *écrite* du mail (www)

Le visiteur juge la pertinence sur **ce qui part**. Aujourd’hui sur www :

- Destinataire : pertinent (son e-mail).
- From : `InfoServ2A <site@infoserv2a.pro>`.
- Reply-To : `contact@`.
- Corps : **peu pertinent** — c’est sa conversation, pas une demande professionnelle.

C’est le levier n°1 pour « améliorer la pertinence » **sans** changer le modèle.

---

## 7. Mobile (390×844) — faits du 6 septembre

| Scénario | Résultat |
|---|---|
| Accueil | Hero empilé, CTA pleine largeur, rail Claire en bas |
| Hamburger | S’ouvre. Contact **va** à Contact |
| Devis | Champs empilés, bouton pleine largeur |
| Focus Nom | Clavier, champ éditable, **Claire ne s’ouvre pas** |
| Ouvrir Claire | Plein écran, Parler + Ranger, historique scrollable |
| Rail + formulaire | La barre « Reprendre… » peut **manger** le bas (e-mail / commune) |

Progrès nets vs it34 (C22, hamburger).  
Reste : overlap du rail, messages d’accueil **dupliqués** dans le scroll, composer moins évident qu’un champ toujours visible.

---

## 8. Scores (www it37, 6 septembre 2026)

Poids = importance visiteur. Note / 100. **Somme des poids : 214.**  
Score = Σ (poids × note) / (poids × 100).

| ID | Critère | Poids | Note | Cible | Écart | Preuve courte |
|---|---|---:|---:|---:|---:|---|
| C01 | Perception / boutons | 8 | 80 | 90 | −10 | CTA clairs. Badge « marin » trop technique |
| C02 | Feedback | 10 | 74 | 88 | −14 | Statuts voix OK. Pas de « c’est votre clic » vs « c’est elle » |
| C03 | Feedforward | 7 | 64 | 86 | −22 | Accueil + « Je reprends » : on ne sait pas si c’est neuf |
| C04 | Bidirectionnalité | 18 | 76 | 90 | −14 | Hamburger OK. Clic-pendant-parole non prouvé |
| C05 | Stabilité nav | 12 | 70 | 86 | −16 | Verrou clic dans le code |
| C06 | Autorité du clic | 12 | 74 | 92 | −18 | `claimUserSiteNavigation` présent |
| C07 | Interruptibilité | 8 | 72 | 90 | −18 | Contrôles là. Session encore fragile |
| C08 | Mémoire | 6 | 72 | 88 | −16 | Identité collante. Dialogue recollé dans le mail |
| C09 | Reprise d’erreur | 5 | 66 | 80 | −14 | Repli micro. Messages parfois en boucle |
| C10 | Accessibilité | 6 | 68 | 82 | −14 | Pas de `*` required. Focus mobile OK |
| C11 | Temps de session | 5 | 72 | 80 | −8 | 10 min / repli 5 / alerte 45 s |
| C12 | Parole ↔ onglet | 8 | 74 | 88 | −14 | Suivi 360 ms |
| C13 | Spatial desktop | 6 | 86 | 92 | −6 | Deux colonnes lisibles |
| C14 | Spatial mobile | 6 | 70 | 86 | −16 | Empilé OK. Rail sur le formulaire |
| C15 | Confiance faits | 5 | 88 | 92 | −4 | Pas de tarif dans le prompt. Site = vérité |
| C16 | www Worker | 4 | 78 | 92 | −14 | www = it37 + secrets. Plus live2 |
| C17 | Envoi oral | 10 | 66 | 90 | −24 | Chaîne code. Pas de preuve humaine |
| C18 | Préremplissage | 8 | 70 | 92 | −22 | Marche après tours. Invisible au 1er passage |
| C19 | Nouveau devis | 8 | 72 | 90 | −18 | Reset besoin après envoi (code + tests) |
| C20 | Fiabilité LiveAvatar | 12 | 58 | 85 | −27 | Connexion vue. Stabilité 60 s non vue. Apex morte |
| C21 | Découvrir l’écrit | 6 | 72 | 86 | −14 | Champ visible en Conversation, pas à l’arrivée |
| C22 | Devis au doigt | 8 | 78 | 88 | −10 | Focus n’ouvre plus Claire |
| **C23** | **Pertinence orale** | 10 | 68 | 90 | −22 | Prompt bon. Classifieur regex. Double accueil |
| **C24** | **Pertinence du mail** | 10 | 38 | 92 | −54 | **P0.** Dump de conversation sur www |
| **C25** | **Apex même origine** | 6 | 25 | 92 | −67 | **P0.** Pages + API 404 |
| **C26** | **Rituel d’arrivée** | 6 | 55 | 86 | −31 | Modal immédiat + Je reprends |
| **C27** | **Hygiène technique** | 4 | 50 | 80 | −30 | CSP vs Insights. Warning WebGL |

**Score actuel : 14 534 / 21 400 = 67,9 %.**  
**Cible (notes « Cible ») : ≈ 86 %.**

### Lecture

- Le **catalogue écrit** (C13, C15, C16, C22) a **monté** depuis le 4 septembre.
- **C24 + C25** (mail dump + apex) pèsent **16 points** et cassent la confiance dès qu’on *envoie* ou qu’on arrive sans `www`.
- **C20 + C23 + C26** : la voix *existe*, mais elle n’est pas encore **une aidante prévisible**.
- Sans C24/C25, l’indice serait **~72 %** — le site « se visite » mieux qu’il « conclut ».

---

## 9. Écarts www (it37) vs preview (it38)

| Sujet | www aujourd’hui | Preview it38 | Publier ? |
|---|---|---|---|
| Corps devis/contact | Puces = tours oraux | Paragraphe écrit, pas de dialogue | **Oui, dès recette it38** (PR #8) |
| Assets | `20260905-it37` | `20260905-it38` | avec PR #8 |
| Contexte LiveAvatar | Aidant 1.28 (it37) | Aidant 1.29 | avec PR #8 |
| Apex | Pages, API 404 | Idem (pas du git) | Dashboard Cloudflare B4 |
| Pack doigt / hamburger | Déjà sur www | Inclus | — |

Publier it38 **sans** B4 améliore le mail sur **www** seulement. L’apex restera cassé.

---

## 10. Exigences (cahier testable)

### P0 — sans ça, la pertinence vécue reste basse

| ID | Énoncé | Lié |
|---|---|---|
| **E-MAIL-SYN-01** | Description devis **et** message contact = un seul paragraphe écrit (« Le visiteur a indiqué qu’il souhaite… »). **Aucun** tour, **aucune** réplique Claire, **aucun** « Vous : » | C24 · PR #8 |
| **E-APEX-01** | `curl -sI https://infoserv2a.pro/` **sans** `x-github-request-id`. `/api/liveavatar-status` = JSON | C25 |
| **E-LIVE-01** | « Parler à Claire » sur www → visage + voix **≥ 60 s**, ou **un** message « Écrivez-moi » sans boucle | C20 |
| **E-ARR-01** | Si mémoire : **une** phrase (« Je reprends, Didier. »). **Pas** le welcome complet ensuite | C03 C26 |
| **E-SEND-01** | « C’est bon » sur devis complet → un POST, oral « bien été envoyé vers {e-mail du champ} » | C17 |
| **E-NAV-LIVE-01** | Clic Contact pendant une phrase caméras : on **reste** Contact ≥ 3 s, voix non coupée | C04–C06 |

### P1 — pertinence et écrit

| ID | Énoncé |
|---|---|
| **E-TXT-01** | Champ « Écrire à Claire » visible **dès l’arrivée**, desktop et mobile, sans second onglet |
| **E-PH-01** | Placeholder Description : « Ex. Caméra 4G pour un hangar isolé, enregistrement 15 jours. » Idem Message contact |
| **E-REQ-01** | Champs obligatoires marqués `*` + message d’erreur en français sous le champ |
| **E-FILES-01** | Libellé pièces jointes : elles **ne partent pas** avec le premier mail — phrase en tête, pas en note |
| **E-CLS-01** | 10 phrases métier corses (resto, cabinet, chantier, food-truck, mairie) classées `chat` ou `site` **sans** ouvrir un mauvais onglet |
| **E-OFF-01** | « Quelle est la recette de la civelle ? » → **une** phrase, recentrage, **pas** de catalogue récité |
| **E-DUP-01** | Une session = **une** bulle d’accueil. Reconnexion ≠ recopier le welcome |
| **E-RAIL-01** | Sur 390 px, la barre Reprendre **ne recouvre pas** un champ devis |
| **E-CSP-01** | Soit Insights autorisé dans `script-src`, soit Insights désactivé (plus d’erreur console) |
| **E-CTX-01** | CONTEXTE devis (6 cases) visible tant qu’on est sur `/devis` en guidé |

### P2 — confort

| ID | Énoncé |
|---|---|
| **E-TECH-01** | Badge public : « Claire en direct » — pas « marin / OpenAI Realtime » en premier |
| **E-WWW-01** | Redirection 301 apex → www **ou** Custom Domain apex (E-APEX-01). Pas les deux à moitié |
| **E-STAT-01** | Trois statuts max, non tronqués : prête / j’écoute / écrivez-moi |
| **E-COPY-01** | Harmoniser « Envoyer la demande » / « Envoyer le message » avec une ligne d’aide |

---

## 11. Plan d’amélioration (ordre, pas de calendrier)

1. **Publier PR #8 (it38)** après votre recette preview — c’est le plus gros gain de **pertinence écrite** pour 0 changement de modèle.  
2. **B4 Cloudflare** : attacher `infoserv2a.pro` au Worker (ou 301 → www). Sans ça, la moitié du trafic « je tape le domaine » est un fantôme.  
3. **E-ARR-01 + E-DUP-01** : une porte d’entrée. Welcome **ou** « Je reprends », jamais les deux.  
4. **E-TXT-01 + E-PH-01** : l’écrit comme filet quand la voix lâche.  
5. **Recette humaine** E-LIVE-01 + E-SEND-01 + E-NAV-LIVE-01 sur **www** (Ctrl+Shift+R).  
6. **E-CLS-01** : enrichir le classifieur avec vos phrases réelles (resto, cabinet, chantier 4G), pas des mots d’ingénieur.  
7. **E-RAIL-01 + E-FILES-01 + E-CSP-01** : hygiène.  
8. Figma seulement pour F1 (arrivée) et F5 (rail mobile) — le reste est déjà dans le code.

Ne **pas** empiler un nouveau modèle (GPT plus gros, autre voix) tant que 1–5 ne sont pas verts. La pertinence manque surtout de **fermeture de boucle**, pas de « plus d’intelligence ».

---

## 12. Recette Didier (15 minutes, téléphone + Gmail)

Faire sur **www** après it38, Ctrl+Shift+R.

1. `https://www.infoserv2a.pro/devis.html?claire=1`  
2. Ranger Claire. Lire le devis. Remplir **votre** e-mail.  
3. Rouvrir Claire. Dire un besoin réel (pas « test »).  
4. Vérifier Description : **un paragraphe**, pas vos phrases orales.  
5. Dire « c’est bon ». Barre d’attente. Mail dans **votre** boîte. From `site@`, Reply-To `contact@`.  
6. Dire un **autre** besoin. L’ancien ne doit pas revenir.  
7. Téléphone 390 px : hamburger → Contact ; taper Nom **sans** que Claire recouvre.  
8. Ouvrir `https://infoserv2a.pro` (sans www) : si l’API 404 encore, **ne pas** envoyer depuis cette URL.

Si 4, 5 et 7 passent, l’indice ressenti passe au-dessus de 80 %.

---

## 13. Inventaire catalogue (ce que Claire *peut* ouvrir)

13 onglets : Accueil, Vidéosurveillance (`#solutions-sans-fibre`), Création de sites (`#offre-hebergement`), Cybersécurité & IA (`#audit-nis2`), Maintenance à distance, Configuration à domicile, Récupération de données (`#supports`), Réalisations, À propos, Contact, Devis, Mentions, Confidentialité.

Outils runtime : `search_site`, `open_service`, `scroll_to`, `open_contact`, `prefill_quote`, `submit_quote`, `start_call`, `compose_email`, `list_catalog`, `explain_page`, `go_home`, `next_page`, `prev_page`, `next_section`, `prev_section`.

Contact knowledge : `07 45 15 60 76` · `contact@infoserv2a.pro` · lun–sam 9–17 h · Solenzara → Bonifacio.

---

## 14. Preuves de cette recette

Mesures curl : §2.  
Captures navigateur 6 sept. 2026 (desktop + mobile) :

| Fichier | Sujet |
|---|---|
| `audit_www_claire_ecrit_contact.webp` | Composer « Écrire à Claire », chips, Ranger |
| `audit_www_claire_oral_son_actif.webp` | LiveAvatar connecté, welcome, saisie test |
| `audit_www_devis_formulaire.webp` | Devis desktop |
| `audit_www_contact_formulaire.webp` | Contact desktop |
| `audit_www_accueil_mobile.webp` | Accueil 390 px + rail |
| `audit_www_hamburger_mobile.webp` | Menu site |
| `audit_www_devis_mobile.webp` | Devis mobile |
| `audit_www_claire_mobile.webp` | Claire plein écran mobile |

Audits liés (ne pas jeter) :

- `docs/claire-audit-ergonomie-cybernetique.md` (2 sept., 58 %)
- `docs/claire-audit-ux-preview-it34.md` (4 sept., 65 %)
- `docs/activer-claire-sur-infoserv2a-pro.md` (apex / secrets)

---

## 15. Décision demandée

Trois actions, dans cet ordre, dès que vous le voulez :

1. **Recetter puis fusionner** la PR #8 (synthèse écrite it38) vers `main` → www.  
2. **Attacher l’apex** au Worker (ou rediriger vers www).  
3. Me dire si on enchaîne sur **E-ARR-01** (un seul accueil) et **E-TXT-01** (écrire dès l’arrivée).

Sans 1, chaque devis oral **ré-imprime** la conversation.  
Sans 2, `infoserv2a.pro` reste un site muet habillé comme Claire.
