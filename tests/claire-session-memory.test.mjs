import assert from "node:assert/strict";
import test from "node:test";

import {
  SESSION_MEMORY_KEY,
  canSubmitQuote,
  describeQuoteChecklist,
  extractFactsFromUtterance,
  formatCaptionContext,
  formatMemoryBriefing,
  formatLiveMemoryCue,
  hasMemoryContent,
  isPlaceholderNeed,
  loadSessionMemory,
  quoteQuestionnaire,
  quoteDraftSignature,
  rememberTurn,
  rememberSuccessfulSend,
  beginNewQuoteAfterSend,
  isSameDraftAlreadySent,
  saveSessionMemory,
  shouldAnnounceQuoteTruth,
  shouldShowQuoteQuest,
  mergeMemories,
  archiveCurrentVisit,
  hydrateQuoteMemoryFromForm,
  canSubmitContact,
  quoteExtrasFromDocument,
  synthesizeMailBody,
  emailDraftFromMemory,
  SYNTHESIS_LEAD,
  isClaireSynthesis,
  looksLikeConversationDump
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

test("la mémoire survit à un rafraîchissement et à une autre session du même navigateur", () => {
  const tab = memoryStorage();
  const device = memoryStorage();
  rememberTurn("user", "Je m’appelle Didier Aouizerate, j’habite Porto-Vecchio.", tab, device);
  const afterRefresh = loadSessionMemory(memoryStorage(), device);
  assert.equal(afterRefresh.visitor.name, "Didier Aouizerate");
  assert.equal(afterRefresh.visitor.city, "Porto-Vecchio");
  const archived = archiveCurrentVisit(tab, device);
  assert.equal(archived.visits.length, 1);
  assert.match(archived.visits[0].summary, /Didier/);
  const later = loadSessionMemory(memoryStorage(), device);
  assert.equal(later.visitor.name, "Didier Aouizerate");
  assert.equal(later.visits.length, 1);
  const briefing = formatMemoryBriefing(later);
  assert.match(briefing, /même ordinateur|navigateur/i);
  assert.match(briefing, /Visites précédentes/);
  assert.match(briefing, /Ne refais pas un accueil/);
});

test("deux mémoires du même client se fusionnent sans perdre les coordonnées", () => {
  const older = saveSessionMemory({
    visitor: { name: "Didier", phone: "07 45 15 60 76", email: "", city: "" },
    need: "Caméra 4G",
    turns: [{ role: "user", text: "Je veux une caméra", at: 1 }]
  }, memoryStorage());
  const newer = saveSessionMemory({
    visitor: { name: "Didier", phone: "", email: "infoserv2a@gmail.com", city: "Porto-Vecchio" },
    service: "videosurveillance",
    turns: [{ role: "companion", text: "Je note la caméra.", at: 2 }]
  }, memoryStorage());
  const merged = mergeMemories(newer, older);
  assert.equal(merged.visitor.name, "Didier");
  assert.equal(merged.visitor.phone, "07 45 15 60 76");
  assert.equal(merged.visitor.email, "infoserv2a@gmail.com");
  assert.equal(merged.visitor.city, "Porto-Vecchio");
  assert.equal(merged.turns.length, 2);
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
  }, ""), false);
  assert.equal(shouldAnnounceQuoteTruth("c’est tout", {
    visitor: { name: "Didier", phone: "", email: "", city: "" }
  }, "quote"), true);
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
  assert.match(complete.speech, /transmettre la demande/);
  assert.doesNotMatch(complete.speech, /envoie le devis|bien été envoyé/);
  const sentMemory = completeMemory();
  const sent = describeQuoteChecklist({
    ...sentMemory,
    lastSend: {
      sent: true,
      kind: "devis",
      inbox: "marie@example.com",
      signature: quoteDraftSignature(sentMemory)
    }
  });
  assert.equal(sent.alreadySent, true);
  assert.match(sent.speech, /déjà été envoyée/);
  assert.doesNotMatch(sent.speech, /Confirmez/);
});

