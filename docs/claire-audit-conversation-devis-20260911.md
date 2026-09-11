# Audit conversationnel de Claire — boucles de devis

**Date :** 11 septembre 2026  
**Révision auditée :** `b2d8753` (`main`, publication IT48)  
**Périmètre :** prompts, personnalité, modes texte et LiveAvatar, routeur d’intentions, outils, formulaire, mémoire, API et audits antérieurs.  
**Méthode :** lecture statique, historique Git, reproductions déterministes Node et suite de tests locale. Aucun appel LiveAvatar, aucun e-mail réel et aucun déploiement.

## 1. Résumé exécutif

La boucle devis est **principalement applicative**, pas seulement générative.

Claire a deux cerveaux qui travaillent en parallèle :

1. OpenAI Realtime répond naturellement à la voix via LiveAvatar ;
2. le navigateur relit la transcription avec des expressions régulières, mémorise les faits et peut parler une seconde fois au nom du site.

Le second cerveau transforme actuellement une conversation métier ordinaire en progression de devis. Une phrase comme « Je veux installer une caméra 4G dans mon commerce » est enregistrée comme besoin + service, puis `shouldAnnounceQuoteTruth()` considère la présence du service suffisante pour déclencher la checklist. Résultat reproduit :

> « Je n’envoie pas le devis. Il manque encore votre nom, votre téléphone, votre e-mail et votre commune. »

Le visiteur n’a pourtant pas demandé de devis.

Les protections ajoutées lors des itérations précédentes réduisent certaines répétitions, mais elles restent temporelles et lexicales : fenêtre de 8 secondes, détection de quelques formulations attribuées à Claire, signature locale du brouillon. Il n’existe pas d’état métier explicite `idle → collecte → prêt → envoi → clos`.

### Causes racines, par priorité

| Priorité | Cause | Gravité | Confiance |
|---|---|---:|---:|
| P0 | Un service ou une coordonnée suffit à annoncer la checklist, sans intention de devis active | Bloquante | Élevée, reproduite |
| P0 | Une simple approbation (« c’est bon ») peut envoyer un dossier complet déduit hors devis, depuis presque toute page | Bloquante | Élevée, reproduite |
| P0 | Une négation telle que « je ne demande pas de nouveau devis » peut ouvrir et préremplir le devis | Bloquante | Élevée, reproduite |
| P0 | Une transcription reçue pendant que l’avatar parle reste exécutable si elle ressemble à une commande « urgente » ; la garde anti-écho ne couvre pas les formulations naturelles | Bloquante | Élevée dans le code, occurrence acoustique à confirmer |
| P0 | L’envoi manuel du formulaire ne clôt probablement pas la mémoire : événement émis sur `document`, écouteur posé sur `window`, événement non remontant par défaut | Forte | Élevée |
| P0 | Le modèle et l’application ne partagent pas réellement la même mémoire après connexion/reconnexion | Forte | Élevée |
| P1 | Pas de machine d’état devis ni d’idempotence serveur ; les gardes sont heuristiques et locales | Forte | Élevée |
| P1 | Le prompt et plusieurs copies proposent spontanément le devis, ce qui renforce le biais commercial | Moyenne | Élevée |
| P1 | Les messages « vers InfoServ2A » contredisent l’API, qui envoie vers l’adresse du visiteur | Forte sur la confiance | Élevée |
| P2 | Les audits et le laboratoire texte donnent une assurance supérieure à leur couverture réelle | Moyenne | Élevée |

## 2. Câblage de bout en bout

### 2.1 Chargement et surfaces

- Toutes les pages publiques chargent `main.js`, la navigation et `claire-companion.js` ; `/devis` charge aussi `devis.js` (`devis.html:649-652`).
- Le DOM Claire est commun aux pages : arrivée, portrait, transcript, saisie, scène guidée, questionnaire et barre de rappel (`partials/header.html:80-224`).
- Un bootstrap inline choisit `arrival`, `guided`, `shared` ou `manual` depuis l’URL et `sessionStorage`, puis met en file les actions reçues avant le module (`partials/header.html:225-308`).
- `ClaireCompanion.init()` charge `site-knowledge.json` et `claire-capabilities.json`, puis assemble surface navigateur, adaptateur et runtime (`assets/js/claire-companion.js:332-368`).

