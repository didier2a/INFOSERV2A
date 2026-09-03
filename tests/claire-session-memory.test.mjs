import assert from "node:assert/strict";
import test from "node:test";

import {
  SESSION_MEMORY_KEY,
  canSubmitQuote,
  describeQuoteChecklist,
  extractFactsFromUtterance,
  formatCaptionContext,
  formatMemoryBriefing,
  hasMemoryContent,
  loadSessionMemory,
  quoteQuestionnaire,
  rememberTurn,
  saveSessionMemory,
  shouldAnnounceQuoteTruth,
  shouldShowQuoteQuest
} from "../assets/js/claire-session-memory.mjs";

function memoryStorage(seed = null) {
  const data = new Map();
  if (seed) data.set(SESSION_MEMORY_KEY, JSON.stringify(seed));
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, value);
    },
    removeItem(key) {
      data.delete(key);
    }
  };
}

test("extrait un e-mail dicté avec arobase et une commune corsée", () => {
  const spoken = extractFactsFromUtterance(
    "Didier, Porto-Vecchio, mon mail c'est infoserv2a arobase gmail point com, je veux une caméra"
  );
  assert.equal(spoken.email, "infoserv2a@gmail.com");
  assert.equal(spoken.city, "Porto-Vecchio");
  assert.equal(spoken.service, "videosurveillance");
  assert.equal(spoken.name, undefined);
});

test("extrait nom, téléphone, e-mail, commune et besoin sans inventer", () => {
  const facts = extractFactsFromUtterance(
    "Je m’appelle Didier Aouizerate, j’habite Porto-Vecchio, mon e-mail est didier@example.com, mon numéro est 06 12 34 56 78. Je veux un site internet pour mon commerce."
  );
  assert.equal(facts.name, "Didier Aouizerate");
  assert.equal(facts.city, "Porto-Vecchio");
  assert.equal(facts.email, "didier@example.com");
  assert.equal(facts.phone, "06 12 34 56 78");
  assert.equal(facts.service, "creation-site-web");
  assert.match(facts.need, /site internet/);
});

test("la mémoire de session survit à une déconnexion simulée", () => {
  const storage = memoryStorage();
  rememberTurn(
    "user",
    "Je m’appelle Claire Test, j’habite Bonifacio, mon e-mail est claire@example.com. Mon PC ne démarre plus.",
    storage
  );
  rememberTurn("companion", "Je note. On peut ouvrir le dépannage ou préparer un devis.", storage);
  const afterDisconnect = loadSessionMemory(storage);
  assert.equal(afterDisconnect.visitor.name, "Claire Test");
  assert.equal(afterDisconnect.visitor.city, "Bonifacio");
  assert.equal(afterDisconnect.visitor.email, "claire@example.com");
  assert.match(afterDisconnect.need, /PC ne démarre plus/);
  assert.equal(afterDisconnect.turns.length, 2);
  const briefing = formatMemoryBriefing(afterDisconnect);
  assert.match(briefing, /Claire Test/);
  assert.match(briefing, /Bonifacio/);
  assert.match(briefing, /Ne redemande pas/);
  assert.equal(hasMemoryContent(afterDisconnect), true);
});

test("l’encart de contexte montre la page et le questionnaire de devis", () => {
  const memory = {
    visitor: { name: "Marie Rossi", phone: "", email: "", city: "Porto-Vecchio" },
    service: "videosurveillance",
    need: "Caméra 4G",
    turns: []
  };
  const context = formatCaptionContext({
    page: { title: "Demande de devis", id: "quote" },
    memory
  });
  assert.match(context, /Demande de devis/);
  assert.match(context, /Marie Rossi/);
  assert.match(context, /il manque/);
  const quest = quoteQuestionnaire(memory);
  assert.equal(quest.find((item) => item.id === "name").value, "Marie Rossi");
  assert.equal(quest.find((item) => item.id === "phone").value, "");
});

