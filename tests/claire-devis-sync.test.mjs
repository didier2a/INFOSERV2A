import assert from "node:assert/strict";
import test from "node:test";

import { interviewUpdate } from "../assets/js/claire-actions-v1.mjs";
import { BrowserInfoServ2ASurface } from "../assets/js/claire-site-runtime-adapter.mjs";
import {
  SESSION_MEMORY_KEY,
  applyDraftPatch,
  canSubmitQuote,
  extractFactsFromUtterance,
  inferService,
  loadSessionMemory,
  rejectDraftFields,
  rememberAskedQuoteField,
  rememberDraftField,
  rememberTurn,
  saveSessionMemory
} from "../assets/js/claire-session-memory.mjs";

function memoryStorage() {
  const data = new Map();
  return {
    getItem(key) { return data.get(key) || null; },
    setItem(key, value) { data.set(key, value); },
    removeItem(key) { data.delete(key); },
    dump() { return JSON.parse(data.get(SESSION_MEMORY_KEY)); }
  };
}

function completeMemory(overrides = {}) {
  return {
    visitor: {
      name: "Didier Aouizerate",
      phone: "07 45 15 60 76",
      email: "didier@example.com",
      city: "Ajaccio"
    },
    service: "reseaux-wifi",
    need: "Installer un réseau Wi-Fi professionnel",
    turns: [],
    ...overrides
  };
}

test("la réponse courte remplit le dernier slot demandé, pas le besoin", () => {
  const storage = memoryStorage();
  rememberAskedQuoteField("name", storage);
  const memory = rememberTurn("user", "Didier Aouizerate", storage);
  assert.equal(memory.visitor.name, "Didier Aouizerate");
  assert.equal(memory.need, "");
  assert.equal(memory.draft.provenance.name.source, "oral");
  assert.equal(memory.draft.askedField, "");
});

test("une commune explicite ne devient jamais un nom même si Claire attend le nom", () => {
  const storage = memoryStorage();
  rememberAskedQuoteField("name", storage);
  const memory = rememberTurn("user", "je suis à Ajaccio", storage);
  assert.equal(memory.visitor.name, "");
  assert.equal(memory.visitor.city, "Ajaccio");
  assert.equal(memory.draft.askedField, "name");
  assert.equal(extractFactsFromUtterance("je suis à Ajaccio").name, undefined);
});

test("les éditions humaines sont fusionnées en last-write-wins avec provenance", () => {
  let memory = applyDraftPatch({}, { name: "Nom oral" }, { source: "oral", at: 10 });
  memory = applyDraftPatch(memory, { name: "Nom tapé" }, { source: "typed", at: 20 });
  memory = applyDraftPatch(memory, { name: "Ancien oral" }, { source: "oral", at: 15 });
  memory = applyDraftPatch(memory, { name: "Remplissage Claire" }, { source: "programmatic", at: 30 });
  assert.equal(memory.visitor.name, "Nom tapé");
  assert.deepEqual(memory.draft.provenance.name, { source: "typed", updatedAt: 20 });

  memory = applyDraftPatch(memory, { name: "Nouvel oral" }, { source: "oral", at: 40 });
  assert.equal(memory.visitor.name, "Nouvel oral");
  assert.equal(memory.draft.provenance.name.source, "oral");
});

test("un champ tapé est immédiatement disponible pour le prochain tour oral", () => {
  const storage = memoryStorage();
  saveSessionMemory(completeMemory({
    visitor: { ...completeMemory().visitor, email: "" }
  }), storage);
  const typed = rememberDraftField("email", "didier@example.com", "typed", storage);
  assert.equal(typed.visitor.email, "didier@example.com");
  assert.equal(loadSessionMemory(storage).draft.provenance.email.source, "typed");
  assert.equal(canSubmitQuote(loadSessionMemory(storage)), true);
});

test("un e-mail invalide bloque la phrase de confirmation et déclenche une correction ciblée", () => {
  const memory = applyDraftPatch(
    completeMemory(),
    { email: "didier.example.com" },
    { source: "typed", at: 20 }
  );
  const update = interviewUpdate("devis", memory);
  assert.equal(canSubmitQuote(memory), false);
  assert.equal(update.ready, false);
  assert.equal(update.askedField, "email");
  assert.match(update.speech, /e-mail n’est pas valide/i);
  assert.match(update.speech, /adresse e-mail/i);
});