### 2.2 Mode LiveAvatar

1. Le client vérifie `/api/liveavatar-status`, puis installe `InfoServ2ALiveAvatarProvider` (`assets/js/claire-companion.js:1217-1243`).
2. `/api/liveavatar-session` crée un jeton LiveAvatar LITE lié à OpenAI Realtime, au contexte « Aidant 1.31 », au modèle configuré et à la voix `marin` (`functions/api/liveavatar-session.js:87-184`).
3. Le contexte système est généré par `buildClaireContextPrompt()` à partir du catalogue (`assets/js/claire-core.mjs:326-364`).
4. LiveAvatar fournit deux flux distincts :
   - `USER_TRANSCRIPTION` est envoyé au routeur local ;
   - `AVATAR_TRANSCRIPTION` alimente le transcript et le suivi de navigation (`assets/js/claire-liveavatar-provider.js:688-759`, `assets/js/claire-companion.js:1177-1210`).
5. Pour une conversation normale, OpenAI a déjà entendu l’utilisateur et répond directement. En parallèle, le client appelle `submit()`, mémorise le tour et décide s’il faut actionner le site (`assets/js/claire-companion.js:1507-1558`).
6. Pour une action devis, le runtime construit un plan, exécute `prefill_quote` ou `submit_quote`, vérifie la page, puis renvoie un résultat (`assets/js/claire-runtime-v2.mjs:114-326`, `330-419`).
7. Le résultat applicatif est réinjecté par `session.message()` sous la forme `[INFOSERV2A_APP_RESULT]`, ce qui produit une nouvelle parole de l’avatar (`assets/js/claire-liveavatar-provider.js:251-323`).

Il ne s’agit donc pas de « tool calling » natif du modèle. Les outils sont déclarés dans un manifeste, mais le choix est fait par le routeur JavaScript déterministe (`data/claire-capabilities.json:6-122`).

### 2.3 Mode texte

- « Écrire à Claire » ne lance pas un chatbot texte séparé : `ensureTextConversation()` ouvre la même session LiveAvatar avec microphone désactivé (`assets/js/claire-companion.js:805-821`).
- Le texte est enveloppé dans `[INFOSERV2A_USER_TEXT]` puis envoyé avec `session.message()` (`assets/js/claire-liveavatar-provider.js:366-378`).
- Si LiveAvatar est indisponible, le repli local affiche un statut mais ne possède pas de moteur conversationnel équivalent (`assets/js/claire-companion.js:870-888`, `1537-1545`).
- `/claire-lab` est un autre produit : adaptateur simulé, aucune mémoire conversationnelle réelle, aucun modèle et aucun POST réel (`assets/js/claire-lab.js:119-169`, `assets/js/claire-site-adapter.mjs:61-109`). Il valide le planificateur, pas les boucles voix/mémoire.

### 2.4 Mémoire et formulaire

- La mémoire est fusionnée entre `sessionStorage` et `localStorage` et conserve identité, besoin, service, tours, visites, dernier envoi et `quoteEpoch` (`assets/js/claire-session-memory.mjs:86-168`, `269-301`).
- Chaque tour utilisateur substantiel peut devenir `need`; quelques mots-clés déduisent automatiquement `service` (`assets/js/claire-session-memory.mjs:324-378`, `594-653`).
- Le formulaire visible est réhydraté depuis cette mémoire (`assets/js/claire-site-runtime-adapter.mjs:427-449`).
- `submit_quote` ouvre `/devis`, préremplit, valide six champs et poste vers `/api/send-email` (`assets/js/claire-site-runtime-adapter.mjs:563-611`, `295-329`).
- Après succès via Claire, `closeQuoteAfterSuccessfulSend()` mémorise la signature, archive, vide besoin/service/tours, incrémente l’époque et vide les champs métier (`assets/js/claire-companion.js:1388-1418`, `assets/js/claire-session-memory.mjs:710-719`).
- `src/worker.js` ne porte aucune logique conversationnelle : il route les trois API et les assets (`src/worker.js:40-84`).

## 3. Pourquoi la boucle devis se produit

### 3.1 P0 — La checklist démarre sans demande de devis

