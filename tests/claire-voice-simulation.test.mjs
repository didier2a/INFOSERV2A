import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { mergeSpokenTranscript, routeCommand } from "../assets/js/claire-core.mjs";
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
    heard: "Mon disque dur n’est plus accessible.",
    pageId: "data-recovery",
    anchorId: "supports"
  },
  {
    heard: "Peux-tu améliorer mon Wi-Fi ?",
    pageId: "home-support",
    anchorId: null
  },
  {
    heard: "Je voudrais un devis gratuit.",
    pageId: "quote",
    anchorId: null
  }
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
