import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { classifyUtterance, followSpokenNavigation, mergeSpokenTranscript, routeCommand } from "../assets/js/claire-core.mjs";
import { ClaireRuntimeController, planCommand } from "../assets/js/claire-runtime-v2.mjs";
import { InfoServ2ASiteAdapter } from "../assets/js/claire-site-runtime-adapter.mjs";

const knowledge = JSON.parse(
  await readFile(new URL("../data/site-knowledge.json", import.meta.url), "utf8")
);
const manifest = JSON.parse(
  await readFile(new URL("../data/claire-capabilities.json", import.meta.url), "utf8")
);

class MockPersistentSurface {
  constructor() {
    this.activePage = "home";
    this.activeSection = null;
    this.calls = [];
  }

  async openPage(page, options = {}) {
    this.calls.push(["openPage", page.id, options.historyMode || "push"]);
    this.activePage = page.id;
    this.activeSection = null;
    return page;
  }

  async scrollTo(anchorId) {
    this.calls.push(["scrollTo", anchorId]);
    this.activeSection = anchorId;
    return { id: anchorId };
  }

  prefillQuote(draft) {
    this.calls.push(["prefillQuote", draft.description]);
    return { serviceFound: true, descriptionFound: true, submitted: false };
  }

  submitQuote(draft) {
    this.calls.push(["submitQuote", draft]);
    return { submitted: true, missing: [] };
  }

  launchHref(href) {
    this.calls.push(["launchHref", href]);
    return { href, launched: true };
  }

  async sendSiteEmail(payload) {
    this.calls.push(["sendSiteEmail", payload]);
    return { sent: true, inbox: "contact@infoserv2a.pro", replyTo: payload.email || "" };
  }

  async composeEmail(draft) {
    this.calls.push(["composeEmail", draft]);
    return this.sendSiteEmail({
      kind: "contact",
      name: draft.name,
      email: draft.email,
      message: draft.message || draft.body
    });
  }

  snapshot() {
    return {
      activePage: this.activePage,
      activeSection: this.activeSection,
      navigationCount: this.calls.filter(([name]) => name === "openPage").length,
      mainConnected: true
    };
  }
}

const SPOKEN_SCENES = [
  {
    heard: "Je n’ai pas internet, je veux une caméra.",
    pageId: "videosurveillance",
    anchorId: "solutions-sans-fibre"
  },
  {
    heard: "Montre-moi la vidéosurveillance sans fibre.",
    pageId: "videosurveillance",
    anchorId: "solutions-sans-fibre"
  },
  {
    heard: "Je veux créer un site internet pour mon commerce.",
    pageId: "web",
    anchorId: null
  },
  {
    heard: "Ouvre l’audit NIS 2.",
    pageId: "cybersecurity",
    anchorId: "audit-nis2"
  },
  {
    heard: "Je voudrais un devis gratuit.",
    pageId: "quote",
    anchorId: null
  }
];

const IT_CHAT = [
  "Bonjour, comment ça va ?",
  "Mon disque dur n’est plus accessible.",
  "Mon téléphone ne marche plus.",
  "Peux-tu améliorer mon Wi-Fi ?",
  "Comment un laboratoire archive ses analyses ?"
];

const OFF_TOPIC_CHAT = [
  "Quelle est la capitale de la France ?",
  "Raconte-moi une histoire.",
  "Donne-moi une recette de gâteau."
];

test("simulation vocale : chaque phrase parlée ouvre la bonne page du site", async () => {
  for (const scene of SPOKEN_SCENES) {
    const surface = new MockPersistentSurface();
    const adapter = new InfoServ2ASiteAdapter({ knowledge, manifest, surface });
    const controller = new ClaireRuntimeController({ knowledge, manifest, adapter });
    const plan = planCommand(scene.heard, knowledge, manifest);
    const outcome = await controller.run(scene.heard);
    assert.equal(plan.expected.pageId, scene.pageId, scene.heard);
    assert.equal(plan.expected.anchorId, scene.anchorId, scene.heard);
    assert.equal(outcome.verification.ok, true, scene.heard);
    assert.equal(outcome.state, "ready", scene.heard);
    assert.equal(adapter.snapshot().activePage, scene.pageId, scene.heard);
    assert.equal(adapter.snapshot().activeSection, scene.anchorId, scene.heard);
  }
});