`rememberTurn()` extrait les faits de chaque phrase. `inferService()` reconnaît caméra, site, données, cyber, etc. Toute phrase non « mince » devient aussi un besoin (`assets/js/claire-session-memory.mjs:324-378`, `594-653`).

Ensuite, `shouldAnnounceQuoteTruth()` renvoie vrai dès qu’un nom, téléphone, e-mail, commune ou service est détecté, sans vérifier une intention devis (`assets/js/claire-session-memory.mjs:765-773`). Cette fonction est appelée après **chaque** tour de chat et même après un hors-sujet (`assets/js/claire-companion.js:1537-1558`).

Reproduction sur la révision auditée :

| Tour | État déterministe obtenu |
|---|---|
| « Je veux installer une caméra 4G dans mon commerce. » | devis implicite ; manque nom, téléphone, e-mail, commune |
| « Je m’appelle Marie Rossi. » | nouvelle récitation ; manque téléphone, e-mail, commune |
| « J’habite à Lecci. » | nouvelle récitation ; manque téléphone, e-mail |
| téléphone | nouvelle récitation ; manque e-mail |
| e-mail | devis « complet », demande de confirmation |

La fenêtre anti-duplication ne s’applique pas : la phrase change à chaque champ (`assets/js/claire-companion.js:1470-1478`).

### 3.2 P0 — Deux réponses concurrentes pour le même tour

Pour le LiveAvatar, le modèle répond naturellement pendant que le navigateur traite la même transcription. Si la phrase contient un service ou une coordonnée, `announceQuoteTruth()` interrompt ensuite la réponse et injecte la checklist (`assets/js/claire-companion.js:1439-1486`).

Le visiteur peut donc entendre :

1. une réponse métier normale du modèle ;
2. immédiatement après, une relance devis produite par l’application.

Ce doublage donne l’impression que Claire « revient toujours au devis », même sans boucle infinie stricte.

### 3.3 P0 — « C’est bon » peut envoyer un devis jamais demandé

`isOralSendConfirm()` classe notamment « c’est bon », « valide », « confirme » et « vas-y » comme confirmations globales (`assets/js/claire-core.mjs:182-194`). `resolveSendClassification()` les transforme en `submit_quote` dès que les six champs déduits sont complets, même hors page devis (`assets/js/claire-runtime-v2.mjs:90-112`).

Avec une mémoire complète construite depuis une conversation caméra ordinaire, la reproduction donne :

| Page active | « C’est bon » exécute |
|---|---|
| accueil | `submit_quote` |
| vidéosurveillance | `submit_quote` |
| devis | `submit_quote` |
| contact | `compose_email` |

Il n’existe aucun verrou « une demande de devis est actuellement en attente de confirmation ». Une approbation conversationnelle banale peut donc provoquer un envoi réel.

### 3.4 P0 — La garde anti-écho laisse passer les formulations naturelles

Quand `USER_TRANSCRIPTION` arrive pendant que l’avatar parle, le code ignore normalement l’écho. Exception : une commande urgente non reconnue comme « phrase de Claire » est acceptée et interrompt l’avatar (`assets/js/claire-liveavatar-provider.js:711-733`).

La garde `isClaireQuotePrompt()` est une liste d’expressions, tandis que `isSubmitQuoteAction()` est plus large (`assets/js/claire-core.mjs:154-205`). Les phrases suivantes ont été reproduites comme `submit=true`, `guard=false` :

- « Souhaitez-vous que j’envoie le devis ? »
- « Voulez-vous que j’envoie la demande de devis ? »
- « Dites-moi si vous voulez que j’envoie le devis. »
- « Confirmez-vous l’envoi du devis ? »
- « On peut transmettre la demande de devis maintenant. »

Si le micro ou le connecteur réentend une de ces phrases de Claire comme parole utilisateur, elle devient une vraie commande. Une denylist linguistique ne peut pas fiabiliser l’origine d’un événement audio.

### 3.5 P0 — La mémoire « envoyée » n’est pas réellement partagée au modèle

Le prompt dit à Claire d’utiliser `[INFOSERV2A_SESSION_MEMORY]`, mais le provider garde briefing, contexte de page et mémoire non-live dans `lastLocalContext` seulement ; il ne les envoie pas à OpenAI (`assets/js/claire-liveavatar-provider.js:239-249`, `340-363`).

