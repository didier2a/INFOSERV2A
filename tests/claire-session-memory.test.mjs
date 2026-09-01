import assert from "node:assert/strict";
import test from "node:test";

import {
  SESSION_MEMORY_KEY,
  canSubmitQuote,
  extractFactsFromUtterance,
  formatCaptionContext,
  formatMemoryBriefing,
  hasMemoryContent,
  loadSessionMemory,
  quoteQuestionnaire,
  rememberTurn,
  saveSessionMemory
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
