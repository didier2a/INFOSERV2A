import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CATALOG_TOOL_NAMES,
  buildClaireContextPrompt,
  buildSiteBriefing,
  classifyUtterance,
  describePageContext
} from "../assets/js/claire-core.mjs";
import { planCommand } from "../assets/js/claire-runtime-v2.mjs";

const knowledge = JSON.parse(
  await readFile(new URL("../data/site-knowledge.json", import.meta.url), "utf8")
);
const manifest = JSON.parse(
  await readFile(new URL("../data/claire-capabilities.json", import.meta.url), "utf8")
);
const sessionSource = await readFile(
  new URL("../functions/api/liveavatar-session.js", import.meta.url),
  "utf8"
);
const providerSource = await readFile(
  new URL("../assets/js/claire-liveavatar-provider.js", import.meta.url),
  "utf8"
);
const companionSource = await readFile(
  new URL("../assets/js/claire-companion.js", import.meta.url),
  "utf8"
);

test("audit : Claire est une consultante IT ouverte, pas une IA de salon", () => {
  const prompt = buildClaireContextPrompt(knowledge);
  assert.match(prompt, /interlocutrice professionnelle/);
  assert.match(prompt, /recentres vers InfoServ2A et l’IT/);
  assert.match(prompt, /être interrompue/);
  assert.match(prompt, /experte humaine/);
  assert.match(prompt, /pas la recette/);
  assert.doesNotMatch(prompt, /refuses TOUT sujet hors informatique/);
  assert.doesNotMatch(prompt, /sans ramener systématiquement à l’informatique/);
  assert.equal(classifyUtterance("Bonjour", knowledge).kind, "chat");
  assert.equal(classifyUtterance("Comment un laboratoire archive ses analyses ?", knowledge).kind, "chat");
  assert.equal(classifyUtterance("Je tiens un restaurant à Bonifacio", knowledge).kind, "chat");
  assert.equal(classifyUtterance("Quelle est la capitale de l’Italie ?", knowledge).kind, "offtopic");
  assert.equal(planCommand("Raconte-moi une blague", knowledge, manifest).mode, "offtopic");
  assert.equal(planCommand("Mon disque dur n’est plus accessible", knowledge, manifest).mode, "chat");
  assert.match(providerSource, /let kind = "chat"/);
  assert.match(providerSource, /sendOffTopic/);
  assert.match(providerSource, /INFOSERV2A_OFF_TOPIC/);
  assert.match(sessionSource, /InfoServ2A Claire Aidant 1\.26/);
  assert.match(prompt, /jamais « c’est parti »/);
  assert.match(prompt, /sans attendre qu’on te pose une question/);
  assert.match(providerSource, /sans attendre qu’on te le demande/);
  assert.match(companionSource, /updateLiveCaption/);
  assert.match(prompt, /changement de page ou de section à droite/);
  assert.match(providerSource, /liveInjected: false/);
});

test("audit : le catalogue site est injecté et chaque onglet est connu", () => {
  const briefing = buildSiteBriefing(knowledge);
  assert.equal(knowledge.pages.length, 13);
  for (const page of knowledge.pages) {
    assert.match(briefing, new RegExp(page.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(briefing, /07 45 15 60 76/);
  assert.match(companionSource, /sendBriefing/);
  assert.match(providerSource, /INFOSERV2A_SITE_BRIEFING/);
  assert.match(describePageContext({ page: knowledge.pages[2], section: knowledge.pages[2].anchors[0] }), /Création de sites web/);
});

test("audit : le catalogue d’actions couvre la navigation onglet par onglet", () => {
  assert.deepEqual(manifest.tools.map((tool) => tool.name), [...CATALOG_TOOL_NAMES]);
  assert.equal(planCommand("Quels sont les onglets du site ?", knowledge, manifest).steps[0].tool, "list_catalog");
  assert.equal(planCommand("Onglet suivant", knowledge, manifest, { pageId: "home" }).steps[0].tool, "next_page");
  assert.equal(planCommand("Onglet précédent", knowledge, manifest, { pageId: "web" }).steps[0].tool, "prev_page");
  assert.equal(planCommand("Retour à l’accueil", knowledge, manifest).steps[0].tool, "go_home");
  assert.equal(
    planCommand("Section suivante", knowledge, manifest, { pageId: "videosurveillance" }).steps[0].tool,
    "next_section"
  );
  assert.equal(planCommand("Explique cette page", knowledge, manifest, { pathname: "/contact.html" }).mode, "page");
});

test("audit : une intention de service continue d’agir ; l’envoi n’a lieu que sur demande orale", () => {
  const isolated = planCommand("Je n’ai pas internet, je veux une caméra", knowledge, manifest);
  assert.equal(isolated.expected.pageId, "videosurveillance");
  const quote = planCommand("Je voudrais un devis gratuit", knowledge, manifest);
  assert.ok(quote.steps.some((step) => step.tool === "prefill_quote"));
  assert.ok(!quote.steps.some((step) => step.tool === "submit_quote"));
  assert.equal(manifest.guardrails.allowFormSubmission, true);
  assert.equal(manifest.guardrails.allowDirectDomFromModel, false);
});

test("audit : l’interruption et le suivi de parole sont branchés", () => {
  assert.match(providerSource, /async bargeIn|bargeIn\(reason/);
  assert.match(providerSource, /session\?\.interrupt\(\)/);
  assert.match(providerSource, /bargeIn\("manual-interrupt"\)/);
  assert.doesNotMatch(providerSource, /if \(this\.avatarSpeaking\) this\.bargeIn\("user-barge-in"\)/);
  assert.match(companionSource, /followSpokenNavigation/);
  assert.match(companionSource, /queueSpeechFollow/);
  assert.match(companionSource, /provider\?\.userSpeaking/);
  assert.doesNotMatch(companionSource, /listening && !this\.provider\.avatarSpeaking/);
});