Au démarrage et à la reconnexion, le premier envoi de mémoire est précisément forcé en mode silencieux/local (`assets/js/claire-companion.js:848-856`, `983-1008`, `1153-1158`).

Conséquence :

- l’application peut savoir que le devis est clos ;
- la nouvelle session Realtime peut ne pas le savoir ;
- le modèle peut à nouveau proposer ou demander le devis ;
- le routeur local essaie ensuite de corriger oralement.

Le système dépend donc d’une mémoire annoncée dans le prompt, mais absente du contexte effectif dans plusieurs chemins.

### 3.6 P0 — L’envoi manuel ne clôt pas la mémoire comme prévu

Les formulaires émettent `document.dispatchEvent(new CustomEvent("infoserv:email-sent", ...))` (`assets/js/devis.js:163-176`, `assets/js/contact.js:81-91`).

Claire écoute cet événement sur `globalThis`, donc `window` (`assets/js/claire-companion.js:548-552`). Un `CustomEvent` ne remonte pas par défaut (`bubbles: false`). L’écouteur ne reçoit donc pas cet événement émis sur `document`.

Après un envoi manuel réussi :

- le formulaire est remis à zéro ;
- `beginNewQuoteAfterSend()` n’est vraisemblablement pas appelé ;
- le vieux besoin reste dans `localStorage`/`sessionStorage` ;
- une navigation ou réhydratation peut le remettre dans le formulaire et dans la conversation.

L’audit IT34 considérait ce chemin corrigé, mais la différence de cible d’événement invalide l’intention du patch.

### 3.7 P1 — Il n’existe pas de machine d’état métier devis

Le contrôleur connaît seulement `ready/interpreting/planning/executing/verifying/complete/error/manual` (`assets/js/claire-runtime-v2.mjs:22-42`). La mémoire n’a pas de statut devis ; `quoteEpoch` ne sert qu’à départager l’ancien et le nouveau besoin après succès (`assets/js/claire-session-memory.mjs:86-102`, `230-253`).

Il manque au minimum :

```text
idle → collecting → ready_for_confirmation → submitting → sent
                                      ↘ failed
```

Aujourd’hui, ces états sont inférés à répétition depuis les champs. `lastQuoteAnnounceAt` et `lastSiteTruthSpeech` vivent seulement dans l’instance JS et expirent au rechargement. La protection principale dure 8 secondes (`assets/js/claire-companion.js:1470-1478`).

### 3.8 P1 — Le langage système pousse spontanément vers le devis

Le prompt cite le devis comme réponse métier pour restaurant et panne PC (`assets/js/claire-core.mjs:337`), le briefing l’énumère parmi les actions (`assets/js/claire-core.mjs:311`) et le hors-sujet se termine par « un ordinateur, un site, une caméra ou un devis ? » (`assets/js/claire-core.mjs:324`).

Le catalogue et les suggestions répètent aussi cette entrée (`data/site-knowledge.json:13-18`, `27`, `132-138`).

Il n’existe pas de règle symétrique forte :

> Ne propose pas un devis tant que le visiteur n’a pas exprimé l’intention d’en demander un.

Les règles actuelles disent surtout comment ne pas envoyer trop tôt, pas comment ne pas **entrer** trop tôt dans le funnel. Le routeur lexical ne traite pas non plus la négation : « Je ne demande pas de nouveau devis » donne `isQuoteAction=true`, ouvre la page devis et exécute `prefill_quote` (`assets/js/claire-core.mjs:148-153`, `715-742`). C’est particulièrement nocif dans une boucle : demander à Claire d’arrêter peut relancer le funnel.

### 3.9 P1 — Destination et discours se contredisent

Le routeur dit « Je transmets la demande de devis vers InfoServ2A » (`assets/js/claire-core.mjs:30-36`) et le runtime répète cette destination (`assets/js/claire-runtime-v2.mjs:76-80`, `246-264`).

Mais le prompt actuel dit que l’envoi va vers l’e-mail du visiteur, pas vers `contact@infoserv2a.pro` (`assets/js/claire-core.mjs:361`), et l’API fixe bien `inbox` à l’adresse saisie (`functions/api/send-email.js:134-180`, `360-405`).

