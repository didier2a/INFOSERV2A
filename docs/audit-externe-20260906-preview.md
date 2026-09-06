# Audit externe 6 sept. 2026 → preview #12

**Source :** rapport indépendant *Audit UX & IA | infoserv2a.pro* (28 p., 6 sept. 2026), confronté à `docs/audit-ux-oral-ecrit-www-20260906.md` (PR #9) et aux specs Didier (Claire = devanture).

**Cible :** preview `cursor/arrivee-devanture-8f54` seulement. Pas www, pas `custom_domain`, pas de merge.

**Assets :** `20260906-it41`. Contexte LiveAvatar **Aidant 1.31**.

IT40 n’était **pas** tout P0–P2. IT41 traite le reste preview-codable, par priorité. L’arrivée logo + deux portes (IT40, recette Didier **OK**) n’est pas retouchée.

## Tableau point PDF × statut

| ID | PDF / notre audit | Statut | Itération |
|---|---|---|---|
| E-MAIL-SYN-01 | Destination / revue / pas de dump oral | Fait | IT38 |
| E-ARR-01 / E-DUP-01 | Un seul rituel ; reconnexion ≠ welcome + « Je reprends » | Durci : skip cue + welcomeShown sur reconnect ; mémoire silencieuse | IT40 puis **IT41** |
| E-TXT-01 | Écrire / parler ; fallback texte | Fait : champ sous les portes | IT40 |
| E-PH-01 | Placeholders devis/contact | Fait | IT40 |
| E-REQ-01 | `*` + erreur FR sous champ | Fait : `*` IT40 ; blur + `aria-describedby` + hint | IT40 / **IT41** |
| E-FILES-01 | PJ ne partent pas avec le premier mail | Fait | IT40 |
| E-RAIL-01 | Chevauchement mobile | Fait | IT40 |
| E-TECH-01 / E-STAT-01 | Jargon LiveAvatar / OpenAI / marin | Fait : badge « Claire en direct » | IT40 |
| E-COPY-01 | Bouton final clair | Fait : « … à InfoServ2A » | IT40 |
| Micro ≠ saisie | Envoi clavier qui « presse » le micro | Fait : `aria-pressed` = listening | IT40 |
| E-CSP-01 | Insights bloqué | Fait | IT40 |
| E-CLS-01 | 10 phrases métier corses, pas de mauvais onglet | Fait : classifieur + tests | **IT41** |
| E-OFF-01 | Recette de la civelle : une phrase, pas de catalogue | Fait : offtopic + consigne « pas de catalogue » | **IT41** |
| E-CTX-01 | CONTEXTE devis 6 cases sur `/devis` guidé | Fait : desktop + bandeau mobile | **IT41** |
| E-NAV-LIVE-01 | Clic Contact pendant phrase caméras | Code : verrou 3 s + fin de phrase, voix non coupée. Recette humaine : Didier | **IT41** (code) |
| E-WWW-01 / E-APEX-01 | 301 apex → www **ou** Custom Domain | Code 301 porté (hostname exact `infoserv2a.pro`). DNS B4 : Didier | **IT41** (code) / **Didier** (DNS) |
| E-LIVE-01 | Session vocale ≥ 60 s | Hors scope agent | **Didier** |
| E-SEND-01 | « C’est bon » → vrai mail | Hors scope (pas d’envoi réel) | **Didier** |
| Claire fermée par défaut | PDF : bouton flottant, site d’abord | **Hors scope** — Didier a validé la devanture | — |
| Nouveau modèle / prompt géant | Routeur d’intention / LLM | **Hors scope** | — |
| Autofill PII / RGPD / ISO / annuaires | PDF « ajoute hors preview » | **Hors scope** (sauf 5 lignes de copy) | — |
| www / `custom_domain` | Publier | **Hors scope** | — |

## Ce que le PDF confirme (déjà IT40, conservé)

| Notre ID | Décision preview |
|---|---|
| E-MAIL-SYN-01 | Synthèse écrite, pas le dump oral |
| E-TXT-01 | Champ « Écrire à Claire » sous les deux portes |
| E-PH-01 / E-FILES-01 / E-RAIL-01 / E-TECH-01 / E-STAT-01 / E-COPY-01 / E-CSP-01 | Conservés |

## Ce que le PDF contredit (on ne suit pas)

Le PDF veut **Claire fermée par défaut**. Didier a recetté l’arrivée IT40 : logo + deux portes, **OK, ne plus y toucher**. Pas de bouton flottant seul.

## Trois rails (inchangés)

| Rail | Vérité | IT41 |
|---|---|---|
| Écrit site | Formulaire, nav, hamburger | Erreurs FR sous champ ; CONTEXTE devis visible en guidé |
| Écrit Claire | Composer « Écrire à Claire » | Inchangé (IT40) |
| Oral Claire | Micro LiveAvatar | Accueil unique durci ; offtopic une phrase ; nav Contact non coupée (code) |

## Volontairement dehors

- **www / main** — preview seulement.
- **Apex B4 / DNS** — le Worker sait 301 ; sans Custom Domain apex, GitHub Pages continue de servir `infoserv2a.pro`.
- **Recette orale humaine ≥ 60 s** — E-LIVE-01, micro réel. **Non fait. Ne pas prétendre que c’est fait.**
- **Envoi réel « c’est bon »** — E-SEND-01. **Non exercé.**
- Autofill PII / machine d’état devis / RGPD Claire / ISO / horaires annuaires / focus trap modal / doubles H1.

## Recette preview (sans envoi réel)

`https://cursor-arrivee-devanture-8f54-infoserv2a.infoserv2a.workers.dev/?claire=1`  
Ctrl+Shift+R. Assets `20260906-it41`. Contexte LiveAvatar **Aidant 1.31**.
