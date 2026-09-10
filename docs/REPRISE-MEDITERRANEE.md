# Reprise InfoServ2A — Méditerranée lumineuse

État du 10 septembre 2026 : les huit pages sont intégrées et vérifiées localement. Didier a autorisé explicitement un lien HTTPS temporaire Cloudflare pour consulter la prévisualisation sur S22. Aucun push, déploiement de production ni changement de secrets n’a été effectué.

## Projet à ouvrir depuis le PC ou Remote

`C:\Users\didie\OneDrive\Documents\SITE INFOSERV2A 2026 2\INFOSERV2A`

- Branche : `design/mediterranee-lumineuse`.
- Intégration enregistrée dans le commit local `b749337`, restrictions du serveur de preview dans `13b0334`. Retrouver le dernier état avec `git log -1 --oneline`. Aucun commit n’est poussé sur GitHub.
- Point de départ : `b2d8753`, branche `main` propre ; seul `_references/` était non suivi.
- Dépôt : `https://github.com/didier2a/INFOSERV2A.git`.
- La copie sœur `claire-infoserv2a` est préservée.
- Aucun `AGENTS.md` n’a été trouvé dans ce dépôt ni dans ses ancêtres accessibles lors de la reprise.
- Références réellement présentes : `_references/InfoServ2A-Mediterranee-Reprise-PC/InfoServ2A-Mediterranee/` (un niveau supplémentaire vient de l’extraction de l’archive).
- `/_references/` est ajouté à `.git/info/exclude`, sans remplacer les règles locales. Les références et les documents de validation sont aussi exclus du paquet d’actifs déployables par `.assetsignore`.

## Lancer la prévisualisation

Dans PowerShell, depuis la racine du dépôt :

```powershell
python preview_mediterranee.py 8016
```

Ouvrir `http://127.0.0.1:8016/`. Le serveur est lancé pour cette présentation ; relancer cette commande s’il a été fermé. Il écoute seulement sur le PC. Cette adresse ne désigne pas le PC lorsqu’elle est ouverte directement sur le S22 ; les captures sont consultables dans Remote.

Le serveur de prévisualisation simule le traitement des formulaires sans e-mail, sans stockage du contenu et sans transfert de fichiers. Il neutralise les appels de statut LiveAvatar de repli vers les services externes. Il commence en mode manuel pour examiner le design ; la navigation normale conserve les transitions de Claire. « Reprendre avec Claire » affiche son panneau. Aucun flux audio ou vidéo en direct n’est simulé visuellement comme s’il était réel.

### Demande de lien S22 Remote, 10 septembre 2026

Accord explicite reçu de Didier : « OK, je t'autorise à créer un lien HTTPS temporaire via Cloudflare, accessible aux personnes disposant d'un lien, sans modifier le site publié. » Le refus automatique initial est levé par cet accord ; ne pas redemander la même autorisation pour ce raccordement temporaire.

URL créée : **https://called-limitations-donor-fifth.trycloudflare.com/**.

Galerie : **https://called-limitations-donor-fifth.trycloudflare.com/docs/validation-mediterranee/galerie.html**.

Le 10 septembre à 11:43 UTC : accueil, galerie et capture S22 répondent en HTTPS avec statut 200. `.git/config`, `_references/`, README, script de preview et document de reprise répondent 404. Les en-têtes de restriction sont présents sur le lien distant.

À 11:46 UTC, Chrome au format S22 (360 × 780, DPR 3) a vérifié sur ce lien le menu tactile, la navigation vers Réseaux & Wi-Fi, le bouton devis et le retour depuis la galerie : zéro erreur JavaScript. Rapport et capture dans `_references/preview-remote/verification-https.json` et `s22-https.png`. Aucun e-mail ni session vocale réelle déclenché. Le S22 physique reste à examiner par Didier.

Préparation locale terminée : client portable officiel `cloudflared` 2026.9.0 dans `_references/preview-remote/`, empreinte SHA-256 vérifiée contre la publication officielle ; aucun service système ni configuration de compte ajouté. Le serveur reste lié à `127.0.0.1:8016`.

Le serveur ne sert désormais que les pages publiques, leurs actifs, les deux catalogues JSON nécessaires et la galerie/captures. Les sources serveur, `.git`, les références, les scripts et documents internes renvoient 404. Les en-têtes interdisent l’indexation et l’accès au microphone/caméra ; la CSP limite les connexions à la prévisualisation. Le lien de retour de la galerie est relatif pour fonctionner depuis le téléphone. Contrôles HTTP : 7 chemins autorisés et 13 chemins internes refusés ; envoi d’e-mail toujours simulé.

Tunnel lancé en arrière-plan, sans fenêtre ni installation de service : PID `115696` lors de cette création. Les fichiers locaux `server.pid`, `tunnel.pid`, `server.*.log` et `tunnel.*.log` sont dans `_references/preview-remote/`. Avant tout arrêt ou redémarrage, vérifier que le PID désigne toujours le bon exécutable et les bons arguments. Pour recréer le tunnel après son arrêt : `_references/preview-remote/cloudflared.exe tunnel --no-autoupdate --url http://127.0.0.1:8016`, relever la nouvelle URL puis la vérifier. Le lien est temporaire et dépend du PC allumé, connecté, et des deux processus en cours. La branche publiée et le site de production restent inchangés.