Si « demande de devis » signifie prise de contact avec InfoServ2A, ce flux n’achemine pas la demande à l’entreprise. Même si la copie au visiteur est volontaire, le libellé « vers InfoServ2A » est factuellement faux. Un visiteur qui ne reçoit pas le résultat attendu peut recommencer, ce qui ressemble à une boucle.

### 3.10 P1 — Pas d’idempotence bout en bout

L’API valide puis envoie chaque POST accepté, sans clé de requête ni signature de brouillon (`functions/api/send-email.js:360-416`). L’anti-doublon existe seulement dans le navigateur et dépend de `lastSend`.

Un timeout après remise effective, une reconnexion, un stockage bloqué ou un second appareil peut donc provoquer un doublon. Le runtime vérifie surtout que la page attendue est active, pas qu’un identifiant d’envoi est unique (`assets/js/claire-site-runtime-adapter.mjs:737-751`).

### 3.11 P2 — Provisionnement du prompt et couverture de test

`ensureClaireContext()` réutilise tout contexte portant le même nom sans comparer ni mettre à jour son prompt (`functions/api/liveavatar-session.js:87-113`). Une modification future du prompt oubliant d’incrémenter `CONTEXT_NAME` ne sera pas appliquée aux sessions.

Les 195 tests passent, mais ils consacrent certains comportements risqués :

- une coordonnée doit déclencher `shouldAnnounceQuoteTruth()` (`tests/claire-session-memory.test.mjs:185-193`) ;
- les simulations vérifient l’envoi sur commande explicite, pas l’absence de funnel lors d’une conversation métier ;
- le laboratoire simule `sent: true` et ne couvre ni écho acoustique, ni reconnexion, ni événement manuel.

## 4. Ce que les audits antérieurs avaient déjà vu

### Audit ergonomique du 2 septembre

`docs/claire-audit-ergonomie-cybernetique.md` traitait surtout l’oscillation de navigation, le clic utilisateur et la voix. Il ne validait pas la voix réelle. Ses exigences de stabilité ont conduit à une garde de navigation, mais pas à une machine d’état devis.

### Audit IT34 du 4 septembre

`docs/claire-audit-ux-preview-it34.md` décrit exactement la cible « dire le besoin → remplir → c’est bon → nouveau besoin » et affirme que le chemin code casse la boucle (`:15-29`, `:129-137`). Il précise toutefois que :

- l’envoi oral bout en bout n’a pas été exercé ;
- la mémoire après envoi n’a pas été recettée oralement ;
- la voix LiveAvatar était instable (`:34-55`, `:233-239`).

L’audit documente aussi une destination `contact@`, devenue obsolète par rapport au code actuel (`:58`, `:197-205`).

### Audit externe et IT41

`docs/audit-externe-20260906-preview.md` classe l’envoi réel et la session vocale humaine hors périmètre (`:29-33`, `:60-68`). Il affirme le contexte devis « fait », mais sans contre-test de non-déclenchement.

### Audits IT42/IT43

`docs/audit-preview-it42-scene-magasin.md` et `docs/audit-preview-it43-scene-magasin.md` portent surtout sur la scène mobile. IT42 repère néanmoins :

- la persistance `sessionStorage + localStorage` ;
- la contradiction autour de « Je reprends » ;
- l’absence de recette micro humaine et d’envoi réel.

IT43 corrige le rythme visuel, pas le protocole conversationnel.

### Conclusion historique

Les itérations précédentes ont traité quatre symptômes réels :

1. écho de la phrase de confirmation ;
2. formulaire prérempli ignoré ;
3. même brouillon renvoyé ;
4. ancien besoin conservé après succès.

Elles n’ont pas supprimé la cause amont : **l’entrée automatique dans le devis à partir de faits métier ordinaires**, sans état d’intention explicite.

## 5. Recommandations concrètes

### P0.1 — Donner au devis un état explicite et une intention verrouillée

Ajouter à la mémoire :

```js
quote: {
  status: "idle", // idle|collecting|ready|submitting|sent|failed
  epoch: 0,
  draftId: "",
  requested: false,
  lastAnnouncedSignature: "",
  sendId: ""
}
```

Règles :

