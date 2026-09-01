# Plan Claire — aidante Live Avatar d’InfoServ2A

Date : 1er septembre 2026  
Statut : greffe P1 sur le site public, spec Figma versionnée dans le dépôt  
Référence visuelle : `/claire-aidant-figma.html` · `data/claire-aidant-figma.json`

## 1. Intention

Greffer sur le site InfoServ2A la même Claire que Pocket Guide : une aidante audiovisuelle unique, voix OpenAI `marin`, avatar LiveAvatar vertical 9:16. Elle n’est pas une bulle de support. Elle occupe l’arrivée, reste visible pendant la navigation, et rend la main à tout moment.

Claire est l’**aidante** du site. Elle explique, oriente et affiche. Elle n’invente ni tarif, ni délai, ni diagnostic. Le site reste la source de vérité.

## 2. Expérience

| État | Rôle | Surface |
|---|---|---|
| `arrival` | Premier contact | Portrait LiveAvatar + une action « Parler à Claire » |
| `shared` / `action` | Conversation | Portrait + transcript + suggestions + résultat vérifié |
| `guided` | Navigation accompagnée | Rail 38 % desktop / scène haute mobile 9:16, le site défile à côté |
| `manual` | Site classique | Barre de rappel en bas, sans masquer le dock mobile |

Aucune pastille en bas à droite. Le mode manuel est toujours disponible.

## 3. Architecture

```
Visiteur
  → Claire UI (partials/header.html)
  → ClaireCompanion + Runtime V2
       ├─ search_site / open_service / scroll_to / open_contact / prefill_quote
       ├─ surface persistante (#contenu, history.pushState, session conservée)
       └─ LiveAvatar provider (jeton éphémère /api/liveavatar-session)
            → LiveAvatar LITE + OpenAI Realtime gpt-realtime / voix marin
```

Règles non négociables :

1. Aucune clé LiveAvatar ou OpenAI dans le navigateur.
2. Une seule commande à la fois.
3. Le modèle ne touche pas le DOM.
4. Un formulaire n’est jamais soumis par Claire.
5. Après une demande de navigation, Claire attend `[INFOSERV2A_APP_RESULT]` avant de parler. Les apartés hors site restent une conversation Realtime naturelle. Le contexte de page lui est transmis via `[INFOSERV2A_PAGE_CONTEXT]`.
6. La navigation interne ne recharge pas le document : l’avatar et la session restent.

## 4. Greffe déjà en place

- Scène LiveAvatar sur les 13 pages publiques.
- Contrôleur `assets/js/claire-runtime-v2.mjs` et manifeste `data/claire-capabilities.json`.
- Surface persistante `assets/js/claire-site-runtime-adapter.mjs`.
- Laboratoire texte `/claire-lab` (aucun secret, aucune voix).
- Ancres canoniques : `solutions-sans-fibre`, `audit-nis2`, `supports`, `offre-hebergement`.
- Contexte LiveAvatar `InfoServ2A Claire Aidant 1.5`.

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
- optionnel `LIVEAVATAR_CONTEXT_ID` après la première création du contexte Aidant 1.5. Si une ancienne valeur pointe encore vers 1.3 ou 1.4, la supprimer pour forcer la recréation.

## 7. Acceptation

1. L’arrivée nomme Claire comme aidante Live Avatar.
2. « Affiche les solutions de vidéosurveillance sans fibre » exécute search → open → scroll et conserve Claire.
3. Un clic interne ne détruit pas la session LiveAvatar.
4. Contact et devis n’envoient rien tout seuls.
5. Le laboratoire `/claire-lab` fonctionne sans secret.
6. La planche `/claire-aidant-figma` documente les 8 frames.
7. Le contre-test physique Galaxy S22 reste obligatoire avant de déclarer le son mobile validé.
