# Audit hyper-approfondi — preview IT42, scène magasin Claire

**Date :** 6 septembre 2026, ~19:15 UTC  
**Cible :** `https://cursor-arrivee-devanture-8f54-infoserv2a.infoserv2a.workers.dev/?claire=1`  
**Aussi :** `/devis?claire=1`, `/contact?claire=1`  
**Branche :** `cursor/arrivee-devanture-8f54`  
**HEAD local :** `6a077f4` — `feat: preview it42 — rythme Claire PC 1/3+2/3, mobile alternance`  
**Autorité :** cahier Didier (arrivée validée + rythme PC / mobile), **pas un goût**.  
**Périmètre :** audit uniquement. Aucun recodage de layout. Pas de merge www. Pas d’envoi mail.

Méthode : curl (HTML + `?v=` + hash SHA-256) → lecture CSS/JS IT42 → Chrome headless 1280×800 et 390×844 → mesures `getBoundingClientRect` → captures. LiveAvatar n’a **pas** parlé de façon mesurable dans le headless ; le plein cadre mobile a été **forcé** (`data-presence="speaking"` + `claire-stage-speaking`) comme demandé, et c’est dit à chaque fois.

Captures de travail : `/tmp/it42-audit/*.png` et `measures.json`. Artefacts agent : `it42_desktop_*.png`, `it42_mobile_*.png`, `it42_runtime_measures.json`.

---

## 1. Résumé exécutif

**Didier a raison sur le vécu (alternance absente, pas de grand écran mobile, tout empilé) ; il a tort sur « rien ne marche » : l’arrivée validée et le split PC 1/3 + 2/3 sont bel et bien en ligne.**

IT42 est **servi** (assets `20260906-it42`, hash identique au HEAD). Le code *contient* le plein cadre 9:16 et le hold 1 s. Le visiteur, lui, voit surtout un **hybride empilé** : Claire en bandeau ~32 % + composer + header + magasin, avec des boutons en double sur le visage. Le zap n’existe que si `presence=speaking` s’allume — et après « Parler à Claire » on mesure `listening` / `ready`, pas `speaking`. D’où le fouillis, pas un désaccord de goût.

**Score : 55 / 100.**

---

## 2. Score / 100 et barème

Douze critères pondérés, total **100**. Chaque note est justifiée par une preuve runtime ou un extrait de code.