- seul un acte explicite (« je veux un devis », bouton devis, ouverture volontaire du formulaire) passe `requested=true`;
- une négation (« pas de devis », « ne demande pas de devis ») annule ou laisse `requested=false` et ne peut jamais ouvrir le formulaire ;
- mentionner caméra/site ou donner son nom ne démarre jamais un devis ;
- `shouldAnnounceQuoteTruth()` exige `requested=true` et un statut `collecting|ready`;
- annoncer au plus une fois le même état/signature, de façon persistante ;
- après `sent`, aucun nouveau devis sans nouvelle intention explicite.

### P0.2 — Séparer l’origine audio de l’intention

- Ne jamais exécuter une **action à effet de bord** depuis une `USER_TRANSCRIPTION` reçue pendant `avatarSpeaking`.
- Un `USER_SPEAK_STARTED` pendant la parole peut rester un barge-in et couper Claire, mais la confirmation devis doit être rattachée à un tour humain identifié après cette coupure — sinon demander de répéter.
- Armer l’écoute des commandes après un vrai cycle utilisateur, avec un identifiant de tour distinct de la génération de parole avatar.
- Attacher un numéro de génération de parole et rejeter toute transcription de la génération avatar.
- Garder les regex comme aide de classification, pas comme preuve d’origine humaine.

Cette correction rend `isClaireQuotePrompt()` non critique ; continuer à élargir sa liste ne sera jamais exhaustif.

### P0.3 — Une seule autorité pour la conversation devis

Choisir l’un des deux modèles :

1. **recommandé :** l’application possède tout le protocole devis ; OpenAI répond au métier mais ne demande ni confirmation ni champs de devis ;
2. ou fournir au modèle un outil natif structuré et supprimer le routeur parallèle.

Dans le modèle recommandé, le site émet les questions de collecte et la confirmation. OpenAI ne reformule pas ces messages. Cela supprime le doublage « réponse naturelle + checklist ».

### P0.4 — Réparer et tester la clôture de l’envoi manuel

- Écouter `infoserv:email-sent` sur `document`, ou émettre l’événement sur `window`.
- Garantir une seule clôture avec un `sendId`, pas seulement un booléen réentrant synchrone.
- Ajouter un test navigateur : clic manuel → mémoire `need/service` vide → identité conservée → reload → ancien besoin absent.

### P0.5 — Trancher la destination métier

Décider explicitement :

- demande envoyée à InfoServ2A avec accusé/copie au visiteur ;
- ou simple récapitulatif envoyé au visiteur.

Puis aligner prompt, copies, runtime, API et tests. Le mot « transmis à InfoServ2A » ne doit rester que si InfoServ2A reçoit effectivement la demande.

### P1.1 — Ajouter une idempotence serveur

- Générer `draftId/sendId` côté client.
- Envoyer une clé d’idempotence à `/api/send-email`.
- Refuser ou retourner le résultat précédent pour la même clé/signature pendant une durée définie.
- Conserver l’identifiant fournisseur dans le résultat et la mémoire.

### P1.2 — Décommercialiser le prompt par défaut

- Retirer « devis » des réponses de recentrage et des exemples métier automatiques.
- Ajouter : « Tu ne proposes pas de devis tant que la personne n’en demande pas un. Tu réponds d’abord au besoin. »
- Distinguer question informative (« les devis sont-ils gratuits ? ») et intention transactionnelle (« je veux un devis »).
- Ne montrer la checklist que sur intention active ou page devis volontairement ouverte.

### P1.3 — Synchroniser la mémoire ou ne pas la promettre

Si LiveAvatar ne permet pas une mise à jour de contexte réellement silencieuse :

- ne pas prétendre dans le prompt que `[INFOSERV2A_SESSION_MEMORY]` est reçu ;
- laisser l’application bloquer toute relance devis ;
- injecter seulement un résumé minimal lorsque c’est nécessaire, avec un canal dont l’absence de parole est garantie.

Ajouter un test de reconnexion après `sent`.

### P1.4 — Versionner le contexte par contenu

Calculer une empreinte du prompt ou stocker une version explicite :

- si l’empreinte diffère, créer/mettre à jour le contexte ;
- journaliser l’identifiant + version réellement utilisés ;
- exposer cette version dans `/api/liveavatar-status` pour la recette preview.

### P2 — Rendre les tests représentatifs

