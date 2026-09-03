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

class ActuatorSurface {
  constructor() {
    this.activePage = "home";
    this.activeSection = null;
    this.calls = [];
    this.posts = [];
  }

  async openPage(page) {
    this.calls.push(["openPage", page.id]);
    this.activePage = page.id;
    return page;
  }

  async scrollTo(anchorId) {
    this.calls.push(["scrollTo", anchorId]);
    this.activeSection = anchorId;
    return { id: anchorId };
  }

  prefillQuote(draft) {
    this.calls.push(["prefillQuote", draft]);
    this.draft = { ...draft };
    const missing = ["name", "phone", "email", "city", "service", "description"]
      .filter((key) => !String(draft[key] || "").trim());
    return { submitted: false, sent: false, missing };
  }

  quoteMissingFields() {
    return ["name", "phone", "email", "city", "service", "description"]
      .filter((key) => !String(this.draft?.[key] || "").trim());
  }

  async submitQuote(draft) {
    this.calls.push(["submitQuote", draft]);
    this.draft = { ...draft };
    const missing = this.quoteMissingFields();
    if (missing.length) {
      return { submitted: false, sent: false, missing };
    }
    const result = await this.sendSiteEmail({ kind: "devis", ...draft });
    return { submitted: Boolean(result.sent), sent: Boolean(result.sent), missing: [], ...result };
  }

  async sendSiteEmail(payload) {
    this.posts.push(payload);
    this.calls.push(["sendSiteEmail", payload]);
    return { sent: true, inbox: "contact@infoserv2a.pro", replyTo: payload.email || "" };
  }

  snapshotContactFields() {
    return { ...(this.contact || {}) };
  }

  prefillContact(draft) {
    this.calls.push(["prefillContact", draft]);
    this.contact = { ...draft };
    return this.contact;
  }

  async composeEmail(draft) {
    this.calls.push(["composeEmail", draft]);
    this.prefillContact(draft);
    return this.sendSiteEmail({
      kind: "contact",
      name: draft.name,
      email: draft.email,
      phone: draft.phone,
      message: draft.message || draft.body
    });
  }

  snapshot() {
    return { activePage: this.activePage, activeSection: this.activeSection };
  }
}

test("simulation vocale : un devis incomplet n’actionne pas l’envoi", async () => {
  const { rememberTurn, describeQuoteChecklist, canSubmitQuote } = await import("../assets/js/claire-session-memory.mjs");
  const { classifyUtterance } = await import("../assets/js/claire-core.mjs");
  const { describeEmailSendOutcome } = await import("../assets/js/site-email.mjs");

  const storage = {
    data: new Map(),
    getItem(key) { return this.data.get(key) || null; },
    setItem(key, value) { this.data.set(key, value); },
    removeItem(key) { this.data.delete(key); }
  };
  globalThis.sessionStorage = storage;

  const dictation = [
    "Je m’appelle Didier Aouizerate",
    "J’habite Porto-Vecchio",
    "Je veux une caméra 4G pour un hangar"
  ];
  let memory;
  for (const heard of dictation) {
    const kind = classifyUtterance(heard, knowledge).kind;
    assert.ok(kind === "chat" || kind === "site", `${heard} → ${kind}`);
    memory = rememberTurn("user", heard, storage);
  }
  assert.equal(canSubmitQuote(memory), false);
  const checklist = describeQuoteChecklist(memory);
  assert.match(checklist.speech, /n’envoie pas/);
  assert.match(checklist.speech, /e-mail|téléphone/);

  const surface = new ActuatorSurface();
  const adapter = new InfoServ2ASiteAdapter({ knowledge, manifest, surface });
  const controller = new ClaireRuntimeController({ knowledge, manifest, adapter });
  const outcome = await controller.run("Envoie le devis", { memory });
  const prefill = outcome.results.find((item) => item.tool === "prefill_quote");
  const submit = outcome.results.find((item) => item.tool === "submit_quote");
  assert.ok(prefill);
  assert.equal(submit, undefined);
  assert.equal(prefill.output.sent, false);
  assert.ok(prefill.output.missing.includes("email"));
  assert.equal(surface.posts.length, 0);
  assert.match(describeEmailSendOutcome(outcome), /n’ai pas envoyé/);
  assert.doesNotMatch(describeEmailSendOutcome(outcome), /bien été envoyé/);
});