| # | Critère | Poids | Note | Preuve courte |
|---|---|---:|---:|---|
| A | Arrivée (logo, « Claire vous ouvre la boutique », portes) | 8 | **8** | Intacte desktop + mobile. `?claire=1` force `arrival`. Non jugée comme bug. |
| B | Split PC 16:9 fixe 1/3 + 2/3, elle ne grandit pas | 12 | **11** | 1280×800 : Claire **427 px (33,36 %)** / site **853 px (66,64 %)**. Forcer `speaking` : **toujours 427 px**. −1 : `padding-bottom: 136 px` (8,5 rem) écrase le magasin. |
| C | Après « Parler à Claire » : guidé, pas overlay conversation | 10 | **7** | `start()` → `state: "guided"`. Overlay `shared` encore vivant (`openConversation`, bouton Conversation hors guidé, `submit` peut rerentrer en `shared`). |
| D | Alternance mobile : parole → 9:16 plein cadre + « Elle vous parle » | 14 | **3** | **Forcé** : 390×844, hint visible. **Vécu après Parler** : bandeau **274×390 (32,46 %)** , `presence=listening` puis `ready`, hint `display:none`. Le plein cadre n’est pas le chemin nominal. |
| E | Zap / tap pendant qu’elle parle → magasin + interrupt | 8 | **4** | Tap sur le stage **avec** `claire-stage-speaking` : collapse à 274 px, `presence=listening`. Sans speaking, tap = `resumeMedia`, pas de zap. Pas d’aller-retour explicite. |
| F | Frappe → magasin + interrupt | 8 | **3** | Pendant `speaking`, `.claire-dialogue { display: none }` : le champ Claire a **0 px**. `yieldToHumanType()` marche en API. Un champ site interrompt. Le visiteur ne peut pas « taper » dans Claire. |
| G | Fouillis / pop-ups / chrome sur le visage | 12 | **2** | Doublons « Ranger Claire » + « Claire en direct », chip « Votre assistante », caption, Conversation **sur le portrait**. Mobile : header z-145 collé sous le bandeau. |
| H | Cartes / transcript / composer dans les 2/3 PC | 6 | **5** | Après Parler : dialogue `x=439` (2/3), prompt `x=441`. Jamais sur le visage. Les contrôles restent dans le 1/3. |
| I | Magasin mobile = liseré, pas de bulles sur le visage | 8 | **1** | Chrome **274 px** (`220 + 3,4 rem`), stage **~166 px (19,7 %)**. Ce n’est pas un liseré. Le visage reste un tiers d’écran + boutons. |
| J | Contamination mémoire / visiteur neuf vs « Je reprends » | 6 | **4** | Premier `?claire=1` : storage vide. Après Parler, reload **sans** `?claire=1` → `guided` persisté (`sessionStorage.mode`). Mémoire **session + localStorage**. Cue live « Je reprends. » encore dans le code. |
| K | Perf / confiance / `?v=` réellement servi / LiveAvatar | 5 | **4** | HTML + JS + CSS `20260906-it42`, SHA-256 = HEAD. `/api/liveavatar-status` `configured:true`. Desktop encore `connecting` à 2,5 s. HTML `cf-cache-status: HIT` (Ctrl+Shift+R nécessaire). |
| L | Seuil 821 px / cohérence CSS ↔ JS | 3 | **3** | `@media (max-width: 820px)` et `isPhoneShell()` = `max-width: 820px`. Alignés. Non recetté à 820 vs 821 px à l’œil. |

**Total : 55 / 100.**

### Lecture du score

| Zone | / sous-total | Verdict |
|---|---:|---|
| Arrivée + split PC + cartes 2/3 (A+B+H) | 24 / 26 | Presque conforme |
| Guidé vs overlay + seuil (C+L) | 10 / 13 | Chemin principal OK, vestiges |
| Rythme mobile (D+E+F+I) | 11 / 38 | **Échec du cahier** |
| Fouillis + mémoire + confiance (G+J+K) | 10 / 23 | Fouillis dominant |

Didier décrit exactement la colonne « rythme mobile + fouillis ». La colonne PC n’est pas « rien ».

---

## 3. Vérification : IT42 est-il vraiment en ligne ?

### 3.1 Curl HTML

```
GET https://cursor-arrivee-devanture-8f54-infoserv2a.infoserv2a.workers.dev/?claire=1
HTTP/2 200
cf-cache-status: HIT
cache-control: public, max-age=0, must-revalidate
x-robots-tag: noindex
```

Feuilles et scripts servis :

- `assets/css/claire-companion.css?v=20260906-it42`
- `assets/js/claire-companion.js?v=20260906-it42`
- idem `variables.css`, `main.css`, `components.css`, `responsive.css`, `main.js`, `navigation.js`

`/devis?claire=1` et `/contact?claire=1` : même `?v=20260906-it42`.

JS cache CDN : `cache-control: public, max-age=86400`, `cf-cache-status: HIT`. D’où la consigne Ctrl+Shift+R : un onglet qui a un vieux `?v=` peut mentir ; **celui-ci sert IT42**.

### 3.2 Hash local = hash servi

| Fichier | SHA-256 |
|---|---|
| `assets/js/claire-companion.js` (HEAD + servi `?v=20260906-it42`) | `ae703f0046552aabdd1472f3f4a62700963b57851cb70e45de7292a88d7cfdfb` |
| `assets/css/claire-companion.css` (HEAD + servi) | `40f8f5c2c65ea57639f23e3136d087288f15427382227813310f0ee3f150d309` |