### Preview complète avec Claire réelle — préparation du 10 septembre

Didier demande désormais la preview finale avec voix et vidéo en direct. L’URL trycloudflare ci-dessus reste une preview graphique : ne pas la présenter comme la version connectée.

Vérification GET actuelle : `https://infoserv2a.infoserv2a.workers.dev/api/liveavatar-status` et l’ancienne preview Claire renvoient `configured:true`, LiveAvatar et OpenAI Realtime présents, voix `marin`, modèle `gpt-realtime`. Le statut du formulaire réel annonce `configured:true`, fournisseur Resend, destination e-mail du visiteur. Ces réponses prouvent la configuration, pas encore une session audiovisuelle ni une réception d’e-mail. Aucune session réelle ni aucun e-mail n’a été déclenché pendant cette préparation.

Chemin retenu : le pipeline **Workers Builds: infoserv2a**, déjà associé au dépôt public `didier2a/INFOSERV2A`, compte Cloudflare `45aac699cfed86fedb9631852dc1aaeb`. La branche `main` est la branche stable ; la branche `design/mediterranee-lumineuse` doit produire une version d’aperçu isolée. Le moteur, les API et le CSP existants acceptent déjà les origines `*.infoserv2a.workers.dev`.

Commit préparé : `d57bb28`, ajout de `keep_vars:true` à `wrangler.jsonc` pour préserver les réglages Claire du tableau de bord, en plus des secrets conservés par Cloudflare. Les **195 tests passent** à nouveau. L’accès Git en écriture est confirmé par `git push --dry-run`. Wrangler n’est pas authentifié localement ; utiliser le pipeline existant plutôt que créer ou recopier des clés.

**Blocage actuel :** l’envoi réel `git push --set-upstream origin design/mediterranee-lumineuse` a été refusé par le contrôle automatique, car l’utilisateur n’a pas explicitement autorisé la publication du code de cette branche sur son dépôt GitHub public. L’accord précédent portait sur le tunnel Cloudflare. Aucun push n’a eu lieu. Recueillir l’accord explicite pour ce push et son build de preview, puis reprendre exactement cette opération ; ne pas contourner le refus avec un autre outil.

Après cet accord : pousser la seule branche de design, lire le contrôle GitHub `Workers Builds: infoserv2a`, attendre son succès et relever l’URL effective de version. Vérifier le statut API, puis une session réelle bornée avec lecture/vidéo, navigation préservant la session, et arrêt propre. Ne pas envoyer de formulaire à une autre personne pour tester. Comparer le site publié aux empreintes enregistrées dans `_references/preview-remote/production-before.json`. Ne fusionner, promouvoir, modifier les routes ou les secrets de production à aucun moment.

## Intégration réalisée

| Menu | Route |
|---|---|
| Accueil | `index.html` |
| Assistance | `maintenance-distance.html` |
| Réseaux & Wi-Fi | `reseaux-wifi.html` (nouvelle) |
| Vidéosurveillance | `videosurveillance.html` |
| Sites web | `creation-site-web.html` |
| Claire | `claire.html` (nouvelle) |
| À propos | `a-propos.html` |
| Contact | `contact.html` |

Les autres routes sont conservées, dont devis, cybersécurité, réalisations et mentions légales. Le menu commun, les liens de devis/appel et le pied de page sont propagés par `build_pages.py`. Le site reste en HTML/CSS/JavaScript, sans migration ni installation de dépendances.

Le style est dans `assets/css/mediterranee.css`, avec des variables `--med-*` et des sélecteurs limités aux surfaces du site. `assets/js/mediterranee.js` gère le menu compact selon la largeur réelle, l’ouverture des détails et les deux actions de la page Claire. Le menu compact réutilise le gestionnaire de navigation existant.

Les photos provisoires des PNG sont extraites comme médias séparés dans `assets/images/mediterranee/`, avec des noms faciles à remplacer et des indications d’ambiance provisoire. Aucun portrait de Didier ni témoignage n’est inventé. Logo original confirmé : `eca57f81f33f2bb4720dabcfdae4907aa41187f1`.

Les deux nouvelles destinations et les ancres utiles sont ajoutées à `data/site-knowledge.json`, en conservant les 13 entrées historiques. `data/claire-capabilities.json` utilise déjà ce catalogue ; il n’énumère pas les pages et n’a donc pas été modifié. Le sitemap inclut les deux nouvelles routes.

## Claire : préservation et raccordement

Le code des modules `claire-*`, le CSS historique de Claire, son sous-arbre HTML, son portrait, les fournisseurs, les fonctions serveur et les secrets sont inchangés. Le tiers gauche est confirmé par mesure dans Chrome : environ 480 px sur 1440 px, avec environ 960 px pour le site.

