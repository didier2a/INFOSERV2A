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

test("le manifeste généraliste expose le catalogue d’onglets", () => {
  assert.deepEqual(
    manifest.tools.map((tool) => tool.name),
    [
      "search_site",
      "open_service",
      "scroll_to",
      "open_contact",
      "prefill_quote",
      "submit_quote",
      "start_call",
      "compose_email",
      "list_catalog",
      "explain_page",
      "go_home",
      "next_page",
      "prev_page",
      "next_section",
      "prev_section"
    ]
  );
  assert.equal(manifest.runtimeVersion, "2.3.0-memory");
  assert.equal(manifest.mode, "it-generalist-with-site-catalog");
  assert.equal(manifest.guardrails.allowDirectDomFromModel, false);
  assert.equal(manifest.guardrails.allowFormSubmission, true);
  assert.equal(manifest.guardrails.defaultUtteranceKind, "chat");
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

  async submitQuote(draft) {
    this.calls.push(["submitQuote", draft]);
    this.draft = draft;
    this.submitted = true;
    const result = await this.sendSiteEmail({ kind: "devis", ...draft });
    return { submitted: true, sent: true, missing: [], ...result };
  }

  launchHref(href) {
    this.calls.push(["launchHref", href]);
    return { href, launched: true };
  }

  async sendSiteEmail(payload) {
    this.calls.push(["sendSiteEmail", payload]);
    return {
      sent: true,
      inbox: "contact@infoserv2a.pro",
      replyTo: payload.email || "",
      provider: "test"
    };
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

test("une demande isolée sans fibre ouvre toujours la page, même sans verbe d’ouverture", () => {
  const plan = planCommand(
    "Je cherche une caméra pour un terrain sans internet.",
    knowledge,
    manifest
  );
  assert.equal(plan.expected.pageId, "videosurveillance");
  assert.equal(plan.expected.anchorId, "solutions-sans-fibre");
  assert.deepEqual(
    plan.steps.map((step) => step.tool),
    ["search_site", "open_service", "scroll_to"]
  );
});

test("une conversation informatique hors site ne planifie aucune navigation", () => {
  const plan = planCommand("Mon disque dur n’est plus accessible", knowledge, manifest);
  assert.equal(plan.mode, "chat");
  assert.deepEqual(plan.steps, []);
  assert.equal(plan.expected, null);
});

test("un loisir hors IT reste une conversation, sans navigation", () => {
  const plan = planCommand("Quelle est la capitale de la France ?", knowledge, manifest);
  assert.equal(plan.mode, "offtopic");
  assert.deepEqual(plan.steps, []);
  assert.equal(plan.expected, null);
});

test("le catalogue et l’onglet suivant sont des actions déclarées", async () => {
  const catalog = planCommand("Quels sont les onglets du site ?", knowledge, manifest);
  assert.equal(catalog.steps[0].tool, "list_catalog");
  assert.equal(catalog.expected, null);

  const surface = new MockPersistentSurface();
  const adapter = new InfoServ2ASiteAdapter({ knowledge, manifest, surface });
  const controller = new ClaireRuntimeController({ knowledge, manifest, adapter });
  const outcome = await controller.run("Onglet suivant.", { pageId: "home" });
  assert.equal(outcome.plan.steps[0].tool, "next_page");
  assert.equal(outcome.verification.pageId, "videosurveillance");
  assert.equal(adapter.snapshot().activePage, "videosurveillance");
});

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
  assert.equal(outcome.state, "ready");
  assert.equal(outcome.verification.ok, true);
  assert.deepEqual(
    outcome.results.map((result) => result.tool),
    ["search_site", "open_service", "scroll_to"]
  );
  assert.deepEqual(
    controller.events
      .filter((event) => event.type === "state.changed")
      .map((event) => event.payload.next),
    ["interpreting", "planning", "executing", "verifying", "complete", "ready"]
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
  const outcome = await controller.run("Je voudrais prendre contact.");
  const snapshot = adapter.snapshot();
  assert.equal(outcome.verification.ok, true);
  assert.equal(outcome.verification.pageId, "contact");
  assert.equal(snapshot.activePage, "contact");
  assert.equal(snapshot.contactChannel, "form");
  assert.equal(snapshot.submitted, false);
  assert.equal(snapshot.lastLaunch, undefined);
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
  const outcome = await controller.run("Je voudrais prendre contact.");
  assert.equal(outcome.verification.ok, true);
  assert.equal(adapter.snapshot().contactChannel, "form");
  assert.ok(!surface.calls.some(([name]) => ["call", "email", "launchHref", "composeEmail"].includes(name)));
});

test("un appel oral ouvre le numéro InfoServ2A", async () => {
  const surface = new MockPersistentSurface();
  const adapter = new InfoServ2ASiteAdapter({ knowledge, manifest, surface });
  const controller = new ClaireRuntimeController({ knowledge, manifest, adapter });
  const plan = planCommand("Appelle InfoServ2A", knowledge, manifest);
  assert.equal(plan.steps[0].tool, "start_call");
  const outcome = await controller.run("Appelle InfoServ2A");
  assert.equal(outcome.verification.pageId, "contact");
  assert.ok(surface.calls.some(([name, href]) => name === "launchHref" && String(href).startsWith("tel:")));
});

test("un mail oral envoie réellement vers InfoServ2A", async () => {
  const surface = new MockPersistentSurface();
  const adapter = new InfoServ2ASiteAdapter({ knowledge, manifest, surface });
  const controller = new ClaireRuntimeController({ knowledge, manifest, adapter });
  const memory = {
    visitor: { name: "Didier", phone: "", email: "didier@example.com", city: "" },
    need: "Site vitrine pour mon commerce",
    service: "creation-site-web",
    turns: []
  };
  const plan = planCommand("Envoie un mail", knowledge, manifest, { memory });
  assert.equal(plan.steps[0].tool, "compose_email");
  const outcome = await controller.run("Envoie un mail", { memory });
  assert.equal(outcome.verification.pageId, "contact");
  const mail = outcome.results.find((item) => item.tool === "compose_email");
  assert.equal(mail.output.sent, true);
  assert.equal(mail.output.inbox, "contact@infoserv2a.pro");
  assert.ok(surface.calls.some(([name]) => name === "sendSiteEmail"));
  assert.ok(!surface.calls.some(([, href]) => String(href || "").startsWith("mailto:")));
});

test("envoie le devis ne part que si le contexte a les coordonnées", async () => {
  const empty = planCommand("Envoie le devis", knowledge, manifest);
  assert.ok(empty.steps.some((step) => step.tool === "prefill_quote"));
  assert.ok(!empty.steps.some((step) => step.tool === "submit_quote"));
  assert.match(empty.response, /n’envoie pas/);
  assert.doesNotMatch(empty.response, /bien été envoyé|c’est parti/);

  const memory = {
    visitor: {
      name: "Marie Rossi",
      phone: "07 45 15 60 76",
      email: "marie@example.com",
      city: "Porto-Vecchio"
    },
    service: "videosurveillance",
    need: "Caméra 4G pour un hangar isolé",
    turns: []
  };
  const ready = planCommand("Envoie le devis", knowledge, manifest, { memory });
  assert.ok(ready.steps.some((step) => step.tool === "submit_quote"));

  const adapter = new InfoServ2ALabAdapter({ knowledge, manifest });
  const controller = new ClaireRuntimeController({ knowledge, manifest, adapter });
  const outcome = await controller.run("Envoie le devis", { memory });
  assert.equal(adapter.snapshot().submitted, true);
  assert.equal(outcome.verification.pageId, "quote");
});

test("une confirmation orale courte envoie le devis déjà complet", () => {
  const memory = {
    visitor: {
      name: "Marie Rossi",
      phone: "07 45 15 60 76",
      email: "marie@example.com",
      city: "Porto-Vecchio"
    },
    service: "videosurveillance",
    need: "Caméra 4G pour un hangar isolé",
    turns: []
  };
  const plan = planCommand("c’est bon", knowledge, manifest, { memory, pageId: "quote" });
  assert.ok(plan.steps.some((step) => step.tool === "submit_quote"));
  const contact = planCommand("confirme", knowledge, manifest, {
    memory: {
      visitor: { name: "Didier", phone: "", email: "didier@example.com", city: "" },
      need: "Site vitrine",
      turns: []
    },
    pageId: "contact"
  });
  assert.ok(contact.steps.some((step) => step.tool === "compose_email"));
});

test("l’ancre canonique existe dans la page publique", async () => {
  const html = await readFile(
    new URL("../videosurveillance.html", import.meta.url),
    "utf8"
  );
  assert.match(html, /id="solutions-sans-fibre"/);
});

test("l’ancre hébergement existe dans la page publique", async () => {
  const html = await readFile(
    new URL("../creation-site-web.html", import.meta.url),
    "utf8"
  );
  assert.match(html, /id="offre-hebergement"/);
});

test("la spec Figma versionne les huit frames de l’aidante", async () => {
  const [spec, html, plan] = await Promise.all([
    readFile(new URL("../data/claire-aidant-figma.json", import.meta.url), "utf8"),
    readFile(new URL("../claire-aidant-figma.html", import.meta.url), "utf8"),
    readFile(new URL("../docs/claire-aidant-plan.md", import.meta.url), "utf8")
  ]);
  const inventory = JSON.parse(spec);
  assert.equal(inventory.frames.length, 8);
  assert.deepEqual(
    inventory.frames.map((frame) => frame.id),
    ["F01", "F02", "F03", "F04", "F05", "F06", "F07", "F08"]
  );
  for (const frame of inventory.frames) {
    assert.match(html, new RegExp(`data-figma-frame="${frame.id}"`));
  }
  assert.match(plan, /aidante Live Avatar/i);
  assert.match(plan, /claire-aidant-figma/);
  assert.doesNotMatch(html + spec, /\bsk-[A-Za-z0-9_-]{20,}\b/);
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