test("hors devis, CONTEXTE n’affiche que la page visible", () => {
  const memory = {
    visitor: { name: "Marie Rossi", phone: "", email: "", city: "Porto-Vecchio" },
    service: "videosurveillance",
    need: "Caméra 4G",
    turns: []
  };
  const contact = formatCaptionContext({
    page: { id: "contact", title: "Contact" },
    section: { label: "intro" },
    memory
  });
  assert.equal(contact, "Contact · intro");
  assert.doesNotMatch(contact, /Marie|vidéosurveillance|videosurveillance|il manque/i);

  const home = formatCaptionContext({
    page: { id: "home", title: "Accueil InfoServ2A" },
    memory
  });
  assert.equal(home, "Accueil InfoServ2A");
});

test("un e-mail ou « envoie le devis » n’écrase pas le besoin déjà dit", () => {
  const storage = memoryStorage();
  rememberTurn("user", "Je veux une caméra 4G pour un hangar isolé à Porto-Vecchio.", storage);
  const afterEmail = rememberTurn("user", "Mon e-mail est didier@example.com", storage);
  assert.match(afterEmail.need, /caméra 4G/);
  assert.equal(afterEmail.visitor.email, "didier@example.com");
  const afterSend = rememberTurn("user", "Envoie le devis", storage);
  assert.match(afterSend.need, /caméra 4G/);
  assert.equal(canSubmitQuote(afterSend), false);
});

test("une conversation de devis doit afficher la vérité même en chat", () => {
  assert.equal(shouldAnnounceQuoteTruth("Je m’appelle Didier", {}, ""), true);
  assert.equal(shouldAnnounceQuoteTruth("Bonjour", {}, ""), false);
  assert.equal(shouldAnnounceQuoteTruth("ok", {
    visitor: { name: "Didier", phone: "", email: "", city: "" }
  }, ""), true);
});

test("le checklist dit à l’oral ce qui manque et ne prétend pas que c’est parti", () => {
  const incomplete = describeQuoteChecklist({
    visitor: { name: "Didier", phone: "", email: "", city: "Porto-Vecchio" },
    service: "videosurveillance",
    need: "Caméra 4G"
  });
  assert.equal(incomplete.complete, false);
  assert.match(incomplete.speech, /n’envoie pas/);
  assert.match(incomplete.speech, /téléphone/);
  assert.match(incomplete.speech, /e-mail/);
  assert.doesNotMatch(incomplete.speech, /bien été envoyé|c’est parti/);
  const complete = describeQuoteChecklist({
    visitor: {
      name: "Marie Rossi",
      phone: "07 45 15 60 76",
      email: "marie@example.com",
      city: "Porto-Vecchio"
    },
    service: "videosurveillance",
    need: "Caméra 4G"
  });
  assert.equal(complete.complete, true);
  assert.match(complete.speech, /complet/);
  assert.match(complete.speech, /envoie le devis/);
  assert.doesNotMatch(complete.speech, /bien été envoyé/);
});

test("un devis ne part pas tant que les coordonnées manquent", () => {
  const storage = memoryStorage();
  const memory = rememberTurn("user", "Je voudrais un devis pour une caméra.", storage);
  assert.equal(canSubmitQuote(memory), false);
  const complete = saveSessionMemory({
    ...memory,
    visitor: {
      name: "Marie Rossi",
      phone: "07 45 15 60 76",
      email: "marie@example.com",
      city: "Porto-Vecchio"
    },
    service: "videosurveillance",
    need: "Caméra sans fibre pour un hangar."
  }, storage);
  assert.equal(canSubmitQuote(complete), true);
});

test("un marqueur interne LiveAvatar n’alimente pas la mémoire ni le questionnaire", () => {
  const storage = memoryStorage();
  const leaked = rememberTurn(
    "user",
    "[INFOSERV2A_PAGE_CONTEXT]\nOnglet visible : Accueil InfoServ2A. Vidéosurveillance. Appareil : téléphone.",
    storage
  );
  assert.equal(leaked.service, "");
  assert.equal(leaked.turns.length, 0);
  assert.equal(shouldShowQuoteQuest(leaked, "home"), false);
  assert.equal(shouldShowQuoteQuest({ service: "videosurveillance" }, "home"), false);
  assert.equal(shouldShowQuoteQuest({ need: "caméra 4G" }, "home"), false);
  assert.equal(shouldShowQuoteQuest({ visitor: { name: "Marie" } }, "home"), true);
  assert.equal(shouldShowQuoteQuest({ visitor: { name: "Marie" } }, "quote"), true);
});
