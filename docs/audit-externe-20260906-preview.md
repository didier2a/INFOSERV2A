# Audit externe 6 sept. 2026 → preview #12

**Source :** rapport indépendant *Audit UX & IA | infoserv2a.pro* (28 p., 6 sept. 2026), confronté à `docs/audit-ux-oral-ecrit-www-20260906.md` (PR #9) et aux specs Didier (Claire = devanture).

**Cible :** preview `cursor/arrivee-devanture-8f54` seulement. Pas www, pas `custom_domain`, pas de merge.

## Ce que le PDF confirme

| Notre ID | PDF | Décision preview |
|---|---|---|
| E-MAIL-SYN-01 | Destination / revue / pas de dump oral | **Déjà là** (it38, conservé) |
| E-ARR-01 / E-DUP-01 | Accueil long + répétitif ; un seul rituel | **Affiné** : welcome **ou** écrit, jamais welcome + « Je reprends » |
| E-TXT-01 | Écrire / parler / fermer ; fallback texte | **Fait** : champ « Écrire à Claire » sous les deux portes |
| E-PH-01 / E-REQ-01 | Formulaires, validation, placeholders | **Fait** : `*` + placeholders devis/contact |
| E-FILES-01 | PJ contradictoires | **Fait** : phrase en tête « elles ne partent pas avec le premier mail » |
| E-RAIL-01 | Chevauchement mobile | **Fait** : padding sous la barre « Reprendre » |
| E-TECH-01 / E-STAT-01 | Jargon LiveAvatar / OpenAI / marin | **Fait** : badge public « Claire en direct » ; Prête / J’écoute / Écrivez-moi |
| E-COPY-01 | Bouton final clair | **Fait** : « … à InfoServ2A » |
| E-CSP-01 | (notre audit ; Insights bloqué) | **Fait** : `static.cloudflareinsights.com` autorisé |
| Micro ≠ saisie | Envoi clavier qui « presse » le micro | **Fait** : `aria-pressed` suit `provider.listening` seulement |

## Ce que le PDF contredit (on ne suit pas)

Le PDF veut **Claire fermée par défaut** (bouton flottant, site d’abord). Les specs validées disent l’inverse : enseigne + devanture, **envie de parler**, portes inégales (Parler / Voir le site d’abord). L’arrivée marketing reste.

Le PDF pousse un **nouveau prompt / routeur d’intention / modèle de données lead**. Hors scope : pas de nouveau modèle LLM, pas de refonte du classifieur dans cette preview.

## Déjà là avant cette itération (it38–it39)

- Synthèse mail écrite (plus de dialogue oral).
- Logo InfoServ2A + deux portes.
- `skipLiveResumeCue` (plus de double accueil vocal).
- Micro seulement si on choisit de parler.
- Honeypot « Site web » déjà `sr-only` (renforcé).

## Volontairement dehors

- **www / main** — preview seulement.
- **Apex B4 / DNS** — rail 301 = PR #11, pas mélangé ici.
- **Recette orale humaine ≥ 60 s** — E-LIVE-01, micro réel.
- Autofill PII / machine d’état devis / RGPD Claire / ISO / horaires annuaires / focus trap modal / doubles H1 — backlog, pas cette preview.

## Recette preview (sans envoi réel)

`https://cursor-arrivee-devanture-8f54-infoserv2a.infoserv2a.workers.dev/?claire=1`  
Ctrl+Shift+R. Assets `20260906-it40`. Contexte LiveAvatar **Aidant 1.30** (inchangé).
