# Audit UX / cybernétique — preview Claire it34

**Date :** 4 septembre 2026  
**Cible testée :** [preview devis](https://cursor-claire-send-email-8f54-infoserv2a.infoserv2a.workers.dev/devis.html?claire=1) · commit `8fe02b5` · assets **20260904-it34** · contexte LiveAvatar **Aidant 1.27**  
**Schémas Figma / FigJam :** [board parcours + états + séquence](https://www.figma.com/board/y0THPsd9vQF5zF8Twf34a0)  
**Méthode :** desktop ~1280×800 + mobile 390×844 + curl API + lecture des boucles (`claire-companion.js`, mémoire, envoi).  
**Voix LiveAvatar :** tentée. Connexion **interrompue** dans le labo (micro automate + session coupée). La recette vocale **humaine** (Didier, téléphone) reste le contre-test.

**Indice d’optimalité actuel : 65 %.**  
**Cible après les P0 de cet audit : 88 %.**  
(Septembre : 58 % sur un barème plus étroit. La nav clic a progressé. La voix et le mobile devis tirent encore vers le bas.)

Ne pas publier sur **www** tant que C20 (voix) et C22 (formulaire mobile) ne sont pas verts.

---

## 0. Ce que « le plus simple possible » veut dire

Un visiteur ne doit avoir **qu’une action** : parler (ou écrire). Le site, à droite, **suit**. Le devis se remplit **tout seul**. L’envoi, c’est **une phrase** (« c’est bon »). Après l’envoi, un **nouveau** besoin est un **nouveau** devis. L’identité reste.

| Étape | Clics visiteur (cible) | Paroles | Ce que le site fait |
|---|---:|---|---|
| Entrer | 1 (« Parler à Claire ») | — | Session LiveAvatar LITE |
| Dire le besoin | 0 | « Caméra 4G, Porto-Vecchio… » | Onglet + champs |
| Compléter | 0 | Nom, tel, mail | Checklist CONTEXTE |
| Envoyer | 0 | « C’est bon » | POST `/api/send-email` |
| Nouveau besoin | 0 | « Je veux un site internet » | Besoin vidé, identité gardée |

**Aujourd’hui :** le chemin **code** est celui-là. Le chemin **vécu** dans le labo n’y arrive pas : LiveAvatar se coupe, le champ texte est caché, le mobile intercepte les champs du devis.

---

## 1. Couverture de la recette (ce qui a vraiment été vu)

| Scénario | Poids | Fait | Preuve |
|---|---:|---|---|
| Desktop deux colonnes, Claire à gauche | 8 | Oui | Accueil / devis, rail + site |
| Ranger / Reprendre Claire | 6 | Oui | Barre bas « Reprendre avec Claire » / Ouvrir |
| Préremplissage devis depuis la mémoire | 10 | Oui | Nom, tel, mail, commune, service, besoin déjà là |
| Checklist CONTEXTE (6 champs) | 6 | Partiel | Visible en guidé compact ; disparaît en Claire élargie |
| Parler à Claire / LiveAvatar animé | 14 | **Échec** | « La session LiveAvatar a été interrompue… » |
| Saisie texte vers Claire | 6 | Partiel | Champ en bas du dock, peu visible |
| Clic nav desktop **sans** parole | 8 | Oui (code + recette antérieure) | `handleSiteLink` + `claimUserSiteNavigation` |
| Clic **pendant** qu’elle parle | 12 | **Non** | Voix jamais stable dans ce labo |
| Envoi oral « c’est bon » bout-en-bout | 12 | **Non** | Pas d’envoi réel (éviter de spammer contact@) ; tests unitaires verts |
| Mémoire après envoi (nouveau besoin) | 8 | Code + tests | it34 ; pas de recette orale humaine ici |
| Mobile 390×844 empilé | 8 | Oui | Claire haut, site en dessous |
| Hamburger → Contact | 6 | **Échec** | Le clic ouvre Claire au lieu d’aller à Contact |
| Éditer le devis au doigt (mobile) | 8 | **Échec** | Un tap sur un champ **déplie Claire** |
| API envoi configurée | 4 | Oui | `configured:true`, Resend, `contact@` |
| LiveAvatar status Worker | 4 | Oui | LITE, marin, gpt-realtime, OpenAI **true** |

**Couverture réelle : 54 %.** Les 46 % manquants sont surtout **voix stable + envoi oral réel + mobile formulaire**.

API mesurée :

```json
{"configured":true,"provider":"resend","inboxes":{"contact":"contact@infoserv2a.pro"}}
{"configured":true,"prerequisites":{"liveAvatar":true,"openAIRealtime":true,"avatar":true},"mode":"LITE","voice":"marin"}
```

---

## 2. Scores (actuel / cible / écart)

Poids = importance visiteur. Note / 100. Score = poids × note. **Somme des poids : 178.**

| ID | Critère | Poids | Actuel | Cible | Écart | Lecture courte |
|---|---|---:|---:|---:|---:|---|
| C01 | Perception / boutons | 8 | 82 | 90 | −8 | « Ranger Claire » est clair. Statuts tronqués (« Connexion sécurisée à Cl… ») |
| C02 | Feedback boucle fermée | 10 | 76 | 88 | −12 | CONTEXTE et « Page synchronisée ». Erreurs LiveAvatar trop techniques |
| C03 | Feedforward | 7 | 68 | 86 | −18 | On ne sait pas si on reprend une vieille conversation ou une neuve |
| C04 | Bidirectionnalité | 18 | 70 | 90 | −20 | Clic verrouille le suivi de parole **dans le code**. Mobile : Contact volé par Claire |
| C05 | Stabilité | 12 | 68 | 86 | −18 | `speechFollowGate` existe. Non prouvé voix allumée |
| C06 | Autorité du clic | 12 | 72 | 92 | −20 | `claimUserSiteNavigation` + `lastFollowKey`. Recette simultanée absente |
| C07 | Interruptibilité | 8 | 70 | 90 | −20 | Interrompre / portrait OK. Session LiveAvatar se coupe toute seule |
| C08 | Mémoire identité | 6 | 78 | 88 | −10 | Identité très collante (bien). Ancien besoin caméra encore affiché au reload |
| C09 | Reprise d’erreur | 5 | 64 | 80 | −16 | Repli micro local. Message : « session interrompue » en boucle |
| C10 | Accessibilité | 6 | 55 | 82 | −27 | Mobile : champs devis inaccessibles au clavier |
| C11 | Enveloppe temps | 5 | 72 | 78 | −6 | 10 min demandées, 5 min si le plan refuse, alerte 45 s **codée** |
| C12 | Parole ↔ onglet | 8 | 74 | 88 | −14 | Suivi 360 ms. Trop zélé si le visiteur veut rester sur le devis |
| C13 | Spatial desktop | 6 | 88 | 92 | −4 | Deux colonnes lisibles |
| C14 | Spatial mobile | 6 | 48 | 86 | −38 | **P0.** Breakpoint desktop qui apparaît à 390 px. Claire fixe trop haute |
| C15 | Confiance / vérité | 5 | 90 | 92 | −2 | Pas de tarif inventé. Mail = vérité du Worker |
| C16 | Domaine public | 4 | 22 | 90 | −68 | **www** n’est pas cette preview |
| C17 | Envoi devis oral | 10 | 62 | 90 | −28 | Chaîne code + tests. Pas de preuve vocale ici |
| C18 | Préremplissage formulaire | 8 | 84 | 92 | −8 | Le plus fluide du produit aujourd’hui |
| C19 | Nouveau devis après envoi | 8 | 70 | 90 | −20 | it34 ferme le besoin. À valider à l’oral |
| C20 | Fiabilité LiveAvatar | 12 | 28 | 85 | −57 | **P0.** Interruptions répétées dans le labo |
| C21 | Découvrir l’écrit | 6 | 58 | 86 | −28 | Le champ texte est en bas du dock, hors écran |
| C22 | Devis mobile au doigt | 8 | 30 | 88 | −58 | **P0.** Tap champ = Claire plein écran |

**Score actuel : 11 592 / 17 800 = 65,1 %.**  
**Cible : 15 676 / 17 800 = 88,1 %.**

### Lecture

- **C18** (remplir le devis) est déjà dans le vert : Claire **sait** coller les faits dans le formulaire.
- **C20 + C22 + C14** pèsent **26 %** du barème et cassent l’expérience **vécue**.
- **C04–C06** ont **monté** depuis l’audit du 2 septembre (le clic pose enfin un verrou). Ils ne sont pas « livrés » tant que personne n’a cliqué **pendant** qu’elle parle.
- **C16** n’est pas de l’UI : c’est la publication. Sans lui, l’indice preview serait **66,1 %**.

---

## 3. Constats de simulation (faits)

### 3.1 Desktop — ce qui marche

- Claire à gauche, site à droite, boutons **Parler à Claire** / **Conversation** / **Ranger Claire**.
- **Ranger** → barre bas « Reprendre avec Claire · Aidante LiveAvatar + OpenAI Realtime » + **Ouvrir**. Ça marche.
- Sur `/devis`, les 6 champs étaient déjà remplis (mémoire navigateur) : Didier Aouizerate, 07 45 15 60 76, infoserv2a@gmail.com, Porto-Vecchio, Vidéosurveillance, « Caméra 4G hangar isolé… ».
- CONTEXTE cochait les 6 lignes quand le rail n’était pas en plein écran.

### 3.2 Desktop — ce qui casse la simplicité

1. **LiveAvatar** : clic « Parler » → « Connexion sécurisée à Cl… » (texte coupé) → « La session LiveAvatar a été interrompue. Le microphone local reste disponible. Je reprends. » Répété.
2. **État d’arrivée flou** : parfois overlay « Bonjour, je suis Claire », parfois **ancienne** conversation. Le visiteur ne sait pas s’il commence ou s’il reprend.
3. **Écrire à Claire** : le champ (« Ex. Explique-moi la vidéosurveillance… ») n’apparaît qu’en bas du panneau Conversation. Sans scroll, on croit que **seule** la voix existe.
4. **CONTEXTE** disparaît dès que Claire s’élargit : on perd le « où j’en suis du devis ».

### 3.3 Mobile 390×844 — bloquant

- Pas d’overlay d’arrivée (session déjà « vue ») : on tombe **dans** Claire.
- Hamburger **s’ouvre**. **Contact** ne mène pas à Contact : Claire se déplie.
- **Tapper un champ devis déplie Claire** : on ne peut plus taper Nom / Tel / Mail au clavier. C’est l’inverse de « le plus simple ».
- Parfois un layout **deux colonnes desktop** s’affiche à 390 px (bug de breakpoint).

### 3.4 Chaîne d’envoi (code, non recettée à l’oral ici)

```
Visiteur « c’est bon »
  → runtime submit_quote
  → POST /api/send-email (Resend, From InfoServ2A <site@infoserv2a.pro>, To contact@)
  → [INFOSERV2A_APP_RESULT] « bien été envoyée »
  → closeQuoteAfterSuccessfulSend : besoin vidé, identité gardée, LiveAvatar prévenue
```

Le **même** brouillon n’est pas renvoyé. Un **nouveau** besoin oral = nouveau devis. Tests unitaires : 171/171 au commit.

---

## 4. Schématique (application complète)

Quatre vues dans FigJam : [ouvrir le board](https://www.figma.com/board/y0THPsd9vQF5zF8Twf34a0)

1. **Parcours visiteur** — arrivée → voix ou texte → faits → devis → envoi → nouveau besoin.  
2. **États Claire** — Arrival, Guided, Shared, Manual, Listening, Speaking, LocalMic, Sending.  
3. **Séquence envoi** — visiteur, avatar, SPA, Worker, Resend.  
4. **Cible simple + écrans Figma** — le minimum d’actions, et ce qu’il faut dessiner.

### Boucle cybernétique (deux gouvernails)

| Gouvernail | Sens | Règle |
|---|---|---|
| Claire → droite | Elle nomme un onglet, la page suit **sans couper** sa voix | Nouveau sujet |
| Droite → Claire | Le visiteur clique, la page **reste**, Claire **continue** | Le clic gagne jusqu’à la prochaine prise de parole |
| Formulaire | La voix **écrit** à droite | L’écrit à droite **n’est pas** une nouvelle demande si c’est le devis déjà envoyé |
| Après envoi | Identité **oui** · besoin **non** | Un nouveau besoin = un nouveau devis |

Le troisième gouvernail manquant aujourd’hui : **le doigt sur le formulaire mobile** ne doit **pas** ouvrir Claire.

---

## 5. Comment améliorer avec Figma

Ne pas redessiner tout le site. Six **écrans** (desktop + mobile) suffisent. Les prototyper dans Figma (fichier Design, pas seulement FigJam), puis raccorder le CSS / les états.

| Écran Figma | Problème mesuré | Règle d’interface |
|---|---|---|
| **F1 Arrivée** | Overlay sauté / état flou | Deux boutons seulement : « Parler à Claire » · « Voir le site ». Badge « Vous reprenez » si mémoire présente |
| **F2 Guidé desktop** | CONTEXTE qui disparaît | Rail Claire **fixe** ~390 px. CONTEXTE **toujours** sous l’encart parole sur la page devis. Statut d’une ligne, **non** tronqué : « Voix prête » / « Écrivez-moi » / « Voix coupée — vous pouvez écrire » |
| **F3 Conversation** | Champ texte invisible | Champ **toujours** collé en bas du rail, 44 px de haut minimum, placeholder « Écrire à Claire ». Voix = bonus, pas l’unique porte |
| **F4 Devis clos** | Ancien besoin qui reste | Après envoi : pastilles identité (Nom, Tel, Mail, Commune) + champ Besoin **vide** + une ligne « Demande envoyée. Dites un nouveau besoin. » |
| **F5 Mobile feuille** | Claire mange les champs | Claire = **feuille bas** 40 % max, **pas** 48 vh fixes. Les inputs devis restent **cliquables**. Un tap champ **n’ouvre pas** le dock Conversation |
| **F6 Mobile menu** | Contact volé | Hamburger = **site**. Claire n’intercepte pas. Option « Demander à Claire » à part, visuelle différente |

### Prototype vocal (Figma Make ou proto clic)

1. Frame F2 : Claire « parle » (état Speaking) → la colonne droite passe Vidéosurveillance **sans** overlay.  
2. Clic Contact **pendant** Speaking → URL Contact, Claire **continue** (pas d’écran noir, pas de « Mode manuel »).  
3. Frame F4 : après « bien envoyé », vider Besoin, garder le nom.  
4. Frame F5 : tap E-mail → clavier, Claire reste en bandeau.

C’est ça, « le plus fluide » : **zéro mode à apprendre**.

### Déjà dans le repo

`data/claire-aidant-figma.json` + `claire-aidant-figma.html` (8 frames aidante). **À mettre à jour** avec F4 / F5 / F6 : ils n’existent pas encore.

---

## 6. Exigences testables (cahier)

| ID | P | Lié | Énoncé |
|---|---|---|---|
| E-LIVE-01 | P0 | C20 | Un clic « Parler à Claire » sur la preview aboutit à une session **stable** ≥ 60 s, visage + voix, **ou** un message unique « Écrivez-moi » sans boucle d’erreur |
| E-TXT-01 | P0 | C21 | Champ d’écriture visible **sans** ouvrir un second panneau, desktop et mobile |
| E-MOB-FORM-01 | P0 | C22 C14 | Sur 390 px, focus `#devis-name` **n’ouvre pas** Claire ; le clavier édite le champ |
| E-MOB-NAV-01 | P0 | C04 C10 | Hamburger → Contact change `#contenu` vers Contact, Claire reste bandeau |
| E-SEND-01 | P0 | C17 | « C’est bon » sur devis complet → un seul POST, oral « bien été envoyée », destination contact@ |
| E-MEM-01 | P0 | C19 | Après envoi, Besoin vide ; dire « je veux un site internet » ne rejoue **pas** la caméra |
| E-NAV-LIVE-01 | P0 | C04 C05 C06 | Clic Contact **pendant** une phrase caméras : on **reste** sur Contact ≥ 3 s, voix non coupée |
| E-STAT-01 | P1 | C01 C09 | Aucun statut tronqué. Trois libellés max : prête / j’écoute / voix indisponible |
| E-CTX-02 | P1 | C02 C08 | CONTEXTE devis visible tant qu’on est sur `/devis` |
| E-ARR-01 | P1 | C03 | Si mémoire : « Je reprends, Didier. » Une phrase. Pas un accueil complet |
| E-BP-01 | P1 | C14 | 390 px = empilé. Jamais le split desktop |
| E-PROD-01 | P1 | C16 | www = même Worker que cette preview (**quand vous le demanderez**) |

Critère global : **indice ≥ 82 %** et **C20, C22, C17 ≥ 80**.

---

## 7. Ordre de travail (pas de calendrier, de l’ordre)

1. **E-LIVE-01** — sans voix stable, le reste est du théâtre.  
2. **E-TXT-01** — filet si la voix lâche.  
3. **E-MOB-FORM-01 + E-MOB-NAV-01 + E-BP-01** — le téléphone.  
4. Recette **humaine** E-SEND-01 + E-MEM-01 sur **cette** preview (Ctrl+Shift+R, it34).  
5. **E-NAV-LIVE-01** voix + clic ensemble.  
6. Figma F1–F6, puis pixels.  
7. Publication www **seulement** après 4 et 5 verts.

---

## 8. Ce qui n’est pas un bug d’interface

- Apex `infoserv2a.pro` sans www = GitHub Pages, **pas** d’API.  
- Plan LiveAvatar qui plafonne à **5 minutes** : repli déjà codé.  
- Ne pas envoyer vers `devis@` tant que la boîte n’existe pas.

---

## 9. Recette Didier (10 minutes, téléphone réel)

1. Ctrl+Shift+R sur la [preview devis](https://cursor-claire-send-email-8f54-infoserv2a.infoserv2a.workers.dev/devis.html?claire=1).  
2. Parler : un devis caméra, puis « c’est bon ».  
3. Dire un **autre** besoin (site internet). Claire ne doit plus ressortir la caméra.  
4. Ranger Claire, cliquer Contact, **revenir** : Claire toujours là.  
5. Sur le téléphone : hamburger → Contact ; taper le champ Nom **sans** que Claire recouvre.

Si 2, 3 et 5 passent, l’indice ressenti passera au-dessus de 80 %. Aujourd’hui, le labo n’a validé que le **remplissage** et le **Ranger/Reprendre**.

---

## 10. Preuves de cette recette (4 septembre 2026)

Captures sur la preview `cursor-claire-send-email-8f54` (it34), desktop ~1280×800 et mobile 390×844.

| Capture | Ce qu’elle montre |
|---|---|
| Accueil deux colonnes + CONTEXTE 6/6 | C13, C18 : identité et besoin déjà collés à droite |
| Devis prérempli + Claire rangée | Ranger/Reprendre : le site reste utilisable |
| Contact deux colonnes | Navigation desktop, CONTEXTE « Contact » |
| Mobile 390 empilé / hamburger | C14, C04 : layout téléphone et menu site |
| Tap Contact / champ devis | C22 : le doigt ouvre Claire au lieu d’éditer |

FigJam (parcours + états Claire + séquence envoi + écrans F1–F6) : [board y0THPsd9vQF5zF8Twf34a0](https://www.figma.com/board/y0THPsd9vQF5zF8Twf34a0)

Légende séquence : **V** visiteur · **C** Claire / LiveAvatar · **S** site (SPA) · **W** Worker `/api/send-email` · **R** Resend → `contact@infoserv2a.pro`.
