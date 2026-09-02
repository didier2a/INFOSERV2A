# Audit d’ergonomie cybernétique — Claire Live Avatar

**Date :** 2 septembre 2026  
**Périmètre :** l’expérience Claire (pas le catalogue InfoServ2A page par page). Non exhaustif : assez détaillé pour servir de cahier des charges à raccorder.  
**Cible mesurée :** preview `https://cursor-claire-it-only-8f54-infoserv2a.infoserv2a.workers.dev/?claire=1` · commit `5a970bf` · assets `20260901-it11` · contexte LiveAvatar **Aidant 1.14**.  
**Méthode :** simulation desktop (~1280×800) + mobile (390×844) + lecture des boucles (`claire-companion.js`, `claire-core.mjs`, CSS, session LiveAvatar). Voix LiveAvatar **non** recettée ici (micro / permission).

**Indice d’optimalité cybernétique actuel : 58 %.**  
**Cible après les exigences P0 de ce cahier : 82 %.**

---

## 0. Ce que « cybernétique » veut dire ici

Une boucle fermée à **deux gouvernails** :

| Gouvernail | Sens | Règle d’autorité |
|---|---|---|
| Claire → droite | Elle nomme un onglet / une section, la page suit **sans couper sa voix** | Nouveau sujet (ou demande orale explicite) |
| Droite → Claire | Le visiteur clique, la page **change tout de suite**, Claire **continue de parler** | Le clic **gagne** jusqu’au prochain sujet |

Le visiteur ne doit jamais avoir à « Mode manuel » pour cliquer. Mode manuel = quitter Claire, pas naviguer avec elle.

---

## 1. Couverture de la simulation

| Scénario | Poids | Fait | Preuve |
|---|---:|---|---|
| Guidé desktop, Claire à gauche / site à droite | 12 % | Oui | Captures deux colonnes, `body.claire-is-guided`, rail ~390 px |
| Clics header / Offres / footer **sans** parole | 14 % | Oui | Contact, À propos, Vidéosurveillance, Mentions légales — URL et `#contenu` changent, session conservée |
| Clics **pendant** qu’elle parle (simultané) | 18 % | **Non** | Micro bloqué ; `followSpeech()` non injecté |
| Arrivée `?claire=1` | 8 % | Partiel | Desktop : session déjà « seen » → saut vers guidé. Mobile : overlay plein écran observé |
| Mode manuel + barre Reprendre | 8 % | Oui | Claire disparaît, site pleine largeur, toast « Reprendre avec Claire » |
| Guidé mobile empilé | 12 % | Oui | Scène haute ~405 px (~48 vh), `padding-top` 405 px, contenu joignable en dessous |
| Menu hamburger mobile + Contact | 8 % | **Échec** | Clic menu site non abouti ; confusion avec « Navigation manuelle » Claire |
| Overlay encart parole / pied de page | 10 % | Partiel | Encart `z-index: 130`, `pointer-events: auto`, largeur de la colonne droite |
| Production `www.infoserv2a.pro` | 10 % | Mesure curl | Worker `live2`, OpenAI absent — **pas** cette preview |

**Couverture réelle de la recette : 62 %.** Les 38 % manquants sont surtout le **simultané voix + clic**, c’est-à-dire le cœur du cahier.

---

## 2. Tableau de scores (actuel / cible / écart)

Poids = importance pour l’expérience visiteur. Note / 100. Score pondéré = poids × note.

| ID | Critère | Poids | Actuel | Cible | Écart | Commentaire court |
|---|---|---:|---:|---:|---:|---|
| C01 | Perception / affordance | 8 | 78 | 90 | −12 | Deux colonnes lisibles. Double libellé « manuel ». Contexte bas mélange parfois deux onglets |
| C02 | Feedback (boucle fermée) | 10 | 72 | 88 | −16 | Statut « Page synchronisée », encart CONTEXTE. Pas de signal « c’est **votre** clic » vs « c’est **elle** » |
| C03 | Feedforward (prévisible) | 7 | 62 | 86 | −24 | Le visiteur ne sait pas qui possède la page dans 360 ms |
| C04 | Bidirectionnalité / contrôle partagé | 18 | 38 | 90 | −52 | **P0.** Claire→site codé. Site→Claire sans verrou : le suivi de parole peut ramener la page |
| C05 | Stabilité (pas d’oscillation) | 12 | 42 | 86 | −44 | **P0.** `SPEECH_FOLLOW_MS = 360` sans `userNavLock` |
| C06 | Autorité / override | 12 | 35 | 92 | −57 | **P0.** Le clic ne met pas `lastFollowKey` ; `followInFlight` peut gagner la course |
| C07 | Interruptibilité vocale | 8 | 84 | 90 | −6 | Interrompre / portrait / micro. Plus de barge-in auto. Mode manuel coupe encore la voix |
| C08 | Mémoire de session | 6 | 80 | 88 | −8 | `sessionStorage` ; l’encart peut afficher l’onglet précédent collé au courant |
| C09 | Reprise d’erreur | 5 | 52 | 80 | −28 | 5 min `max_session_duration: 300` ; repli local si secrets absents |
| C10 | Accessibilité | 6 | 58 | 82 | −24 | Arrivée `aria-modal`. Escape = quitter Claire. Hamburger mobile fragile |
| C11 | Enveloppe temporelle | 5 | 40 | 78 | −38 | Coupure sèche à 5 min (`MAX_DURATION_REACHED`) |
| C12 | Couplage parole ↔ onglet | 8 | 70 | 88 | −18 | Suivi 1.14 (titre unique, sans « Voici l’onglet »). Trop zélé face au clic |
| C13 | Spatial desktop | 6 | 86 | 92 | −6 | `padding-left: var(--claire-stage-width)`. Companion `pointer-events: none` sauf enfants |
| C14 | Spatial mobile | 6 | 64 | 86 | −22 | Empilement 48 vh OK. Encart bas + hamburger à vérifier |
| C15 | Confiance / vérité | 5 | 88 | 92 | −4 | Pas de tarif inventé. Site = source de vérité |
| C16 | Domaine public | 4 | 22 | 90 | −68 | `www` = `live2` ; apex = GitHub Pages |