Marqueurs présents dans le JS/CSS **servis** : `SPEAKING_STAGE_HOLD_MS = 1000`, `--claire-stage-width: 33.333vw`, `state: "guided"` au `start()`, règles `claire-stage-speaking`.

### 3.3 LiveAvatar

`GET /api/liveavatar-status` :

```json
{"configured":true,"prerequisites":{"liveAvatar":true,"openAIRealtime":true,"avatar":true},"provider":"liveavatar-realtime","connector":"OPENAI_REALTIME","voice":"marin","model":"gpt-realtime","mode":"LITE"}
```

Dans le navigateur : badge « Claire en direct » (plus le jargon marin/OpenAI). Provider runtime : `liveavatar-realtime` une fois connecté (mobile), `connecting` encore à 2,5 s (desktop).

**Limite recette :** Chrome headless + micro factice. L’avatar n’a pas émis `AVATAR_SPEAK_STARTED` de façon observée dans la fenêtre de 2,8 s. Le plein cadre a donc été **forcé**. Un humain avec micro réel peut voir un flash 9:16 si LiveAvatar parle vraiment ; **ce n’est pas le layout par défaut après Parler**.

---

## 4. Écarts point par point vs cahier

### 4.1 Entrée — conforme (ne pas juger comme un bug)

Cahier : logo InfoServ2A, « Claire vous ouvre la boutique », portes Parler / Voir le site d’abord.

**Desktop 1280×800**

- `data-state="arrival"`, body `claire-arrival-open`.
- H1 : « Claire vous ouvre la boutique. »
- Portes mesurées : « Parler à Claire » / « Voir le site d’abord ».
- Logo arrivée : 260×60 à (653, 90).
- Stage arrivée : **589×800 (46,02 %)** — c’est le layout d’arrivée (`grid` 46 % / reste), **pas** le split guidé 1/3. Conforme à l’entrée validée.
- Storage : `mode`, `seen`, mémoire session et local = `null` (visiteur neuf).

**Mobile 390×844**

- Overlay plein cadre 390×844, mêmes portes, même H1.
- Le visage est déjà recouvert (Ranger Claire, chip, caption) : héritage de l’arrivée, pas un régression IT42. Noté, pas scoré contre l’entrée.

Capture : `it42_desktop_arrival.png`, `it42_mobile_arrival.png`.

### 4.2 PC 16:9 — split 1/3 + 2/3 : **conforme**, avec scories

Cahier : split **fixe** 1/3 Claire + 2/3 site. Pas d’alternance. Elle ne grandit pas. Cartes / transcript / composer dans les 2/3, jamais sur le visage. Après Parler : guidé, pas overlay.

**Mesure 1280×800, 2,5 s après « Parler à Claire »**

| Élément | x, y | w × h | % viewport |
|---|---|---|---|
| Companion / stage | 0, 0 | **427 × 800** | **33,36 %** |
| `#contenu` | 427, 72 | **853 × …** | **66,64 %** |
| Header site | 427, 0 | 853 × 72 | dans les 2/3 |
| Dialogue / composer | 439, 735 | 829 × 53 | dans les 2/3 |
| Live-prompt « CONTEXTE » | 441, 669 | 825 × 45 | dans les 2/3 |
| Body `padding-left` | — | 426,662 px | = `--claire-stage-width` |
| Body `padding-bottom` | — | **136 px** | 8,5 rem, **en trop** |

- `data-state="guided"` — **pas** `shared`. Body : `claire-is-guided` seulement. Overlay conversation **absent**.
- Forcer `data-presence="speaking"` + `claire-stage-speaking` : **toujours 427 px**. Elle ne grandit pas. Cahier PC respecté.
- CSS : `--claire-stage-width: 33.333vw` (l. 11). JS : `start()` → `connectLiveSession({ microphone: true, state: "guided" })` (l. 735).