test("simulation vocale : un fragment « montre » ne décide pas encore de la page", () => {
  const early = routeCommand("montre", knowledge);
  const complete = routeCommand("montre moi la vidéosurveillance sans fibre", knowledge);
  assert.equal(early.type, "unknown");
  assert.equal(complete.page.id, "videosurveillance");
  assert.equal(complete.anchor.id, "solutions-sans-fibre");
});

test("simulation vocale : les sous-titres de Claire restent une seule réplique", () => {
  const chunks = ["Voici", "Voici les solutions", " 4G", "et solaires."];
  const spoken = chunks.reduce((text, chunk) => mergeSpokenTranscript(text, chunk), "");
  assert.equal(spoken, "Voici les solutions 4G et solaires.");
});

test("simulation vocale : un aparté informatique ou hors-sujet ne déclenche pas de navigation", () => {
  for (const heard of IT_CHAT) {
    assert.equal(classifyUtterance(heard, knowledge).kind, "chat", heard);
    const plan = planCommand(heard, knowledge, manifest);
    assert.equal(plan.mode, "chat", heard);
    assert.equal(plan.steps.length, 0, heard);
  }
  for (const heard of OFF_TOPIC_CHAT) {
    assert.equal(classifyUtterance(heard, knowledge).kind, "offtopic", heard);
    const plan = planCommand(heard, knowledge, manifest);
    assert.equal(plan.mode, "offtopic", heard);
    assert.equal(plan.steps.length, 0, heard);
  }
  for (const scene of SPOKEN_SCENES) {
    assert.equal(classifyUtterance(scene.heard, knowledge).kind, "site", scene.heard);
  }
});

test("simulation vocale : la parole de Claire ouvre l’onglet lu à droite", async () => {
  const surface = new MockPersistentSurface();
  const adapter = new InfoServ2ASiteAdapter({ knowledge, manifest, surface });
  const chunks = [
    "Voici",
    "Voici l’onglet Vidéosurveillance",
    "Voici l’onglet Vidéosurveillance et les solutions sans fibre."
  ];
  let spoken = "";
  let context = { pageId: "home", sectionId: null };
  let last = null;
  for (const chunk of chunks) {
    spoken = mergeSpokenTranscript(spoken, chunk);
    const target = followSpokenNavigation(spoken, knowledge, context);
    if (!target) continue;
    last = target;
    if (target.pageId !== context.pageId) {
      await adapter.execute("open_service", { service: target.pageId });
    }
    if (target.anchorId) {
      await adapter.execute("scroll_to", { target: target.anchorId });
    }
    context = { pageId: target.pageId, sectionId: target.anchorId };
  }
  assert.equal(last.pageId, "videosurveillance");
  assert.equal(last.anchorId, "solutions-sans-fibre");
  assert.equal(adapter.snapshot().activePage, "videosurveillance");
  assert.equal(adapter.snapshot().activeSection, "solutions-sans-fibre");
  assert.equal(
    followSpokenNavigation("Je comprends, votre disque dur n’est plus accessible.", knowledge, { pageId: "home" })?.pageId,
    "data-recovery"
  );
});

test("simulation vocale : l’onglet suivant parcourt le catalogue", async () => {
  const surface = new MockPersistentSurface();
  const adapter = new InfoServ2ASiteAdapter({ knowledge, manifest, surface });
  const controller = new ClaireRuntimeController({ knowledge, manifest, adapter });
  const first = await controller.run("Onglet suivant.", { pageId: "home" });
  assert.equal(first.verification.pageId, "videosurveillance");
  const second = await controller.run("Onglet suivant.", { pageId: "videosurveillance" });
  assert.equal(second.verification.pageId, "web");
});