**Somme des poids : 126.**  
**Score actuel pondéré : 7 348 / 12 600 = 58,3 %.**  
**Cible pondérée (notes « Cible ») : 10 332 / 12 600 = 82,0 %.**

### Lecture

- Les trois critères **C04 + C05 + C06** pèsent **33 %** du total et tirent l’indice à 58 %. C’est le bloc « je n’arrive pas à naviguer en manuel **avec** Claire ».
- Layout desktop (C13) et confiance (C15) sont déjà dans le vert.
- C16 n’est pas de l’ergonomie d’interface : c’est la publication. Sans lui, l’indice monterait à **59,4 %** — le problème n’est donc **pas** le domaine.

---

## 3. Constats de simulation (faits)

### 3.1 Desktop guidé — ce qui marche

- Claire occupe le rail gauche (~390 px, `--claire-stage-width`) ; le site a un `padding-left` ; **pas** un overlay plein écran.
- Clics **Contact**, **À propos**, **Offres → Vidéosurveillance**, **Mentions légales** : la colonne droite change, l’URL suit, Claire reste. Statut : « Page synchronisée avec Claire ».
- Mega-menu Offres (3 colonnes) s’ouvre et se clique.
- « Mode manuel » / « Navigation manuelle » : Claire part, site pleine largeur, barre « Reprendre avec Claire » / Ouvrir.
- En manuel, Contact recharge en navigation native.

### 3.2 Desktop — ce qui n’a pas été prouvé

- Arrivée `?claire=1` sautée (sessionStorage `infoserv2a.claire.seen` / mode guidé déjà posé).
- Aucune phrase parlée : le test « je clique Contact pendant qu’elle parle vidéosurveillance » **n’a pas eu lieu**.

### 3.3 Mobile empilé

- Scène Claire **405 px** (~48 % de 844), `padding-top: 405 px`, header site juste en dessous, contenu joignable.
- Encart parole : hauteur ~56 px, `z-index: 130`, bas d’écran.
- Mode manuel : Claire repliée, barre Reprendre en bas (zone pouce). Dock mobile masqué en guidé (`body.claire-is-guided .mobile-dock { display: none }`).
- Hamburger du **site** : clic automate échoué ; risque de confondre avec le bouton Claire « Navigation manuelle ».

### 3.4 Production vs preview (curl, 2 sept. 15:54 UTC)

| URL | Client | LiveAvatar |
|---|---|---|
| Preview branche | `20260901-it11` | `configured: true` |
| `www.infoserv2a.pro` | `20260830-live2` | `openAIRealtime: false` |
| `infoserv2a.pro` | GitHub Pages | API 404 HTML |

Procédure de promotion : `docs/activer-claire-sur-infoserv2a-pro.md`.

---

## 4. Constats code (ce que la simulation voix aurait montré)

### 4.1 Le clic ne verrouille pas le suivi de parole

`handleSiteLink` : `preventDefault` + `navigateInternal(..., { announce: false, silent: true })`.  
Il ne pose **pas** `lastFollowKey` sur la page cliquée.  
`syncSiteToSpeech` tourne 360 ms après chaque `AVATAR_TRANSCRIPTION`. Si le buffer contient encore « vidéosurveillance », la page **revient**.

C’est le mécanisme le plus probable du « je n’arrive pas à naviguer en simultané ».

**Exigence E-NAV-01.** Au clic site : marquer la page comme choix visiteur ; ignorer le suivi de parole jusqu’à une **nouvelle** prise de parole (nouveau `AVATAR_SPEAK_STARTED` après le clic) **et** un sujet distinct. Vider le buffer d’ancienne phrase au déverrouillage.

**Exigence E-NAV-02.** Si un suivi est déjà `followInFlight` au moment du clic, le clic gagne : epoch / restauration de l’href visiteur.

**Exigence E-NAV-03.** Si `navigateInternal` échoue après `preventDefault`, `location.assign` (ne pas avaler le clic).