**Écarts PC (secondaires mais visibles)**

1. **Chrome sur le visage** (1/3) : header expérience (logo + « Claire en direct » + badge « Claire en direct » + Ranger Claire) **et** bas de stage (chip « Votre assistante », caption, micro, **Conversation**, **Ranger Claire encore**). Le cahier dit cartes/transcript/composer hors visage — ils le sont. Didier voit quand même un 1/3 « tapissé ». C’est du fouillis, pas un faux split.
2. **`body.claire-is-guided { padding-bottom: 8.5rem }`** (l. 928–930) s’applique aussi au desktop, *après* le `padding-left`. Le magasin a une bande morte de 136 px sous un composer déjà `position: fixed`.
3. **Chemin overlay encore branché** : `[data-claire-expand]` hors `guided` appelle `openConversation()` → `state: "shared"` (l. 449–454, 852–853). `submit()` peut `setState("shared")` si on n’est pas déjà guidé (l. 1507–1508). Session `storedMode === "shared"` relance l’overlay.

Capture : `it42_desktop_after_parler_split.png`, `it42_desktop_forced_speaking_still_third.png`.

### 4.3 Mobile 9:16 — alternance : **non conforme au vécu**

Cahier : elle parle (bonjour compris) → Claire **9:16 plein cadre** + « Elle vous parle ». Elle se tait ~1 s → magasin, **liseré**, pas de bulles sur le visage. Tap pendant qu’elle parle → magasin + interrupt.

#### Ce que le code promet

```60:60:assets/js/claire-companion.js
const SPEAKING_STAGE_HOLD_MS = 1000;
```

```684:703:assets/js/claire-companion.js
  syncSpeakingStage(presence = this.root?.dataset.presence, { immediate = false } = {}) {
    const phone = isPhoneShell();
    const speaking = this.state === "guided" && phone && isSpeakingPresence(presence);
    if (speaking) {
      // ...
      document.body.classList.add("claire-stage-speaking");
      return;
    }
    // ... hold 1000 ms puis remove
  }
```

`isSpeakingPresence` = `"speaking"` **ou** `"sound"` (si LiveAvatar parle sans `mediaAudible`, le CSS devrait quand même s’allumer).

CSS `@media (max-width: 820px)` + `body.claire-phone-shell` : companion `inset:0; height: var(--claire-vvh); z-index:160`, hint `.claire-speaking-hint { display:block }`, dialogue **caché**.

#### Ce que le navigateur 390×844 montre *sans* forcer

**2,8 s après « Parler à Claire » (LiveAvatar connecté, « son actif ») :**

| | Valeur |
|---|---|
| `data-state` | `guided` |
| `data-presence` | `listening` puis `ready` |
| `claire-stage-speaking` | **false** |
| `claire-phone-shell` | true |
| Companion | **390 × 274** (32,46 % de 844) |
| Stage (visage) | ~390 × **166** (19,67 %) |
| `padding-top` body | **274,4 px** |
| Hint « Elle vous parle » | `display: none`, 0×0 |
| Composer | visible sous le visage (bande 3,4 rem) |
| Header site | `position:fixed; top: 274px; z-index:145` |

Ce n’est **ni** le 9:16, **ni** un magasin à liseré. C’est un **sandwich** : portrait recadré + champ + nav + hero. Capture : `it42_mobile_after_parler_stacked.png`.

**Pourquoi le bonjour n’a pas allumé le plein cadre**

1. `start()` passe tout de suite en `guided` puis `connecting` / `listening`. Le plein cadre ne dépend **que** de `presence ∈ {speaking, sound}`.
2. La présence `speaking` vient de `AVATAR_SPEAK_STARTED` (provider l. 736–742). Pas de speak observé → pas de classe.
3. `showWelcome()` / `scheduleWelcomeTranscript(1800)` n’écrivent **que le transcript**. Elles n’appellent pas `setStatus("speaking")`.
4. Fallback local : volontairement **silencieux** (pas d’imitation de voix). Donc pas de `speaking` non plus.
5. Si LiveAvatar dit bonjour plus tard, le 9:16 peut flasher. **Le layout stable après Parler est le bandeau 274 px.** C’est ça que Didier voit.

