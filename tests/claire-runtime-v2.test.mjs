import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ClaireRuntimeController,
  planCommand
} from "../assets/js/claire-runtime-v2.mjs";
import { InfoServ2ALabAdapter } from "../assets/js/claire-site-adapter.mjs";
import { InfoServ2ASiteAdapter } from "../assets/js/claire-site-runtime-adapter.mjs";

const knowledge = JSON.parse(
  await readFile(new URL("../data/site-knowledge.json", import.meta.url), "utf8")
);
const manifest = JSON.parse(
  await readFile(new URL("../data/claire-capabilities.json", import.meta.url), "utf8")
);

test("le manifeste P1 n’expose que les cinq outils déclarés", () => {
  assert.deepEqual(
    manifest.tools.map((tool) => tool.name),
    ["search_site", "open_service", "scroll_to", "open_contact", "prefill_quote"]
  );
  assert.equal(manifest.runtimeVersion, "2.0.0-p1");
  assert.equal(manifest.mode, "controlled-site");
  assert.equal(manifest.guardrails.allowDirectDomFromModel, false);
  assert.equal(manifest.guardrails.allowFormSubmission, false);
});

class MockPersistentSurface {
  constructor() {
    this.activePage = "home";
    this.activeSection = null;
    this.calls = [];
    this.draft = null;
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
    this.draft = draft;
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

test("le scénario sans fibre produit le plan canonique exact", () => {
  const plan = planCommand(
    "Affiche les solutions de vidéosurveillance sans fibre.",
    knowledge,
    manifest
  );
  assert.deepEqual(
    plan.steps.map((step) => step.tool),
    ["search_site", "open_service", "scroll_to"]
  );
  assert.deepEqual(plan.expected, {
    pageId: "videosurveillance",
    anchorId: "solutions-sans-fibre"
  });
  assert.equal(
    plan.response,
    "Voici les solutions 4G, 5G et solaires adaptées aux sites sans fibre."
  );
});

test("le contrôleur exécute, vérifie et journalise une seule action à la fois", async () => {
  const adapter = new InfoServ2ALabAdapter({ knowledge, manifest });
  const controller = new ClaireRuntimeController({
    knowledge,
    manifest,
    adapter,
    clock: () => "2026-08-31T00:00:00.000Z"
  });
  const outcome = await controller.run(
    "Affiche les solutions de vidéosurveillance sans fibre."
  );
  assert.equal(outcome.state, "complete");
  assert.equal(outcome.verification.ok, true);
  assert.deepEqual(
    outcome.results.map((result) => result.tool),
    ["search_site", "open_service", "scroll_to"]
  );
  assert.deepEqual(
    controller.events
      .filter((event) => event.type === "state.changed")
      .map((event) => event.payload.next),
    ["interpreting", "planning", "executing", "verifying", "complete"]
  );
  const snapshot = adapter.snapshot();
  assert.equal(snapshot.activePage, "videosurveillance");
  assert.equal(snapshot.activeSection, "solutions-sans-fibre");
});

test("P1 pilote la vraie surface dans l’ordre sans détruire la session", async () => {
  const surface = new MockPersistentSurface();
  const adapter = new InfoServ2ASiteAdapter({ knowledge, manifest, surface });
  const controller = new ClaireRuntimeController({ knowledge, manifest, adapter });
  const outcome = await controller.run("Affiche les solutions de vidéosurveillance sans fibre.");
  assert.equal(outcome.verification.ok, true);
  assert.equal(outcome.verification.persistentSession, true);
  assert.deepEqual(surface.calls, [
    ["openPage", "videosurveillance", "push"],
    ["scrollTo", "solutions-sans-fibre"]
  ]);
  assert.equal(adapter.snapshot().activePage, "videosurveillance");
  assert.equal(adapter.snapshot().activeSection, "solutions-sans-fibre");
});

test("P1 ouvre l’audit NIS 2 sur l’ancre canonique", async () => {
  const surface = new MockPersistentSurface();
  const adapter = new InfoServ2ASiteAdapter({ knowledge, manifest, surface });
  const controller = new ClaireRuntimeController({ knowledge, manifest, adapter });
  const outcome = await controller.run("Ouvre Nice 2.");
  assert.deepEqual(outcome.plan.expected, { pageId: "cybersecurity", anchorId: "audit-nis2" });
  assert.deepEqual(surface.calls, [
    ["openPage", "cybersecurity", "push"],
    ["scrollTo", "audit-nis2"]
  ]);
});

test("une deuxième commande est refusée tant que la première est active", async () => {
  let release;
  let calls = 0;
  const adapter = {
    execute() {
      calls += 1;
      if (calls === 1) {
        return new Promise((resolve) => {
          release = () => resolve({ ok: true });
        });
      }
      return Promise.resolve({ ok: true });
    },
    verify() {
      return Promise.resolve({ ok: true });
    }
  };
  const controller = new ClaireRuntimeController({ knowledge, manifest, adapter });
  const first = controller.run("Affiche les solutions de vidéosurveillance sans fibre.");
  await Promise.resolve();
  await Promise.resolve();
  await assert.rejects(
    controller.run("Ouvre l’audit NIS 2."),
    /déjà en cours/
  );
  release();
  await first;
});

test("le contact est affiché sans déclencher appel ou email", async () => {
  const adapter = new InfoServ2ALabAdapter({ knowledge, manifest });
  const controller = new ClaireRuntimeController({ knowledge, manifest, adapter });
  const outcome = await controller.run("Je voudrais vous contacter par email.");
  const snapshot = adapter.snapshot();
  assert.equal(outcome.verification.ok, true);
  assert.equal(outcome.verification.pageId, "contact");
  assert.equal(snapshot.activePage, "contact");
  assert.equal(snapshot.contactChannel, "email");
  assert.equal(snapshot.submitted, false);
});

test("le devis reste un brouillon non soumis", async () => {
  const adapter = new InfoServ2ALabAdapter({ knowledge, manifest });
  const controller = new ClaireRuntimeController({ knowledge, manifest, adapter });
  const outcome = await controller.run("Ouvre le formulaire de devis.");
  assert.ok(outcome.plan.steps.some((step) => step.tool === "prefill_quote"));
  const snapshot = adapter.snapshot();
  assert.equal(snapshot.activePage, "quote");
  assert.equal(snapshot.submitted, false);
  assert.equal(snapshot.quoteDraft.description, "Ouvre le formulaire de devis.");
});

test("P1 préremplit un devis dans la surface mais ne le soumet jamais", async () => {
  const surface = new MockPersistentSurface();
  const adapter = new InfoServ2ASiteAdapter({ knowledge, manifest, surface });
  const controller = new ClaireRuntimeController({ knowledge, manifest, adapter });
  const outcome = await controller.run("Ouvre le formulaire de devis.");
  assert.equal(outcome.verification.ok, true);
  assert.equal(adapter.snapshot().submitted, false);
  assert.equal(surface.draft.description, "Ouvre le formulaire de devis.");
  assert.ok(!surface.calls.some(([name]) => name === "submit"));
});

test("P1 affiche le contact sans lancer l’appel ni la messagerie", async () => {
  const surface = new MockPersistentSurface();
  const adapter = new InfoServ2ASiteAdapter({ knowledge, manifest, surface });
  const controller = new ClaireRuntimeController({ knowledge, manifest, adapter });
  const outcome = await controller.run("Je voudrais vous contacter par email.");
  assert.equal(outcome.verification.ok, true);
  assert.equal(adapter.snapshot().contactChannel, "email");
  assert.ok(!surface.calls.some(([name]) => name === "call" || name === "email"));
});

test("l’ancre canonique existe dans la page publique", async () => {
  const html = await readFile(
    new URL("../videosurveillance.html", import.meta.url),
    "utf8"
  );
  assert.match(html, /id="solutions-sans-fibre"/);
});

test("le laboratoire ne charge ni fournisseur temps réel ni secret client", async () => {
  const [html, client, manifestSource] = await Promise.all([
    readFile(new URL("../claire-lab.html", import.meta.url), "utf8"),
    readFile(new URL("../assets/js/claire-lab.js", import.meta.url), "utf8"),
    readFile(new URL("../data/claire-capabilities.json", import.meta.url), "utf8")
  ]);
  const source = html + client + manifestSource;
  assert.doesNotMatch(html, /claire-companion\.js|claire-liveavatar-provider|api\/liveavatar/i);
  assert.doesNotMatch(client, /openai|livekit|liveavatar/i);
  assert.doesNotMatch(source, /\bsk-[A-Za-z0-9_-]{20,}\b/);
  assert.doesNotMatch(source, /_API_KEY/);
});
