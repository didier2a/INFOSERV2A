import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CLAIRE_ACTION_MODES,
  actionDraftReady,
  confirmationPhrase,
  interviewUpdate,
  isExactSendConfirmation,
  requestedActionMode,
  shouldDebounceVoiceCommand
} from "../assets/js/claire-actions-v1.mjs";
import { planCommand } from "../assets/js/claire-runtime-v2.mjs";
import {
  SESSION_MEMORY_KEY,
  clearSessionMemory,
  formatClaireActionCanvas,
  loadPersistentResumeCandidate,
  loadSessionMemory,
  rememberTurn,
  resumePersistentMemory,
  saveSessionMemory,
  shouldAnnounceQuoteTruth
} from "../assets/js/claire-session-memory.mjs";

const knowledge = JSON.parse(await readFile(new URL("../data/site-knowledge.json", import.meta.url), "utf8"));
const manifest = JSON.parse(await readFile(new URL("../data/claire-capabilities.json", import.meta.url), "utf8"));

function storage(seed = null) {
  const values = new Map();
  if (seed) values.set(SESSION_MEMORY_KEY, JSON.stringify(seed));
  return {
    getItem(key) { return values.get(key) || null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); }
  };
}

function completeQuoteMemory() {
  return {
    visitor: {
      name: "Marie Rossi",
      phone: "06 12 34 56 78",
      email: "marie@example.com",
      city: "Porto-Vecchio"
    },
    status: "Professionnel",
    service: "videosurveillance",
    need: "Caméras 4G pour un commerce",
    constraints: "sans fibre, enregistrement 15 jours",
    urgency: "cette semaine",
    turns: [{ role: "user", text: "Je veux des caméras 4G pour mon commerce sans fibre, avec quinze jours d’enregistrement.", at: 1 }]
  };
}

test("V1 démarre en conseil et n’ouvre devis/contact que sur demande explicite", () => {
  assert.equal(requestedActionMode("Mon Wi-Fi coupe le soir"), "");
  assert.equal(requestedActionMode("Je voudrais un devis"), CLAIRE_ACTION_MODES.DEVIS);
  assert.equal(requestedActionMode("Je veux prendre contact"), CLAIRE_ACTION_MODES.CONTACT);
});

test("V1 envoie dès la première confirmation exacte si le brouillon est prêt", () => {
  const memory = completeQuoteMemory();
  for (const ambiguous of ["c’est bon", "vas-y", "confirme", "envoie"]) {
    assert.equal(isExactSendConfirmation(ambiguous, "devis"), false);
    const plan = planCommand(ambiguous, knowledge, manifest, {
      memory,
      pageId: "quote",
      confirmation: { armed: true, kind: "devis" }
    });
    assert.equal(plan.steps.some((step) => step.tool === "submit_quote"), false);
  }

  const exact = confirmationPhrase("devis");
  const unarmed = planCommand(exact, knowledge, manifest, {
    memory,
    pageId: "quote",
    confirmation: { armed: false, kind: "devis" }
  });
  assert.equal(unarmed.steps.some((step) => step.tool === "submit_quote"), true);
  assert.doesNotMatch(unarmed.response, /dites exactement|relisez-la/i);

  const armed = planCommand(exact, knowledge, manifest, {
    memory,
    pageId: "quote",
    confirmation: { armed: true, kind: "devis" }
  });
  assert.equal(armed.steps.some((step) => step.tool === "submit_quote"), true);
});

test("V1 tolère l’article ASR, mais jamais une confirmation vague", () => {
  assert.equal(isExactSendConfirmation("Oui, envoie la demande de devis", "devis"), true);
  assert.equal(isExactSendConfirmation("Oui, envoie demande de devis", "devis"), true);
  assert.equal(isExactSendConfirmation("envoie de suite", "devis"), false);
  assert.equal(isExactSendConfirmation("c’est bon", "devis"), false);
});

test("V1 ne déduplique pas deux confirmations exactes à moins de quatre secondes", () => {
  assert.equal(shouldDebounceVoiceCommand(
    "Oui, envoie la demande de devis",
    "devis",
    {
      lastCommand: "oui, envoie la demande de devis",
      lastCommandAt: 1_000,
      now: 2_000,
      runtimeActive: false
    }
  ), false);
  assert.equal(shouldDebounceVoiceCommand(
    "Montre la vidéosurveillance",
    "conseil",
    {
      lastCommand: "montre la vidéosurveillance",
      lastCommandAt: 1_000,
      now: 2_000,
      runtimeActive: false
    }
  ), true);
});

test("V1 écrit exactement le canevas fixe de six lignes", () => {
  const canvas = formatClaireActionCanvas(completeQuoteMemory());
  const lines = canvas.split("\n");
  assert.equal(lines.length, 6);
  assert.deepEqual(lines.map((line) => line.split(":")[0].trim()), [
    "1. Qui",
    "2. Statut (pro/particulier)",
    "3. Besoin",
    "4. Lieu",
    "5. Contraintes",
    "6. Urgence"
  ]);
  assert.match(canvas, /Marie Rossi/);
  assert.match(canvas, /Porto-Vecchio/);
  assert.match(canvas, /sans fibre/);
  assert.equal(actionDraftReady("devis", completeQuoteMemory()), true);
  assert.match(interviewUpdate("devis", completeQuoteMemory()).speech, /dites exactement/i);
});

test("V1 n’annonce jamais la checklist hors demande explicite", () => {
  assert.equal(shouldAnnounceQuoteTruth("Je m’appelle Marie", completeQuoteMemory(), "quote"), false);
  assert.equal(shouldAnnounceQuoteTruth("Je m’appelle Marie", completeQuoteMemory(), "quote", true), true);
});

test("V1 propose la reprise locale et la copie en session reste en conseil", () => {
  const tab = storage();
  const device = storage();
  saveSessionMemory(completeQuoteMemory(), device);
  assert.equal(loadSessionMemory(tab).turns.length, 0);
  assert.ok(loadPersistentResumeCandidate(device));
  const resumed = resumePersistentMemory(tab, device);
  assert.equal(resumed.visitor.name, "Marie Rossi");
  assert.equal(loadSessionMemory(tab).visitor.name, "Marie Rossi");
  clearSessionMemory(tab, device);
  assert.equal(loadPersistentResumeCandidate(device), null);
});

test("V1 conserve tout le fil de la session", () => {
  const tab = storage();
  for (let index = 0; index < 80; index += 1) {
    rememberTurn("user", `Tour détaillé numéro ${index} au sujet du réseau`, tab);
  }
  assert.equal(loadSessionMemory(tab).turns.length, 80);
});