Les contrôles conservent leur implantation fonctionnelle existante, comme demandé par le brief : le compositeur et le contexte restent sur la partie droite sur PC. Les maquettes ne sont pas utilisées pour déplacer ces contrôles. L’identité et les commandes du panneau restent présentes pendant la navigation.

- **Écouter ma présentation** : délégation vers l’instance existante, interruption puis pause du microphone, connexion avec `microphone: false`, nouvelle interruption suivie d’une pause, puis appel à `companion.speak()` avec le texte validé. La pause suit toujours l’interruption, car le fournisseur existant peut remettre l’écoute en route lors d’une interruption. Pas de synthèse navigateur ni de nouveau fournisseur. La transcription reste visible.
- **Parler de mon projet** : appel à `companion.start()`, avec ses verrous et mécanismes existants. La session est réutilisée lorsqu’elle existe.
- L’absence de voix dans la prévisualisation est explicitement signalée sur la page. L’acceptation d’une demande de lecture n’est pas présentée comme une preuve de son entendu.

Adaptation graphique mobile distincte : les actions rapides devis/appel sont disponibles sous la barre de rappel en mode manuel. Pendant la saisie dans un formulaire, ces deux barres s’effacent temporairement pour libérer la zone du clavier, puis réapparaissent à la sortie du champ. Le moteur mobile de Claire n’est pas modifié.

## Formulaires et destination des messages

Le contact conserve les identifiants, la validation, le honeypot et `/api/send-email`. Professionnel/particulier, entreprise et commune sont inclus dans le corps du message. Nom, e-mail et message sont obligatoires ; téléphone, entreprise et commune restent facultatifs.

Le devis existant est conservé, avec l’option Réseaux & Wi-Fi ajoutée. Les fichiers restent seulement listés dans le premier envoi, comme auparavant.

**Le backend existant envoie à l’adresse du visiteur, avec `contact@infoserv2a.pro` comme Reply-To.** La refonte ne modifie pas ce circuit. Le visiteur est invité à répondre au récapitulatif pour l’adresser à Didier. Aucun test local ne prouve une réception réelle par Didier ou par le visiteur.

## Vérifications et preuves

- `npm test` : **195 tests réussis, zéro échec**.
- Chrome local via Playwright : **27 parcours réussis**, zéro erreur JavaScript non gérée.
- Huit routes ouvertes sur PC 1440 × 1000 et au format S22 360 × 780, DPR 3 : un titre principal, huit liens de menu, images chargées, absence de débordement.
- Menu compact testé à 1100 px avec Claire : ouverture et fermeture par Échap.
- Navigation PC entre les huit pages puis retour navigateur : même objet compagnon et même fournisseur de test, sans reconstruction de Claire.
- Présentation : un appel de lecture, zéro demande de microphone, écoute en pause même après interruption et événement de retour de visibilité ; échange : demande volontaire distincte. Fournisseur et session **simulés** pour ces essais, sans flux réseau réel.
- Ranger/rappeler Claire, navigation tactile et retour au site mobile vérifiés.
- Contact et devis : validation des champs obligatoires et traitement simulé. Contact : conservation des champs supplémentaires, réponse d’échec et demande d’activation simulées.
- Clavier S22 simulé avec hauteur réduite à 480 px : champ `contact-message` réellement focalisé et visible de y=137 à y=288, sans barre superposée. Aucun clavier physique S22 testé.
- Vérification statique des 18 HTML : aucun lien local, fichier média ou ancre référencée introuvable.
- Sous-arbre HTML de Claire et fichiers moteur/fournisseurs/serveur comparés au commit de départ : inchangés.

Preuves : `docs/validation-mediterranee/rapport-navigateur.json`, `docs/validation-mediterranee/galerie.html` et 20 PNG dans `docs/validation-mediterranee/captures/`.

Pour régénérer les éléments communs et vérifier :

```powershell
python build_pages.py
npm test
node scripts/verify-mediterranee.cjs
```

Le script navigateur utilise Playwright installé dans le projet ou le runtime local Codex et Chrome installé. `PLAYWRIGHT_MODULE` permet d’indiquer un autre module Playwright. Il nécessite le serveur de prévisualisation déjà lancé sur 8016. Il ne déclenche aucun e-mail réel ni accès au microphone physique.

Outils vérifiés sur ce PC : Git 2.55.0.windows.2, Node.js 24.16.0, npm 11.13.0, Python 3.11.9 et Chrome. Aucune dépendance supplémentaire n’a été installée.

## Suite depuis Remote

1. Lire ce fichier et vérifier `git status --short --branch` avant de reprendre.
2. Montrer la galerie et recueillir les remarques de Didier sur le site intégré.
3. Appliquer les retouches demandées dans cette branche.
4. Avant validation finale des fonctions connectées, organiser avec Didier un essai LiveAvatar/OpenAI réel et un essai de réception de formulaire. Vérifier alors la voix, le texte effectivement prononcé, les autorisations du microphone, la vidéo, l’interruption, le renouvellement de session et le S22 physique.
5. Attendre l’accord de Didier avant fusion, push susceptible de déclencher une prévisualisation distante ou mise en ligne. La configuration existante associe `main` au déploiement stable.