test("simulation vocale : devis complet + « envoie le devis » actionne vraiment l’API", async () => {
  const { canSubmitQuote } = await import("../assets/js/claire-session-memory.mjs");
  const { describeEmailSendOutcome } = await import("../assets/js/site-email.mjs");
  const memory = {
    visitor: {
      name: "Didier Aouizerate",
      phone: "07 45 15 60 76",
      email: "infoserv2a@gmail.com",
      city: "Porto-Vecchio"
    },
    service: "videosurveillance",
    need: "Caméra 4G pour un hangar isolé",
    turns: []
  };
  assert.equal(canSubmitQuote(memory), true);
  const surface = new ActuatorSurface();
  const adapter = new InfoServ2ASiteAdapter({ knowledge, manifest, surface });
  const controller = new ClaireRuntimeController({ knowledge, manifest, adapter });
  const outcome = await controller.run("Envoie le devis", { memory });
  const submit = outcome.results.find((item) => item.tool === "submit_quote");
  assert.equal(submit.output.sent, true);
  assert.equal(surface.posts.length, 1);
  assert.equal(surface.posts[0].kind, "devis");
  assert.equal(surface.posts[0].email, "infoserv2a@gmail.com");
  assert.match(describeEmailSendOutcome(outcome), /bien été envoyée vers contact@infoserv2a\.pro/);
});

test("simulation vocale : « c’est bon » avec dossier complet actionne vraiment l’API", async () => {
  const { canSubmitQuote } = await import("../assets/js/claire-session-memory.mjs");
  const { describeEmailSendOutcome } = await import("../assets/js/site-email.mjs");
  const { classifyUtterance, shouldExecuteSiteRuntime } = await import("../assets/js/claire-core.mjs");
  const memory = {
    visitor: {
      name: "Didier Aouizerate",
      phone: "07 45 15 60 76",
      email: "infoserv2a@gmail.com",
      city: "Porto-Vecchio"
    },
    service: "videosurveillance",
    need: "Caméra 4G pour un hangar isolé",
    turns: []
  };
  assert.equal(canSubmitQuote(memory), true);
  const classified = classifyUtterance("c’est bon", knowledge);
  assert.equal(classified.kind, "chat");
  assert.equal(shouldExecuteSiteRuntime(classified, "c’est bon"), true);
  const surface = new ActuatorSurface();
  const adapter = new InfoServ2ASiteAdapter({ knowledge, manifest, surface });
  const controller = new ClaireRuntimeController({ knowledge, manifest, adapter });
  const outcome = await controller.run("c’est bon", { memory, pageId: "quote" });
  const submit = outcome.results.find((item) => item.tool === "submit_quote");
  assert.equal(submit.output.sent, true);
  assert.equal(surface.posts.length, 1);
  assert.equal(surface.posts[0].kind, "devis");
  assert.match(describeEmailSendOutcome(outcome), /bien été envoyée vers contact@infoserv2a\.pro/);
});

