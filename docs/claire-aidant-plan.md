# Plan Claire — aidante Live Avatar d’InfoServ2A

Date : 1er septembre 2026  
Statut : généraliste OpenAI Live, interruption et page de droite synchronisée (contexte Aidant 1.7)  
Référence visuelle : `/claire-aidant-figma.html` · `data/claire-aidant-figma.json`

## 1. Intention

Greffer sur le site InfoServ2A la même Claire que Pocket Guide : une aidante audiovisuelle unique, voix OpenAI `marin`, avatar LiveAvatar vertical 9:16. Elle n’est pas une bulle de support. Elle occupe l’arrivée, reste visible pendant la navigation, et rend la main à tout moment.

Claire est **généraliste**, comme OpenAI Live. LiveAvatar n’est que le visage et la voix, reliés à OpenAI Realtime. Elle peut dialoguer de n’importe quel sujet, indépendamment du site, tout en connaissant le contexte général d’InfoServ2A et l’onglet visible. Le site est un catalogue d’actions qu’elle peut exécuter, pas une contrainte de conversation.

Elle n’invente ni tarif, ni délai, ni diagnostic. Le site reste la source de vérité pour les faits InfoServ2A.

## 2. Expérience

| État | Rôle | Surface |
|---|---|---|
| `arrival` | Premier contact | Portrait LiveAvatar + une action « Parler à Claire » |
| `shared` / `action` | Conversation généraliste | Portrait + transcript + suggestions + résultat vérifié si le site a bougé |
| `guided` | Navigation accompagnée, onglet par onglet | Rail 38 % desktop / scène haute mobile 9:16, le site défile à côté |
| `manual` | Site classique | Barre de rappel en bas, sans masquer le dock mobile |

Aucune pastille en bas à droite. Le mode manuel est toujours disponible.

## 3. Architecture

```
Visiteur
  → Claire UI (partials/header.html)
  → ClaireCompanion + Runtime V2.1 généraliste
       ├─ conversation Realtime par défaut (kind = chat)
       ├─ catalogue d’onglets : search_site, open_service, scroll_to,
       │  open_contact, prefill_quote, list_catalog, explain_page,
       │  go_home, next_page, prev_page, next_section, prev_section
       ├─ surface persistante (#contenu, history.pushState, session conservée)
       └─ LiveAvatar provider (jeton éphémère /api/liveavatar-session)
            → LiveAvatar LITE + OpenAI Realtime gpt-realtime / voix marin
            → briefing [INFOSERV2A_SITE_BRIEFING] + onglet [INFOSERV2A_PAGE_CONTEXT]
```

Règles non négociables :

1. Aucune clé LiveAvatar ou OpenAI dans le navigateur.
2. Une seule commande à la fois.
3. Le modèle ne touche pas le DOM.
4. Un formulaire n’est jamais soumis par Claire.
5. Une phrase hors navigation reste une conversation Realtime naturelle. Claire n’attend pas `[INFOSERV2A_APP_RESULT]` pour répondre.
6. Quand Claire nomme un onglet, la page de droite se synchronise sur sa parole (`AVATAR_TRANSCRIPTION`) sans la couper. Une demande utilisateur de navigation s’exécute en parallèle ; Realtime continue de parler. Le site n’envoie plus `[INFOSERV2A_APP_RESULT]` pour une commande `liveavatar`.
7. La navigation interne ne recharge pas le document : l’avatar et la session restent.

## 4. Greffe déjà en place

- Scène LiveAvatar sur les 13 pages publiques.
- Contrôleur `assets/js/claire-runtime-v2.mjs` et manifeste `data/claire-capabilities.json` (12 outils).
- Surface persistante `assets/js/claire-site-runtime-adapter.mjs`.
- Laboratoire texte `/claire-lab` (aucun secret, aucune voix).
- Ancres canoniques : `solutions-sans-fibre`, `audit-nis2`, `supports`, `offre-hebergement`.
- Contexte LiveAvatar `InfoServ2A Claire Aidant 1.7` (prompt généré depuis `data/site-knowledge.json`).

## 5. Spec Figma

Le fichier Figma distant n’est pas authentifié dans cet environnement agent. La source de vérité visuelle est donc versionnée ici :

- Inventaire des frames et tokens : `data/claire-aidant-figma.json`
- Planche d’art desktop / mobile / états : `/claire-aidant-figma.html`

Frames à pousser dans Figma dès que le MCP Figma est authentifié sur le bureau Cursor :

| Frame | Viewport | Usage |
|---|---|---|
| F01 Accueil aidante | 1440×900 | Arrivée desktop |
| F02 Accueil mobile | 390×844 | Arrivée 9:16 |
| F03 Conversation | 1440×900 | Transcript + résultat vérifié |
| F04 Rail guidé | 1440×900 | Claire 38 % + site |
| F05 Guidé mobile | 390×844 | Scène haute + site en dessous |
| F06 Rappel manuel | 390×844 | Barre « Reprendre avec Claire » |
| F07 Laboratoire | 1280×800 | Runtime V2 texte |
| F08 Présence | 1440×420 | ready / listening / thinking / speaking / error |

