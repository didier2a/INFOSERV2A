# IT43 — scène mobile nominale (hors `presence=speaking`)

**Date :** 6 septembre 2026  
**Branche :** `cursor/arrivee-devanture-8f54` (PR #12, preview only)  
**Assets :** `20260906-it43`  
**Autorité :** cahier Didier + 5 écarts P0 de `docs/audit-preview-it42-scene-magasin.md` (score 55).

Audit IT42 : le plein cadre n’existait que si LiveAvatar envoyait `speaking`/`sound`. Après « Parler », presence = `listening`/`ready` → bandeau 274 px. Recodage : état explicite de scène.

## Contrat

| Surface | Comportement |
|---|---|
| PC ≥821 px | Split fixe 1/3 + 2/3. Pas d’alternance. Composer / prompt dans les 2/3. `padding-bottom: 8.5rem` retiré. |
| Mobile &lt;821 px dès « Parler à Claire » | `data-mobile-scene=on` → Claire 9:16 plein cadre (connecting / listening / ready / speaking / mode local). |
| Zap (tap scène ou « Voir le site ») | `off` → magasin + **liseré 16 px**. Pas 220 px de visage. |
| Frappe (composer ou champ site) | Magasin tout de suite + interrupt. Le composer reste visible (dock bas), pas `display:none` sur la scène. |
| Parole réelle | `speak-start` → on ; fin + 1 s → off. Si LiveAvatar ne parle jamais : **rester on jusqu’au zap**. |
| Arrivée | Inchangée (logo, « Claire vous ouvre la boutique », portes Parler / Voir le site d’abord). |

Pilotage : `reduceMobileScene()` dans `assets/js/claire-mobile-scene.mjs`. CSS accroché à `[data-mobile-scene=on|off]` / `body.claire-mobile-scene`, **pas** seulement à `data-presence=speaking`.

## Vs le 55/100

| # | Écart IT42 | IT43 |
|---|---|---|
| D | Plein cadre seulement si `speaking` forcé | Plein cadre dès `start()` / Parler |
| E | Tap = zap seulement en speaking | Tap scène + bouton « Voir le site » |
| F | Composer `display:none` pendant 9:16 | Champ discret en bas pendant la scène |
| G | 2× Ranger, 2× « Claire en direct », chip | Cachés en guidé (un Ranger header, un badge texte) |
| I | Magasin = 274 px visage+composer | Liseré 16 px + dock d’écriture en bas |

Hors ce patch : mémoire session / « Je reprends », recette micro humaine, custom_domain, merge www, envoi mail.
