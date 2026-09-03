import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  adjacentPage,
  buildClaireContextPrompt,
  buildSiteBriefing,
  claimsUnverifiedEmailSend,
  classifyUtterance,
  isClaireQuotePrompt,
  isOralSendConfirm,
  isSubmitQuoteAction,
  isUrgentSiteCommand,
  CLAIRE_WELCOME,
  createSpeechFollowGate,
  currentPage,
  describePageContext,
  followSpokenNavigation,
  liveAvatarSessionPhase,
  liveAvatarSessionWarningDelayMs,
  LIVEAVATAR_MAX_SESSION_MS,
  LIVEAVATAR_SESSION_WARNING_LEAD_MS,
  mergeSpokenTranscript,
  normalizeText,
  pageHrefForSession,
  routeCommand,
  scorePage
} from "../assets/js/claire-core.mjs";

const knowledge = JSON.parse(
  await readFile(new URL("../data/site-knowledge.json", import.meta.url), "utf8")
);

test("normalise le français sans perdre les termes techniques", () => {
  assert.equal(normalizeText("  Audit NIS 2 — Réseau & IA  "), "audit nis 2 reseau ia");
});

test("référence toutes les pages publiques du site", () => {
  assert.equal(knowledge.pages.length, 13);
  assert.equal(new Set(knowledge.pages.map((page) => page.href)).size, 13);
  assert.ok(knowledge.pages.every((page) => page.title && page.summary && page.keywords.length));
});

test("trouve la vidéosurveillance sans fibre", () => {
  const result = routeCommand("Je cherche une caméra sans fibre", knowledge);
  assert.equal(result.type, "suggest");
  assert.equal(result.page.id, "videosurveillance");
});

test("une phrase parlée sans internet n’ouvre pas la page site web", () => {
  const result = routeCommand("Je n’ai pas internet, je veux une caméra", knowledge);
  assert.equal(result.page.id, "videosurveillance");
  assert.equal(result.anchor?.id, "solutions-sans-fibre");
});

test("un site internet pour un commerce n’ouvre pas la vidéosurveillance", () => {
  const result = routeCommand("Je veux créer un site internet pour mon commerce.", knowledge);
  assert.equal(result.page.id, "web");
});

test("fusionne les sous-titres cumulatifs et les morceaux incrémentaux", () => {
  assert.equal(mergeSpokenTranscript("Voici", "Voici la page"), "Voici la page");
  assert.equal(mergeSpokenTranscript("Voici la page", "affichée"), "Voici la page affichée");
});

test("ouvre l’offre d’hébergement sur une commande explicite", () => {
  const result = routeCommand("Ouvre l’hébergement et la maintenance du site", knowledge);
  assert.equal(result.type, "navigate");
  assert.equal(result.page.id, "web");
  assert.equal(result.href, "creation-site-web.html#offre-hebergement");
});

test("ouvre directement l’audit NIS 2 sur une commande explicite", () => {
  const result = routeCommand("Ouvre l’audit NIS 2", knowledge);
  assert.equal(result.type, "navigate");
  assert.equal(result.page.id, "cybersecurity");
  assert.equal(result.href, "cybersecurite-ia.html#audit-nis2");
});

test("route un disque inaccessible vers la récupération de données", () => {
  const result = routeCommand("Mon disque dur est inaccessible", knowledge);
  assert.equal(result.page.id, "data-recovery");
});

test("ne déclenche pas automatiquement un appel", () => {
  const result = routeCommand("Appeler InfoServ2A", knowledge);
  assert.equal(result.type, "action");
  assert.equal(result.action, "call");
  assert.match(result.href, /^tel:/);
});

test("un téléphone en panne reste une conversation, pas un appel", () => {
  assert.equal(classifyUtterance("Mon téléphone ne marche plus", knowledge).kind, "chat");
  assert.notEqual(routeCommand("Mon téléphone ne marche plus", knowledge).action, "call");
});

test("une phrase de Claire qui invente l’envoi est détectée", () => {
  assert.equal(claimsUnverifiedEmailSend("C’est validé, c’est envoyé."), true);
  assert.equal(claimsUnverifiedEmailSend("Je n’ai pas envoyé. Il manque votre e-mail."), false);
});

test("envoie le devis, un appel ou un mail sont des actions orales", () => {
  assert.equal(routeCommand("Envoie le devis", knowledge).action, "submit_quote");
  assert.equal(routeCommand("Appelle InfoServ2A", knowledge).action, "call");
  assert.equal(routeCommand("Envoie un mail", knowledge).action, "email");
  assert.equal(classifyUtterance("Je voudrais un devis gratuit", knowledge).kind, "site");
});