#### Ce que le plein cadre *existe* vraiment — uniquement forcé

Injection : `data-presence="speaking"` + `body.claire-stage-speaking` (+ `claire-is-guided` + `claire-phone-shell`).

| | Valeur |
|---|---|
| Companion | **390 × 844 (100 %)** , `z-index: 160` |
| Stage | **390 × 844** |
| Hint | **visible**, 112×29, texte « Elle vous parle » |
| Dialogue / composer | `display: none` |
| `padding-top` | ~0 |

Le CSS IT42 **n’est pas mort**. Il est **hors du chemin nominal**. Capture : `it42_mobile_forced_speaking_fullframe.png`.

Même forcé, le portrait n’est pas nu : Ranger Claire, chip « Votre assistante », Interrompre, Conversation, micro. Cahier : un mot discret, pas une barre d’outils.

#### Magasin « liseré » — absent

Cahier : elle se tait → site/magasin, **liseré**.

Réalité (`--claire-mobile-stage: clamp(176px, 34dvh, 220px)` + `--claire-composer-band: 3,4rem`) :

- 844 × 0,34 = 287 → clamp **220 px** de visage
- + 54 px de composer ≈ **274 px** de chrome permanent
- Le site commence sous 274 px

Un liseré, c’est une ligne (8–16 px) ou une pastille. Ici Claire **garde un tiers d’écran** quand elle est censée céder le magasin. Capture : `it42_mobile_magasin_not_lisere.png` (état guidé silencieux, page contact après navigation — le sandwich est encore plus illisible).

### 4.4 Zap / tap — partiel, non découvrable

Cahier : tap pendant qu’elle parle → magasin + interrupt.

Code stage click (l. 483–489) : si `avatarSpeaking` **ou** `claire-stage-speaking` → `interrupt()` ; sinon `resumeMedia()`.

**Preuve :** speaking forcé → click stage → `presence=listening`, classe speaking **retirée**, companion **274 px**. Le zap *mécanique* existe.

**Écarts :**

- Sans `speaking`, le tap ne « zap » pas. Après Parler (état réel), tap ≠ retour magasin : on est **déjà** dans le sandwich.
- Le composer est masqué pendant le 9:16 : on ne peut pas « taper pour zapper » dans Claire.
- Pas de contrat tap **magasin → visage**. « Alternance » côté Didier = un zap dans les deux sens. Le code n’implémente que « elle parle → tap → elle cède ».
- `Ranger Claire` (manuel) n’est pas le zap : ça range tout (barre « Reprendre avec Claire »).

### 4.5 Frappe — le filet est caché

Cahier : si on tape pendant qu’elle parle → magasin + interrupt.

```706:712:assets/js/claire-companion.js
  yieldToHumanType() {
    const speaking = isSpeakingPresence(this.root?.dataset.presence)
      || Boolean(this.provider?.avatarSpeaking)
      || document.body.classList.contains("claire-stage-speaking");
    if (!speaking) return;
    this.interrupt();
  }
```

Branché sur `focus` / `input` du composer Claire, et `focusin` des champs site.

**Preuve :** pendant speaking forcé, `#claireCommand` existe mais `.claire-dialogue { display: none }` → `inputClientH = 0`. Appel API `yieldToHumanType()` : collapse OK. Focus d’un champ `#contenu` (contact) : `claire-keyboard-open` + interrupt.

**Bug d’ordre CSS :** `body.claire-phone-shell .claire-companion[data-state="guided"] { height: var(--claire-mobile-chrome) }` (l. 1380, **après** le media query) **annule** le shrink clavier `claire-keyboard-open` (l. 1078–1081). En frappe site, le bandeau reste 274 px au lieu de ~5 rem.