test("simulation vocale : un devis prérempli sur le formulaire part à l’envoi", async () => {
  const { canSubmitQuote } = await import("../assets/js/claire-session-memory.mjs");
  const thinMemory = {
    visitor: { name: "Didier Aouizerate", phone: "", email: "", city: "Porto-Vecchio" },
    service: "videosurveillance",
    need: "Caméra 4G",
    turns: []
  };
  assert.equal(canSubmitQuote(thinMemory), false);
  const hydrated = {
    ...thinMemory,
    visitor: {
      name: "Didier Aouizerate",
      phone: "07 45 15 60 76",
      email: "infoserv2a@gmail.com",
      city: "Porto-Vecchio"
    },
    service: "videosurveillance",
    need: "Caméra 4G pour un hangar isolé"
  };
  assert.equal(canSubmitQuote(hydrated), true);
  const surface = new ActuatorSurface();
  const adapter = new InfoServ2ASiteAdapter({ knowledge, manifest, surface });
  const controller = new ClaireRuntimeController({ knowledge, manifest, adapter });
  const outcome = await controller.run("Envoie le devis", { memory: hydrated });
  assert.equal(outcome.results.find((item) => item.tool === "submit_quote")?.output?.sent, true);
  assert.equal(surface.posts.length, 1);
});

test("simulation vocale : « c’est bon » sur contact remplit et envoie le message", async () => {
  const { canSubmitContact } = await import("../assets/js/claire-session-memory.mjs");
  const { describeEmailSendOutcome } = await import("../assets/js/site-email.mjs");
  const memory = {
    visitor: {
      name: "Didier Aouizerate",
      phone: "07 45 15 60 76",
      email: "infoserv2a@gmail.com",
      city: "Porto-Vecchio"
    },
    service: "",
    need: "Je veux un interlocuteur pour mon réseau",
    turns: []
  };
  assert.equal(canSubmitContact(memory), true);
  const surface = new ActuatorSurface();
  const adapter = new InfoServ2ASiteAdapter({ knowledge, manifest, surface });
  const controller = new ClaireRuntimeController({ knowledge, manifest, adapter });
  const outcome = await controller.run("c’est bon", { memory, pageId: "contact" });
  const mail = outcome.results.find((item) => item.tool === "compose_email");
  assert.equal(mail.output.sent, true);
  assert.equal(surface.posts.length, 1);
  assert.equal(surface.posts[0].kind, "contact");
  assert.equal(surface.posts[0].email, "infoserv2a@gmail.com");
  assert.ok(surface.calls.some(([name]) => name === "prefillContact"));
  assert.match(describeEmailSendOutcome(outcome), /bien été envoyé vers contact@infoserv2a\.pro|bien été envoyée vers contact@infoserv2a\.pro/);
});

test("Claire écrit dans le formulaire contact visible, pas seulement au moment de l’envoi", async () => {
  const { BrowserInfoServ2ASurface } = await import("../assets/js/claire-site-runtime-adapter.mjs");
  const fields = new Map();
  const documentRef = {
    querySelector(sel) {
      if (sel === "#contact-form") return { id: "contact-form" };
      if (sel === "#devis-form") return null;
      if (!String(sel).startsWith("#contact-")) return null;
      if (!fields.has(sel)) fields.set(sel, { tagName: "INPUT", value: "", options: [] });
      return fields.get(sel);
    }
  };
  const surface = new BrowserInfoServ2ASurface({
    knowledge,
    windowRef: {
      location: {
        href: "https://infoserv2a.pro/contact.html",
        pathname: "/contact.html",
        origin: "https://infoserv2a.pro",
        hash: ""
      }
    },
    documentRef,
    fetchImpl: async () => new Response("", { status: 200 })
  });
  const synced = surface.syncVisibleForms({
    visitor: {
      name: "Didier Aouizerate",
      phone: "07 45 15 60 76",
      email: "infoserv2a@gmail.com",
      city: "Porto-Vecchio"
    },
    need: "Demande pour le réseau du cabinet"
  });
  assert.equal(synced.contact, true);
  assert.equal(synced.quote, false);
  assert.equal(fields.get("#contact-name").value, "Didier Aouizerate");
  assert.equal(fields.get("#contact-email").value, "infoserv2a@gmail.com");
  assert.equal(fields.get("#contact-phone").value, "07 45 15 60 76");
  assert.equal(fields.get("#contact-message").value, "Demande pour le réseau du cabinet");
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
