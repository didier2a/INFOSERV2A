import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

globalThis.location = new URL("https://infoserv2a.test/devis.html");
globalThis.window = globalThis;
globalThis.document = {
  addEventListener() {},
  getElementById() { return null; },
  querySelector() { return null; },
  querySelectorAll() { return []; }
};

const { ClaireCompanion } = await import("../assets/js/claire-companion.js");
const { planCommand } = await import("../assets/js/claire-runtime-v2.mjs");
const {
  quoteDraftSignature,
  saveSessionMemory
} = await import("../assets/js/claire-session-memory.mjs");
const knowledge = JSON.parse(await readFile(new URL("../data/site-knowledge.json", import.meta.url), "utf8"));
const manifest = JSON.parse(await readFile(new URL("../data/claire-capabilities.json", import.meta.url), "utf8"));

function memoryStorage() {
  return {
    data: new Map(),
    getItem(key) { return this.data.has(key) ? this.data.get(key) : null; },
    setItem(key, value) { this.data.set(key, value); },
    removeItem(key) { this.data.delete(key); }
  };
}

test("announceQuoteTruth ne transforme pas alreadySent en nouvel envoi réussi", () => {
  const base = {
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
  const storage = memoryStorage();
  globalThis.sessionStorage = storage;
  saveSessionMemory({
    ...base,
    lastSend: {
      sent: true,
      kind: "devis",
      inbox: "infoserv2a@gmail.com",
      signature: quoteDraftSignature(base)
    }
  }, storage);

  const written = [];
  const spoken = [];
  const companion = Object.assign(Object.create(ClaireCompanion.prototype), {
    actionMode: "devis",
    lastQuoteAnnounceAt: 0,
    lastSiteTruthSpeech: "",
    lastSiteSendOk: false,
    siteAdapter: {
      view: { activePage: "quote" },
      snapshot: () => ({ page: { id: "quote" } })
    },
    provider: {
      bargeIn() {},
      sendEmailResult(speech) { spoken.push(speech); }
    },
    writeSiteTruth(speech, options) {
      written.push({ speech, ...options });
      return { speech, duplicate: false };
    }
  });

  const speech = companion.announceQuoteTruth(
    "Oui, envoie ma demande de devis",
    "liveavatar",
    {
      outcome: {
        plan: { response: "La demande de devis a bien été envoyée." },
        results: []
      }
    }
  );

  assert.match(speech, /déjà été envoyée/);
  assert.doesNotMatch(speech, /bien été envoyée|envoyée avec succès/);
  assert.equal(written.at(-1).sent, false);
  assert.equal(spoken.at(-1), speech);
});

test("submit laisse la première confirmation prête atteindre submit_quote", async () => {
  const storage = memoryStorage();
  globalThis.sessionStorage = storage;
  globalThis.dispatchEvent = () => true;
  globalThis.CustomEvent = class {
    constructor(type, init) {
      this.type = type;
      this.detail = init?.detail;
    }
  };
  saveSessionMemory({
    visitor: {
      name: "Didier Aouizerate",
      phone: "07 45 15 60 76",
      email: "infoserv2a@gmail.com",
      city: "Porto-Vecchio"
    },
    service: "videosurveillance",
    need: "Caméra 4G pour un hangar isolé",
    turns: []
  }, storage);

  let runtimeContext;
  const companion = Object.assign(Object.create(ClaireCompanion.prototype), {
    actionMode: "devis",
    confirmationArmed: "",
    state: "guided",
    knowledge,
    pendingEmailSend: false,
    lastSiteSendOk: false,
    siteAdapter: { view: { activePage: "quote", activeSection: null } },
    surface: { window: { location: { pathname: "/devis.html" } } },
    runtime: {
      activeCommandId: null,
      async run(command, context) {
        runtimeContext = context;
        return {
          plan: planCommand(command, knowledge, manifest, context),
          results: [],
          verification: { ok: true },
          state: "ready"
        };
      }
    },
    nodes: { live: { textContent: "" } },
    provider: {},
    syncVisibleForms() {},
    appendTurn() {},
    updateLiveContext() {},
    setStatus() {},
    setState() {},
    verifiedSpeechFor() { return ""; },
    showRuntimeResult() {},
    renderSuggestions() {},
    async announceQuoteTruth() { return ""; },
    speak() {},
    pushPageContext() {}
  });

  const outcome = await companion.submit("Oui, envoie la demande de devis", "text");
  assert.equal(runtimeContext.confirmation.armed, true);
  assert.equal(outcome.plan.steps.some((step) => step.tool === "submit_quote"), true);
  assert.doesNotMatch(outcome.plan.response, /dites exactement|relisez-la/i);
});