### 4.6 Ne pas recouvrir Claire de pop-ups — **non conforme**

Inventaire runtime (guidé desktop + mobile) :

| Couche | Où | Cahier |
|---|---|---|
| Badge « Claire en direct » + texte « Claire en direct » | 1/3 / bandeau | Doublon |
| « Ranger Claire » haut + « Ranger Claire » bas | visage | Doublon |
| Chip « Votre assistante » | visage | Bulle |
| Caption / status + wave | visage (desktop) | Chrome |
| « Conversation » | visage | Bouton sur portrait |
| Live-prompt CONTEXTE + puces | 2/3 desktop | OK emplacement, charge visuelle |
| Composer « Écrire à Claire » | 2/3 desktop / sous le visage mobile | OK / sandwich |
| Header site z-145 | juste sous le bandeau mobile | couture sale |
| Notice session / send-wait | prévus en overlay | pas vus dans cette passe |
| Barre « Reprendre avec Claire » | manuel | recouvre les cartes bas de page |

Ce n’est pas « trop d’animations ». C’est **plusieurs machines d’état dessinées en même temps** (arrivée, guidé, conversation, speaking, manuel, clavier, quest devis).

### 4.7 Contamination visiteur neuf vs mémoire

| Situation | Comportement mesuré / code |
|---|---|
| `?claire=1` premier onglet | `arrival`, storage vide. **Visiteur neuf OK.** |
| Après Parler, reload `/` **sans** `?claire=1` | `guided` tout de suite, 427 px. `sessionStorage infoserv2a.claire.mode=guided`, `seen=1`. **Pas de rituel d’arrivée.** |
| « Voir le site d’abord » | `manual` + barre « Reprendre avec Claire ». `mode=manual`. Reload sans query → **manuel**, pas l’entrée. |
| Mémoire | `loadSessionMemory()` fusionne **sessionStorage + localStorage** (`infoserv2a.claire.memory`). Un devis commencé hier peut revenir. |
| « Je reprends » | `formatLiveMemoryCue()` (l. 999–1014) : `ORDRE : une phrase courte (« Je reprends. »)`. Envoyé si `sendSessionMemory({ live: true })`. `connectLiveSession` pose `skipLiveResumeCue = true` au premier connect — la *première* sync est silencieuse. Un flush live ultérieur peut encore dire « Je reprends ». |
| Prompt système | `claire-core.mjs` : « ne dis pas Je reprends » **et** le cue live qui l’ordonne. Deux politiques. |

Didier qui recette toute la journée dans le même navigateur **n’est plus un visiteur neuf**, même avec `?claire=1` (l’arrivée revient, la mémoire locale non).

### 4.8 `/devis` et `/contact`

- Les deux servent `?v=20260906-it42`.
- `?claire=1` → arrivée identique (logo + portes).
- Après Parler sur `/devis` : même split 427 / 853.
- Mobile contact + guidé silencieux : header + formulaire **collés sous le visage** (capture magasin). CONTEXTE devis en bandeau mobile (IT41) s’ajoute au sandwich si `claire-quote-quest`.

---

## 5. Pourquoi ça fait « fouillis » (causes racines)

Pas des goûts. Six causes qui se **cumulent**.

### C1 — Deux scènes mobiles, un seul layout par défaut

Le cahier veut une **alternance** (un écran à la fois). IT42 implémente un **bandeau permanent** (`--claire-mobile-chrome` ≈ 274 px) et n’ajoute le 9:16 qu’en *décoration* de `presence=speaking`. Le défaut = les deux scènes à la fois. Didier a raison : « tout est mélangé ».

### C2 — Le speaking n’est pas un état de scène, c’est un événement audio