test("une confirmation orale courte envoie si le formulaire est complet", () => {
  assert.equal(isOralSendConfirm("c’est bon"), true);
  assert.equal(isOralSendConfirm("confirme"), true);
  assert.equal(isUrgentSiteCommand("envoie le devis"), true);
  assert.equal(isOralSendConfirm("bonjour Claire"), false);
  assert.equal(isUrgentSiteCommand("bonjour comment ça va"), false);
});

test("la phrase de Claire sur le devis ne relance pas l’envoi", () => {
  const speech = "Le devis est complet : votre nom. Dites « envoie le devis » pour que je le transmette vers contact@infoserv2a.pro. Rien n’est parti tant que le site n’a pas confirmé l’envoi.";
  assert.equal(isClaireQuotePrompt(speech), true);
  assert.equal(isSubmitQuoteAction(speech), false);
  assert.notEqual(routeCommand(speech, knowledge).action, "submit_quote");
  assert.equal(classifyUtterance(speech, knowledge).kind, "chat");
});

test("restitue immédiatement la navigation manuelle", () => {
  const result = routeCommand("Je préfère le mode manuel", knowledge);
  assert.equal(result.type, "manual");
});

test("explique la page courante", () => {
  const result = routeCommand("Explique cette page", knowledge, { pathname: "/creation-site-web.html" });
  assert.equal(result.type, "answer");
  assert.equal(result.page.id, "web");
});

test("identifie l’accueil avec les deux formes d’URL", () => {
  assert.equal(currentPage(knowledge, "/")?.id, "home");
  assert.equal(currentPage(knowledge, "/index.html")?.id, "home");
});

test("conserve Claire pendant une navigation interne", () => {
  assert.equal(
    pageHrefForSession("cybersecurite-ia.html#audit-nis2", "shared"),
    "cybersecurite-ia.html?claire=continue#audit-nis2"
  );
});

test("conserve la grande scène Claire en navigation guidée", () => {
  assert.equal(
    pageHrefForSession("videosurveillance.html#solutions", "guided"),
    "videosurveillance.html?claire=guided#solutions"
  );
});

test("privilégie un titre et ses mots-clés", () => {
  const web = knowledge.pages.find((page) => page.id === "web");
  const legal = knowledge.pages.find((page) => page.id === "legal");
  assert.ok(scorePage("refonte site web", web) > scorePage("refonte site web", legal));
});

test("une salutations ou un sujet professionnel reste une conversation naturelle", () => {
  assert.equal(classifyUtterance("Bonjour Claire, comment ça va ?", knowledge).kind, "chat");
  assert.equal(classifyUtterance("Mon disque dur n’est plus accessible", knowledge).kind, "chat");
  assert.equal(classifyUtterance("Peux-tu améliorer mon Wi-Fi ?", knowledge).kind, "chat");
  assert.equal(classifyUtterance("Comment un hôpital gère ses dossiers patients ?", knowledge).kind, "chat");
  assert.equal(classifyUtterance("On cherche un logiciel pour le laboratoire", knowledge).kind, "chat");
  assert.equal(classifyUtterance("Je tiens un restaurant à Bonifacio", knowledge).kind, "chat");
  assert.equal(classifyUtterance("Je suis médecin, j’ai un cabinet", knowledge).kind, "chat");
  assert.equal(classifyUtterance("Ok, merci", knowledge).kind, "chat");
});

test("un loisir sans lien IT recentre, sans ouvrir une page", () => {
  assert.equal(classifyUtterance("Raconte-moi une blague", knowledge).kind, "offtopic");
  assert.equal(classifyUtterance("Quelle heure est-il ?", knowledge).kind, "offtopic");
  assert.equal(classifyUtterance("Quelle est la capitale de la France ?", knowledge).kind, "offtopic");
  assert.equal(classifyUtterance("Donne-moi une recette de gâteau", knowledge).kind, "offtopic");
});

test("une demande de service continue de piloter le site", () => {
  assert.equal(classifyUtterance("Je n’ai pas internet, je veux une caméra", knowledge).kind, "site");
  assert.equal(classifyUtterance("Montre-moi la vidéosurveillance sans fibre", knowledge).kind, "site");
  assert.equal(classifyUtterance("Je veux de la vidéosurveillance", knowledge).kind, "site");
  assert.equal(classifyUtterance("Je voudrais un devis gratuit", knowledge).kind, "site");
  assert.equal(classifyUtterance("Onglet suivant", knowledge).kind, "site");
  assert.equal(classifyUtterance("Quels sont les onglets du site ?", knowledge).kind, "site");
});

test("une question sur la page courante partage le contexte sans changer de rubrique", () => {
  const classified = classifyUtterance("Explique cette page", knowledge, { pathname: "/creation-site-web.html" });
  assert.equal(classified.kind, "page");
  assert.equal(classified.route.page.id, "web");
  assert.match(describePageContext({
    page: classified.route.page,
    section: null
  }), /Création de sites web/);
});