test("un rejet API invalide le champ précis et interdit de renvoyer le même payload", () => {
  const storage = memoryStorage();
  saveSessionMemory(completeMemory(), storage);
  const rejected = rejectDraftFields(
    ["email"],
    { email: "L’adresse e-mail a été refusée par le service d’envoi." },
    storage
  );
  const update = interviewUpdate("devis", rejected);
  assert.equal(rejected.visitor.email, "");
  assert.equal(canSubmitQuote(rejected), false);
  assert.equal(update.askedField, "email");
  assert.match(update.speech, /refusée/i);
  const repeated = rememberTurn("user", "Oui, envoie ma demande de devis", storage);
  assert.equal(repeated.visitor.email, "");
  assert.equal(canSubmitQuote(repeated), false);
});

test("la surface marque visuellement le champ refusé par l’API", () => {
  const attributes = new Map();
  const holder = { textContent: "" };
  const email = {
    dataset: {},
    setAttribute(name, value) { attributes.set(name, value); },
    closest() { return { querySelector() { return holder; } }; }
  };
  const form = {};
  const surface = new BrowserInfoServ2ASurface({
    knowledge: { pages: [] },
    windowRef: {
      location: { href: "https://preprod.example/devis.html", pathname: "/devis.html", origin: "https://preprod.example" },
      setTimeout,
      clearTimeout
    },
    documentRef: {
      querySelector(selector) {
        if (selector === "#devis-form") return form;
        if (selector === "#devis-email") return email;
        return null;
      }
    },
    fetchImpl: async () => new Response()
  });
  const fields = surface.applyFieldErrors("devis", {
    missing: ["email"],
    fieldErrors: { email: "L’adresse e-mail a été refusée." }
  });
  assert.deepEqual(fields, ["email"]);
  assert.equal(attributes.get("aria-invalid"), "true");
  assert.equal(email.dataset.claireServerRejected, "true");
  assert.match(holder.textContent, /refusée/);
});

test("le service réseaux et Wi-Fi est inféré depuis une demande orale", () => {
  assert.equal(inferService("Je dois refaire mon réseau Wi-Fi et installer deux bornes"), "reseaux-wifi");
});

test("les écritures programmatiques émettent input et change", () => {
  const events = [];
  const field = {
    value: "",
    tagName: "INPUT",
    dataset: {},
    scrollTop: 0,
    dispatchEvent(event) { events.push(event.type); }
  };
  const surface = new BrowserInfoServ2ASurface({
    knowledge: { pages: [] },
    windowRef: {
      location: { href: "https://preprod.example/devis.html", pathname: "/devis.html", origin: "https://preprod.example" },
      Event,
      setTimeout,
      clearTimeout
    },
    documentRef: { querySelector() { return field; } },
    fetchImpl: async () => new Response()
  });
  surface.fillQuoteField("#devis-name", "Didier Aouizerate");
  assert.deepEqual(events, ["input", "change"]);
  assert.equal(field.dataset.claireWriteSource, undefined);
});

test("la synthèse Claire ne remplace jamais un message contact tapé", () => {
  const message = {
    value: "Message saisi par le client, à conserver mot pour mot.",
    tagName: "TEXTAREA",
    dataset: {},
    scrollTop: 0,
    dispatchEvent() {}
  };
  const surface = new BrowserInfoServ2ASurface({
    knowledge: { pages: [] },
    windowRef: {
      location: { href: "https://preprod.example/contact", pathname: "/contact", origin: "https://preprod.example" },
      Event,
      setTimeout,
      clearTimeout
    },
    documentRef: {
      querySelector(selector) {
        if (selector === "#contact-message") return message;
        return null;
      }
    },
    fetchImpl: async () => new Response()
  });
  const fields = surface.prefillContact(
    { message: "Synthèse de l’échange : texte généré par Claire." },
    {
      memory: {
        draft: {
          values: { message: message.value },
          provenance: { message: { source: "typed", updatedAt: 20 } }
        }
      }
    }
  );
  assert.equal(fields.message, "Message saisi par le client, à conserver mot pour mot.");
  assert.equal(message.value, fields.message);
});