Le plein cadre est accroché à LiveAvatar `AVATAR_SPEAK_STARTED`, pas à « Claire a la parole dans le rituel » (bonjour, réponse, lecture). Si l’avatar écoute, connecte, ou si le headless/l’onglet n’a pas d’audio audible, **la scène 9:16 n’existe pas**. Le bonjour transcript n’allume rien.

### C3 — Trop de modes dans le même DOM

`arrival` / `shared` / `action` / `guided` / `manual` + `transcript` + `speaking` + `keyboard-open` + `quote-quest` + `session-notice`. IT42 a *ajouté* speaking par-dessus guided, sans retirer conversation overlay ni les contrôles d’arrivée. Le bouton Conversation ouvre encore `shared`.

### C4 — Spécificité CSS qui se marche dessus

Règles desktop (`.claire-companion[data-state="guided"] { width: 33.333vw }`) **hors** media query, puis override 820 px, puis `body.claire-phone-shell` **encore après** qui :

- refixe le bandeau 274 px (y compris pendant `keyboard-open`) ;
- duplique le speaking (media + phone-shell).

Un agent ou un futur patch « qui gagne ? » n’est pas lisible. D’où des états visuels hybrides.

### C5 — Le 1/3 PC est un dock de boutons

Split correct, **surface visage saturée** : 2× Ranger, 2× « Claire en direct », chip, caption, micro, Conversation. Le cahier a mis les *cartes* dans les 2/3 ; personne n’a vidé le portrait. Sensation « elle ne garde pas le grand écran » : à l’arrivée le visage fait **589 px (46 %)** ; après Parler il **rétrécit à 427 px** et se remplit de chrome. Didier a validé le grand portrait d’entrée. IT42 le diminue.

### C6 — Mémoire de session dans le même navigateur de recette

`sessionStorage` mode + `localStorage` mémoire. Recette Didier ≠ visiteur incognito. « Je reprends » / pas d’arrivée / guidé immédiat renforcent l’impression que « ça ne fait jamais le rituel ».

---

## 6. Confrontation code ↔ vécu (table unique)

| Promesse IT42 (doc + code) | Vécu mesuré |
|---|---|
| `--claire-stage-width: 33.333vw` | **427 / 1280 = 33,36 %**. OK. |
| Elle ne grandit pas sur PC | Forcé speaking : **427 px**. OK. |
| `start()` → `guided` | **guided**, pas overlay. OK. |
| Mobile speaking → 9:16 | **Uniquement forcé**. Après Parler : 274 px. |
| Hold 1 s | Code 1000 ms. Non chronométré en parole réelle (pas de speak). |
| Tap = interrupt | OK **si** speaking. Sinon resume. |
| Frappe = interrupt | OK en API / champ site. Composer Claire **invisible** pendant speaking. |
| « Elle vous parle » | Visible seulement en speaking forcé. |
| Liseré magasin | **274 px** de visage+composer. Non. |
| Cartes dans les 2/3 | Desktop OK. Contrôles sur le visage : non traités. |

---

## 7. P0 pour clarifier (ordre, sans implémenter)

Un seul principe : **une scène à la fois**. Ne pas « améliorer » le sandwich.

1. **Mobile — deux états exclusifs, le défaut n’est plus le bandeau 274 px.**  
   - Parole (bonjour **inclus**, dès `start()` / welcome, pas seulement `AVATAR_SPEAK_STARTED`) → 9:16 plein cadre, hint « Elle vous parle », tap = céder.  
   - Silence → magasin **plein cadre** + liseré (quelques px ou pastille), **zéro** composer/chip/Conversation sur un demi-visage.  
   Tant que le défaut reste 220+54 px, le cahier est faux.

2. **Allumer `speaking` sur le rituel, pas seulement sur le packet audio.**  
   `showWelcome` / connexion / première phrase = scène parole. Sinon le 9:16 ne se voit jamais (cas de cette recette).