function completeMemory() {
  return {
    visitor: {
      name: "Marie Rossi",
      phone: "07 45 15 60 76",
      email: "marie@example.com",
      city: "Porto-Vecchio"
    },
    service: "videosurveillance",
    need: "Caméra 4G"
  };
}

test("un formulaire déjà rempli complète la mémoire et permet l’envoi", () => {
  const storage = memoryStorage({
    version: 1,
    visitor: { name: "Didier", phone: "", email: "", city: "" },
    need: "",
    service: "",
    turns: []
  });
  const doc = {
    querySelector(selector) {
      const values = {
        "#devis-name": "Didier Aouizerate",
        "#devis-phone": "07 45 15 60 76",
        "#devis-email": "infoserv2a@gmail.com",
        "#devis-city": "Porto-Vecchio",
        "#devis-service": "videosurveillance",
        "#devis-description": "Caméra 4G pour un hangar"
      };
      return values[selector] ? { value: values[selector] } : null;
    }
  };
  const memory = hydrateQuoteMemoryFromForm(storage, doc);
  assert.equal(canSubmitQuote(memory), true);
  assert.equal(memory.visitor.email, "infoserv2a@gmail.com");
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

test("la mémoire live reste courte pour ne pas bloquer l’envoi", () => {
  const memory = saveSessionMemory({
    visitor: { name: "Didier Aouizerate", phone: "07 45 15 60 76", email: "didier@example.com", city: "Porto-Vecchio" },
    service: "videosurveillance",
    need: "Caméra 4G pour un hangar isolé",
    turns: Array.from({ length: 8 }, (_, index) => ({
      role: index % 2 ? "companion" : "user",
      text: `Tour ${index} avec beaucoup de détails inutiles à réciter à voix haute pendant trois minutes.`,
      at: index + 1
    }))
  }, memoryStorage());
  const cue = formatLiveMemoryCue(memory);
  assert.match(cue, /Didier Aouizerate/);
  assert.match(cue, /Je reprends/);
  assert.doesNotMatch(cue, /Tour 7/);
  assert.ok(cue.length < 420);
});

test("un formulaire contact rempli hors conversation alimente la mémoire", () => {
  const storage = memoryStorage();
  const doc = {
    querySelector(selector) {
      const values = {
        "#contact-name": "Marie Rossi",
        "#contact-email": "marie@example.com",
        "#contact-phone": "07 45 15 60 76",
        "#contact-message": "Je veux un site vitrine."
      };
      return values[selector] ? { value: values[selector] } : null;
    }
  };
  const memory = hydrateQuoteMemoryFromForm(storage, doc);
  assert.equal(memory.visitor.name, "Marie Rossi");
  assert.equal(memory.visitor.email, "marie@example.com");
  assert.equal(canSubmitContact(memory), true);
});

test("le placeholder « À préciser à l’oral » n’est pas un besoin", () => {
  assert.equal(isPlaceholderNeed("À préciser à l’oral"), true);
  assert.equal(isPlaceholderNeed("A preciser a l'oral"), true);
  const doc = {
    querySelector(selector) {
      const values = {
        "#devis-name": "Didier Aouizerate",
        "#devis-phone": "07 45 15 60 76",
        "#devis-email": "infoserv2a@gmail.com",
        "#devis-city": "Porto-Vecchio",
        "#devis-service": "videosurveillance",
        "#devis-description": "À préciser à l'oral"
      };
      return values[selector] ? { value: values[selector] } : null;
    }
  };
  const extras = quoteExtrasFromDocument(doc);
  assert.equal(extras.description, "");
});

test("après un envoi, un nouveau besoin oral n’est plus le devis déjà envoyé", () => {
  const storage = memoryStorage();
  const persistent = memoryStorage();
  let memory = saveSessionMemory({
    visitor: {
      name: "Didier",
      phone: "06 12 34 56 78",
      email: "didier@exemple.fr",
      city: "Lyon"
    },
    service: "videosurveillance",
    need: "Caméra 4G pour le commerce",
    turns: [{ role: "user", text: "J’ai besoin d’une caméra 4G pour le commerce.", at: 1 }]
  }, storage, persistent);
  const signature = quoteDraftSignature(memory);
  memory = rememberSuccessfulSend({
    kind: "devis",
    inbox: "contact@infoserv2a.pro",
    signature
  }, storage, persistent);

  assert.equal(isSameDraftAlreadySent(memory), true);
  assert.match(formatMemoryBriefing(memory), /clos/i);

  memory = beginNewQuoteAfterSend(storage, persistent);

  assert.equal(memory.need, "");
  assert.equal(memory.service, "");
  assert.equal(memory.turns.length, 0);
  assert.equal(memory.visitor.name, "Didier");
  assert.equal(memory.visitor.email, "didier@exemple.fr");
  assert.equal(memory.lastSend.kind, "devis");
  assert.ok(memory.quoteEpoch >= 1);
  assert.equal(isSameDraftAlreadySent(memory), false);
  assert.match(formatLiveMemoryCue(memory), /nouveau devis/i);
  assert.match(formatMemoryBriefing(memory), /Devis en cours : aucun/);
  assert.doesNotMatch(formatMemoryBriefing(memory), /Besoin en cours :/);
  assert.ok((memory.visits || []).some((visit) => /caméra|camera/i.test(`${visit.summary} ${visit.need}`)));

  const staleForm = hydrateQuoteMemoryFromForm(storage, {
    querySelector(selector) {
      const values = {
        "#devis-name": "Didier",
        "#devis-phone": "06 12 34 56 78",
        "#devis-email": "didier@exemple.fr",
        "#devis-city": "Lyon",
        "#devis-service": "videosurveillance",
        "#devis-description": "Caméra 4G pour le commerce"
      };
      return values[selector] ? { value: values[selector] } : null;
    }
  });
  assert.equal(staleForm.need, "", "le formulaire resté rempli ne doit pas réinjecter l’ancien devis");

  memory = rememberTurn("user", "Je veux un site internet pour mon commerce.", storage, persistent);
  assert.match(memory.need, /site internet/i);
  assert.equal(memory.service, "creation-site-web");
  assert.equal(isSameDraftAlreadySent(memory), false);
  assert.equal(canSubmitQuote(memory), true);
  assert.equal(describeQuoteChecklist(memory).alreadySent, false);
});

test("une époque de devis plus récente n’est pas écrasée par l’ancien besoin stocké", () => {
  const merged = mergeMemories({
    updatedAt: 10,
    quoteEpoch: 1,
    visitor: { name: "Didier", phone: "06 12 34 56 78", email: "didier@exemple.fr", city: "Lyon" },
    need: "",
    service: "",
    turns: []
  }, {
    updatedAt: 20,
    quoteEpoch: 0,
    visitor: { name: "Didier", phone: "06 12 34 56 78", email: "didier@exemple.fr", city: "Lyon" },
    need: "Caméra 4G pour le commerce",
    service: "videosurveillance",
    turns: [{ role: "user", text: "Caméra 4G", at: 1 }]
  });
  assert.equal(merged.need, "");
  assert.equal(merged.service, "");
  assert.equal(merged.quoteEpoch, 1);
  assert.equal(merged.turns.length, 0);
  assert.equal(merged.visitor.name, "Didier");
});

test("Claire rédige le corps du mail comme une synthèse de l’échange", () => {
  const storage = memoryStorage();
  rememberTurn("user", "Bonjour", storage);
  rememberTurn("user", "Je veux une caméra 4G pour un hangar isolé à Porto-Vecchio.", storage);
  rememberTurn("user", "Mon e-mail est didier@example.com", storage);
  rememberTurn("user", "Et un enregistrement de quinze jours.", storage);
  rememberTurn("user", "Envoie le devis", storage);
  const body = synthesizeMailBody(loadSessionMemory(storage));
  assert.match(body, new RegExp(SYNTHESIS_LEAD.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(body, /hangar isolé/);
  assert.match(body, /quinze jours/);
  assert.match(body, /Le visiteur a indiqué qu’il souhaite/);
  assert.doesNotMatch(body, /Envoie le devis/);
  assert.doesNotMatch(body, /• /);
  assert.match(body, /vidéosurveillance|videosurveillance/i);
  assert.equal((body.match(/caméra 4G/gi) || []).length, 1);

  const draft = emailDraftFromMemory(loadSessionMemory(storage));
  assert.equal(draft.to, "didier@example.com");
  assert.match(draft.message, /hangar isolé/);
  assert.doesNotMatch(draft.to, /contact@/);
});

test("le corps du mail n’imprime jamais la conversation avec Claire", () => {
  const storage = memoryStorage();
  rememberTurn("user", "Bonjour Claire, comment tu vas ?", storage);
  rememberTurn("companion", "Bonjour. Je vous écoute pour votre besoin informatique.", storage);
  rememberTurn("user", "Je veux une caméra 4G pour un hangar isolé à Porto-Vecchio.", storage);
  rememberTurn("companion", "Très bien, je note une vidéosurveillance 4G. Souhaitez-vous aussi une durée d’enregistrement ?", storage);
  rememberTurn("user", "Oui et un enregistrement de quinze jours.", storage);
  rememberTurn("companion", "D’accord. Il me faut aussi votre e-mail pour transmettre le devis.", storage);
  rememberTurn("user", "Mon e-mail est didier@example.com", storage);
  const memory = rememberTurn("user", "Envoie le devis", storage);
  const body = synthesizeMailBody(memory, {
    description: [
      "Vous : Bonjour Claire, comment tu vas ?",
      "Claire : Bonjour. Je vous écoute pour votre besoin informatique.",
      "Vous : Je veux une caméra 4G pour un hangar isolé à Porto-Vecchio.",
      "Claire : Très bien, je note une vidéosurveillance 4G."
    ].join("\n")
  });
  assert.match(body, /Synthèse de l’échange/);
  assert.match(body, /Le visiteur a indiqué qu’il souhaite/);
  assert.match(body, /hangar isolé/);
  assert.match(body, /quinze jours/);
  assert.doesNotMatch(body, /Bonjour Claire/);
  assert.doesNotMatch(body, /comment tu vas/);
  assert.doesNotMatch(body, /Je vous écoute/);
  assert.doesNotMatch(body, /Très bien, je note/);
  assert.doesNotMatch(body, /Vous\s*:/);
  assert.doesNotMatch(body, /Claire\s*:/);
  assert.doesNotMatch(body, /• /);
  assert.doesNotMatch(body, /Je veux une caméra/);
  assert.equal(looksLikeConversationDump("Vous : bonjour\nClaire : je vous écoute", memory), true);
  assert.equal(isClaireSynthesis(body), true);

  const hydrated = hydrateQuoteMemoryFromForm(storage, {
    querySelector(selector) {
      return selector === "#devis-description" ? { value: body } : null;
    }
  });
  assert.doesNotMatch(hydrated.need || "", /Synthèse de l’échange/);
  assert.doesNotMatch(hydrated.need || "", /Bonjour Claire/);
});

test("un besoin déjà noté devient le corps du devis même sans tours supplémentaires", () => {
  const body = synthesizeMailBody({
    visitor: { name: "Marie", phone: "", email: "marie@example.com", city: "" },
    service: "creation-site-web",
    need: "Site vitrine pour mon commerce",
    turns: []
  });
  assert.match(body, /site vitrine pour mon commerce/i);
  assert.match(body, /Le visiteur a indiqué qu’il souhaite/);
  assert.match(body, /Synthèse de l’échange/);
  assert.doesNotMatch(body, /• /);
});