Ajouter :

1. conversation caméra sans mot « devis » → aucune checklist ;
2. nom/commune donnés hors devis → aucune checklist ;
3. mémoire complète hors devis + « c’est bon » → aucun envoi ;
4. « je ne demande pas de nouveau devis » → aucune ouverture, aucune checklist ;
5. cinq formulations de Claire contenant « envoyer le devis » → zéro commande ;
6. reconnexion après succès → aucune relance ;
7. envoi manuel puis reload → ancien besoin absent ;
8. double confirmation / timeout → un seul envoi ;
9. test E2E avec vraie cible d’événement DOM ;
10. laboratoire avec scénario mémoire et résultat non simulé.

## 6. Script de recette Didier sur preview

Préconditions :

- preview de la branche corrective, jamais `infoserv2a.pro` ;
- fenêtre privée ou suppression de `infoserv2a.claire.*` dans **sessionStorage et localStorage** ;
- filtre Réseau sur `/api/send-email` pour compter les POST ;
- adresse de test contrôlée.

### Conversation en cinq tours

| Tour | Didier dit | Résultat attendu |
|---:|---|---|
| 1 | « J’ai une caméra 4G dans mon commerce et je voudrais comprendre les possibilités d’enregistrement. » | Réponse métier. Éventuellement onglet Vidéosurveillance. **Aucun** mot de collecte, aucune checklist, aucun formulaire devis imposé. |
| 2 | « Je m’appelle Didier et je suis à Porto-Vecchio. » | Claire utilise le contexte social, mais **ne bascule toujours pas** en devis. |
| 3 | « D’accord, maintenant je veux un devis pour cette installation. Mon téléphone est le 06 12 34 56 78 et mon e-mail didier-test@example.com. » | Entrée unique dans `collecting`, préremplissage, une seule annonce des champs réellement manquants ou état prêt. Aucun envoi. |
| 4 | « C’est bon, envoie la demande. » | **Un seul** POST. Une seule confirmation fondée sur le résultat du site. Aucun « confirmez encore ». Destination annoncée conforme à la décision métier. |
| 5 | « Merci. Pour mon site web, explique-moi seulement l’hébergement ; je ne demande pas de nouveau devis. » | Réponse hébergement. L’ancien devis caméra ne revient pas, aucun second POST, aucune checklist. |

### Contre-test manuel

Sur la même preview, refaire un brouillon puis cliquer le bouton HTML d’envoi :

1. vérifier le succès ;
2. recharger la page ;
3. vérifier que l’identité reste mais que service et besoin sont vides ;
4. vérifier que Claire ne redemande aucune confirmation.

### Critères de réussite

- zéro checklist aux tours 1 et 2 ;
- une seule entrée dans le funnel au tour 3 ;
- exactement un POST et une confirmation au tour 4 ;
- zéro retour de l’ancien devis au tour 5 et après reload ;
- aucune phrase de Claire réentendue comme commande.

## 7. Verdict

Les correctifs historiques ont réduit les boucles après confirmation, mais le système reste conçu pour **déduire un devis à partir de la conversation**. C’est l’inverse du contrat souhaitable : le devis doit être un état explicite ouvert par le visiteur.

Le premier correctif à faire n’est donc pas d’ajouter une nouvelle phrase au prompt. Il faut fermer la porte applicative :

> sans intention devis active, aucun fait métier ni aucune coordonnée ne peut déclencher `announceQuoteTruth`, `prefill_quote` ou `submit_quote`.

Ensuite seulement, il faut sécuriser l’origine audio, la clôture manuelle, la mémoire de reconnexion et l’idempotence.

## 8. Vérifications réalisées

- Reproduction déterministe des cinq annonces successives de checklist : confirmée.
- Reproduction de « c’est bon » envoyant hors page devis : confirmée sur accueil, vidéosurveillance et devis ; contact bascule vers l’envoi contact.
- Reproduction de « je ne demande pas de nouveau devis » ouvrant et préremplissant le devis : confirmée.
- Reproduction de cinq formulations d’écho `submit=true / guard=false` : confirmée.
- Suite locale : **195 tests réussis, 0 échec**.
- Aucun appel LiveAvatar, aucun e-mail réel, aucune écriture externe, aucun déploiement.