3. **Rendre le zap évident et possible.**  
   Tap portrait = céder. Ne pas `display:none` le seul champ si « frappe = zap » reste au cahier. Ou retirer la frappe du cahier et ne garder que le tap. Les deux à la fois, avec le champ caché, c’est un contrat mort.

4. **Vider le visage.**  
   Un seul « Ranger ». Badge unique. Conversation et cartes **uniquement** dans les 2/3 (PC) ou hors portrait (mobile). Interrompre / hint seulement en parole. C’est ça le « ne pas recouvrir Claire ».

5. **Tuer les vestiges overlay.**  
   Plus de `openConversation` → `shared` depuis l’UI. `submit` ne rebascule pas en `shared`. `padding-bottom: 8.5rem` desktop à supprimer (le composer est déjà fixed).

6. **Isoler la recette visiteur neuf.**  
   Documenter : incognito **ou** wipe `infoserv2a.claire.*` (session + local). Décider si `localStorage` mémoire a le droit de survivre à `?claire=1`. Trancher « Je reprends » : une seule politique (cue live vs prompt « ne dis pas Je reprends »).

Hors P0 (ne pas mélanger au rythme) : tablette 820 vs 821 à l’œil, recette micro humaine ≥ 60 s, envoi mail réel, www.

---

## 8. Ce qui n’est **pas** un bug

- L’arrivée logo + deux portes (validée). Largeur 46 % du visage à l’entrée.
- Le split PC 1/3 + 2/3 et le fait qu’elle ne grandisse pas sur desktop.
- « Parler à Claire » → guidé (chemin principal).
- LiveAvatar `configured:true` / badge « Claire en direct ».
- Assets `20260906-it42` effectivement servis (hash = HEAD).
- Seuil code 821 px (820 vs 821) — cohérent, juste non photographié au pixel près.

---

## 9. Limites de cette recette

- Headless, micro factice, pas de voix humaine. Le bonjour LiveAvatar peut exister chez Didier et flasher le 9:16 ; **le layout après connexion reste le sandwich**, mesuré avec provider `liveavatar-realtime`.
- Pas de mesure à 820 px vs 821 px (tablette).
- Pas d’envoi mail, pas de session vocale ≥ 60 s.
- Capture « magasin silencieux » mobile prise après navigation `/contact` (toujours guidé empilé — plus sale, toujours représentatif).

---

## 10. Annexes mesures

### Desktop 1280×800

```
arrivée     companion 1280×800  state=arrival   stage 589×800 (46,02 %)
après Parler companion 427×800  state=guided    site 853  pad-left 426.7  pad-bottom 136
speaking*    companion 427×800  (forcé)         inchangé
voir site    state=manual       barre Reprendre
reload /     state=guided       427×800         sessionStorage mode=guided
```

### Mobile 390×844

```
arrivée      companion 390×844  state=arrival
après Parler companion 390×274  presence=listening/ready   stageH 19,67 %
speaking*    companion 390×844  hint visible               FORCÉ
tap*         companion 390×274  presence=listening
frappe champ site → interrupt + claire-keyboard-open (hauteur reste 274, phone-shell gagne)
magasin      chrome 274 px, header y=274 z=145
```

`*` = présence / classe forcées. Le dit.

### Extraordinaire utile

```css
/* assets/css/claire-companion.css */
--claire-stage-width: 33.333vw;
--claire-mobile-stage: clamp(176px, calc(var(--claire-vvh, 100dvh) * 0.34), 220px);
--claire-composer-band: 3.4rem;
--claire-mobile-chrome: calc(var(--claire-mobile-stage) + var(--claire-composer-band));
```

```js
// assets/js/claire-companion.js
start() → connectLiveSession({ microphone: true, state: "guided" })
SPEAKING_STAGE_HOLD_MS = 1000
isPhoneShell() → matchMedia("(max-width: 820px)")
```

---

**Fin d’audit. Pas de patch layout dans ce commit.**