## 6. Secrets Cloudflare

À définir uniquement dans le tableau de bord Workers, jamais dans Git :

- `LIVEAVATAR_API_KEY`
- `OPENAI_API_KEY` ou `LIVEAVATAR_OPENAI_SECRET_ID`
- optionnel `LIVEAVATAR_AVATAR_ID` (Claire Pocket Guide par défaut)
- optionnel `LIVEAVATAR_CONTEXT_ID` après la première création du contexte Aidant 1.7. Si une ancienne valeur pointe encore vers 1.3, 1.4, 1.5 ou 1.6, la supprimer pour forcer la recréation.

## 7. Acceptation

1. L’arrivée nomme Claire comme aidante Live Avatar.
2. Une question générale (capitale, blague, disque, Wi-Fi) reste en conversation : aucune page ne change.
3. « Affiche les solutions de vidéosurveillance sans fibre » exécute search → open → scroll et conserve Claire.
4. « Onglet suivant » / « onglet précédent » parcourt les 13 pages dans l’ordre du catalogue.
5. « Quels sont les onglets du site ? » énumère le catalogue sans changer de page.
6. Un clic interne ne détruit pas la session LiveAvatar.
7. Contact et devis n’envoient rien tout seuls.
8. Le laboratoire `/claire-lab` fonctionne sans secret.
9. La planche `/claire-aidant-figma` documente les 8 frames.
10. Le contre-test physique Galaxy S22 reste obligatoire avant de déclarer le son mobile validé.
11. Parler, toucher Claire ou « Interrompre » coupe sa réponse et la remet à l’écoute.
12. Pendant qu’elle lit un onglet, la page de droite zappe sur cet onglet / cette section.

## 8. Audit cahier des charges — généraliste + catalogue d’onglets

Cahier des charges énoncé : Claire n’est pas limitée au site ; LiveAvatar est le visage d’OpenAI Live ; elle connaît le contexte général du site ; on peut dialoguer indépendamment ; la navigation se fait onglet par onglet, avec un vrai catalogue d’actions.

| Exigence | Verdict | Preuve |
|---|---|---|
| Interlocutrice généraliste, comme OpenAI Live | **Conforme** | `classifyUtterance` est `chat` par défaut. Barge-in dès que le visiteur parle. Contexte Aidant 1.7. |
| Interruption (parler / toucher / Interrompre) | **Conforme** | `bargeIn` sur `USER_SPEAK_STARTED`, transcription, micro, scène et bouton. |
| Navigation synchronisée avec ce qu’elle dit | **Conforme** | `followSpokenNavigation` zappe l’onglet et la section de droite pendant `AVATAR_TRANSCRIPTION`. |
| LiveAvatar relié à OpenAI Live / Realtime | **Conforme** | Session LITE, `gpt-realtime`, voix `marin`, température 0.6. LiveAvatar n’est pas le cerveau : c’est le visage. |
| Contexte général du site (13 onglets, identité, horaires, téléphone) | **Conforme** | `buildSiteBriefing` + prompt LiveAvatar générés depuis `data/site-knowledge.json`. Envoi `[INFOSERV2A_SITE_BRIEFING]` à la connexion. |
| Dialogue indépendant du site | **Conforme** | Salutations, hors-sujet, culture générale, symptôme (disque, Wi-Fi) → `chat`, aucune navigation. Texte tapé → `[INFOSERV2A_USER_TEXT]`. |
| Navigation onglet par onglet | **Conforme** | Outils `next_page` / `prev_page` / `go_home` ; ordre = `knowledge.pages`. Contexte d’onglet renvoyé après chaque changement. |
| Sections à l’intérieur d’un onglet | **Conforme** | `next_section` / `prev_section` / `scroll_to` / `explain_page`. |
| Catalogue d’actions complet | **Conforme** | 12 outils déclarés dans `data/claire-capabilities.json` : recherche, ouverture, défilement, contact, devis, catalogue, explication, accueil, onglet ±, section ±. |
| Ne pas hijacker une phrase générale vers une page | **Conforme** | Un simple mot-clé (`disque`, `wifi`, `caméra` sans « sans fibre ») ne déclenche plus `open_service`. |
| Demandes de service encore actionnables | **Conforme** | Verbe d’ouverture, site isolé / sans internet, création de site, devis, contact, appel/e-mail, catalogue, onglet suivant. |
| Garde-fous inchangés | **Conforme** | Pas de DOM depuis le modèle, pas de soumission de formulaire, une commande à la fois, mode manuel, session persistante `#contenu`. |

Hors périmètre DNS : `infoserv2a.pro` est encore servi par GitHub Pages (NS OVH → IPs `185.199.x.x`). `/api/liveavatar-session` y répond 404. La prévisualisation Workers de cette branche porte les secrets. Procédure de bascule, inventaire MX/SPF et custom domain : `docs/activer-claire-sur-infoserv2a-pro.md`.