### 4.2 L’encart parole mange les clics du bas

`.claire-live-prompt` : `position: fixed`, `left: stage + 0.9rem`, `right: 0.9rem`, `bottom: 0.9rem`, `max-height: min(28vh, 240px)`, **`pointer-events: auto`**, `z-index: 130`. En guidé il est affiché dès `setState("guided")`.

Le header n’est pas dessous (d’où les clics Contact OK). Le **footer** et les CTA bas le sont.

**Exigence E-OVL-01.** `pointer-events: none` sur l’aside ; `auto` seulement sur le questionnaire devis (items cliquables).

### 4.3 « Mode manuel » n’est pas la navigation manuelle demandée

`enterManualMode()` appelle `interrupt()`, cache le rail, pose `state === "manual"`. Alors `handleSiteLink` **ne s’applique plus** (navigation native).

Le visiteur qui veut cliquer **à droite avec Claire à gauche** n’a pas besoin de ce bouton. Les deux libellés (« Navigation manuelle » en tête, « Mode manuel » en bas) le poussent à **quitter**.

**Exigence E-MAN-01.** Garder le guidé deux colonnes comme mode de clic. Renommer la sortie : « Continuer sans Claire » / « Ranger Claire ».

**Exigence E-MAN-02.** Un clic site **ne** doit pas appeler `interrupt()`.

### 4.4 Voix isolée (déjà livré, à conserver)

- `sendContext` / briefing / mémoire : notes locales, plus `session.message()`.
- Clics : `silent: true`, pas de `speak("La page Contact est affichée")`.
- Pas de barge-in auto sur `USER_SPEAK_STARTED`.

**Exigence E-VOICE-01.** Ne pas réintroduire d’injection LiveAvatar ni d’annonce de page au clic.

### 4.5 Session 5 minutes

`max_session_duration: 300`. Coupure produit, pas un bug de nav.

**Exigence E-TIME-01.** Prévenir ~45 s avant la fin ; proposer de relancer sans perdre l’onglet visible.

### 4.6 Contexte visuel incohérent

Après un clic Contact, l’encart a montré « CONTEXTE : Contact - videosurveillance ». Mémoire de session + page courante collées.

**Exigence E-CTX-01.** L’encart affiche **uniquement** l’onglet / la section **visibles**. Le sujet de conversation reste dans le transcript, pas dans la ligne CONTEXTE.

---

## 5. Exigences à raccorder (cahier des charges)

Priorité : P0 bloquant visiteur · P1 ergonomie forte · P2 confort.

| ID | P | Score lié | Énoncé testable |
|---|---|---|---|
| E-NAV-01 | P0 | C04 C05 C06 | Clic Contact pendant une phrase « caméras 4G » : URL `contact.html` **et** y reste ≥ 3 s, voix non coupée |
| E-NAV-02 | P0 | C05 | Course suivi / clic : le href visiteur est l’état final |
| E-NAV-03 | P0 | C06 | Échec SPA → navigation native, jamais clic mort |
| E-OVL-01 | P0 | C13 C14 | `elementFromPoint` sur Mentions légales / Devis footer traverse l’encart |
| E-MAN-01 | P1 | C01 C03 | Clic site possible **sans** quitter le rail Claire |
| E-MAN-02 | P0 | C07 | Clic site ≠ `interrupt()` |
| E-VOICE-01 | P0 | C07 C12 | Conservé : pas d’annonce de page, pas de `session.message()` de contexte |
| E-CTX-01 | P1 | C02 C08 | Ligne CONTEXTE = page visible seulement |
| E-MOB-01 | P1 | C10 C14 | Hamburger ouvre le panneau site ; Contact mobile change `#contenu` |
| E-TIME-01 | P1 | C09 C11 | Avertissement avant `MAX_DURATION_REACHED` |
| E-COPY-01 | P2 | C01 | Sortie Claire ≠ « navigation manuelle » |
| E-PROD-01 | P1 | C16 | `www` sert `it11`+ et `"configured":true` (hors code : secret + promote) |

Critère d’acceptation global : **indice ≥ 82 %** sur ce barème, avec C04, C05, C06 chacun ≥ 85.

---

## 6. Hors périmètre (volontairement)

- Recette vocale Galaxy S22 / iPhone (son, labiales) — déjà notée comme contre-test physique.
- Fusion `main` et DNS racine `infoserv2a.pro` — procédure séparée.
- Refonte Figma / nouveau visage.
- Questionnaire devis métier (contenu des champs).

---

## 7. Ordre de raccord recommandé

1. E-NAV-01 + E-NAV-02 + E-MAN-02 (autorité du clic, voix intacte).  
2. E-OVL-01 (footer cliquable).  
3. Recette **voix allumée** : parler + cliquer, desktop puis 390×844.  
4. E-CTX-01, E-MOB-01, E-COPY-01.  
5. E-TIME-01, E-PROD-01.

Tant que (1) et (3) ne sont pas verts, l’expérience « simultanée » n’est pas livrable, même si les clics **à froid** passent déjà.