test("la parole de Claire synchronise l’onglet et la section visibles", () => {
  const first = followSpokenNavigation(
    "Voici l’onglet Vidéosurveillance et les solutions sans fibre.",
    knowledge,
    { pageId: "home" }
  );
  assert.equal(first.pageId, "videosurveillance");
  assert.equal(first.anchorId, "solutions-sans-fibre");
  const same = followSpokenNavigation(
    "Voici l’onglet Vidéosurveillance et les solutions sans fibre.",
    knowledge,
    { pageId: "videosurveillance", sectionId: "solutions-sans-fibre" }
  );
  assert.equal(same, null);
  assert.equal(followSpokenNavigation("Quelle est la capitale de la France ?", knowledge), null);
  assert.equal(
    followSpokenNavigation("Pour sécuriser votre maison, on peut poser des caméras, y compris en 4G.", knowledge, { pageId: "home" })?.pageId,
    "videosurveillance"
  );
  assert.equal(
    followSpokenNavigation("La maintenance à distance permet d’intervenir sur Windows et Mac.", knowledge, { pageId: "home" })?.pageId,
    "remote-support"
  );
  assert.equal(followSpokenNavigation(
    "Le site compte 13 onglets : Accueil InfoServ2A, Vidéosurveillance, Création de sites web, Cybersécurité et intelligence artificielle.",
    knowledge
  ), null);
});

test("le briefing site contient tous les onglets et le rôle consultante IT", () => {
  const briefing = buildSiteBriefing(knowledge);
  const prompt = buildClaireContextPrompt(knowledge);
  assert.equal(knowledge.pages.length, 13);
  for (const page of knowledge.pages) {
    assert.match(briefing, new RegExp(page.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(briefing, /consultante IT ouverte/);
  assert.match(prompt, /interlocutrice professionnelle/);
  assert.match(prompt, /recentres vers InfoServ2A et l’IT/);
  assert.match(prompt, /pas la recette/);
  assert.doesNotMatch(prompt, /sans ramener systématiquement à l’informatique/);
  assert.doesNotMatch(prompt, /tous les domaines : métiers, sciences, arts/);
  assert.match(prompt, /INFOSERV2A_SITE_BRIEFING/);
  assert.match(prompt, /Une phrase courte au plus/);
  assert.match(prompt, /INFOSERV2A_OFF_TOPIC/);
  assert.match(prompt, /être interrompue/);
  assert.match(CLAIRE_WELCOME, /Moi c’est Claire, votre aidante Live Avatar/);
  assert.match(CLAIRE_WELCOME, /Je vous écoute/);
  assert.doesNotMatch(CLAIRE_WELCOME, /uniquement dans l’informatique/);
  assert.doesNotMatch(CLAIRE_WELCOME, /De quoi avez-vous besoin/);
  assert.match(prompt, /Jamais de phrase du type/);
  assert.equal(adjacentPage(knowledge, "home", 1).id, "videosurveillance");
  assert.equal(adjacentPage(knowledge, knowledge.pages.at(-1).id, 1).id, "home");
});

test("un clic visiteur bloque le suivi de parole jusqu’à la prochaine prise de parole", () => {
  const gate = createSpeechFollowGate();
  assert.equal(gate.allowsFollow(), true);
  gate.claimUserNavigation("https://infoserv2a.test/videosurveillance.html", "videosurveillance#");
  assert.equal(gate.allowsFollow(), false);
  assert.equal(gate.userFollowKey(), "videosurveillance#");
  const epoch = gate.epoch();
  const first = gate.onAvatarSpeakStart();
  assert.equal(first.unlocked, true);
  assert.equal(gate.allowsFollow(), true);
  gate.claimUserNavigation("https://infoserv2a.test/contact.html", "contact#");
  assert.equal(gate.allowsFollow(), false);
  assert.equal(gate.isStale(epoch), true);
  const later = gate.onAvatarSpeakStart();
  assert.equal(later.unlocked, true);
  assert.equal(gate.allowsFollow(), true);
});

test("la session LiveAvatar prévient 45 secondes avant la fin des 5 minutes", () => {
  assert.equal(LIVEAVATAR_MAX_SESSION_MS, 300_000);
  assert.equal(LIVEAVATAR_SESSION_WARNING_LEAD_MS, 45_000);
  assert.equal(liveAvatarSessionWarningDelayMs(), 255_000);
  assert.equal(liveAvatarSessionPhase(0), "active");
  assert.equal(liveAvatarSessionPhase(254_999), "active");
  assert.equal(liveAvatarSessionPhase(255_000), "warning");
  assert.equal(liveAvatarSessionPhase(299_000), "warning");
  assert.equal(liveAvatarSessionPhase(300_000), "ended");
});
