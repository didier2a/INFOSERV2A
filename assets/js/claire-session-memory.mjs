export const SESSION_MEMORY_KEY = "infoserv2a.claire.memory";
export const QUOTE_REQUIRED_FIELDS = Object.freeze([
  "name",
  "phone",
  "email",
  "city",
  "service",
  "description"
]);

const MAX_TURNS = 24;
const MAX_TURN_CHARS = 320;
export const QUOTE_FIELD_LABELS = Object.freeze({
  name: "votre nom",
  phone: "votre téléphone",
  email: "votre e-mail",
  city: "votre commune",
  service: "le type de service",
  description: "la description du besoin",
  message: "le message"
});

const KNOWN_CITIES = Object.freeze([
  ["porto-vecchio", "Porto-Vecchio"],
  ["porto vecchio", "Porto-Vecchio"],
  ["bonifacio", "Bonifacio"],
  ["propriano", "Propriano"],
  ["sartene", "Sartène"],
  ["ajaccio", "Ajaccio"],
  ["bastia", "Bastia"],
  ["corte", "Corte"],
  ["figari", "Figari"],
  ["lecci", "Lecci"]
]);

function now() {
  return Date.now();
}

function compact(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function folded(value = "") {
  return compact(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, " ");
}

export function emptyMemory() {
  return {
    version: 1,
    startedAt: 0,
    updatedAt: 0,
    visitor: { name: "", phone: "", email: "", city: "" },
    need: "",
    service: "",
    lastPath: "",
    lastTitle: "",
    turns: [],
    summary: ""
  };
}

function normalizeVisitor(visitor = {}) {
  return {
    name: compact(visitor.name),
    phone: compact(visitor.phone),
    email: compact(visitor.email),
    city: compact(visitor.city)
  };
}

export function normalizeMemory(value = {}) {
  const fallback = emptyMemory();
  const turns = Array.isArray(value.turns)
    ? value.turns
      .map((turn) => ({
        role: turn?.role === "user" ? "user" : "companion",
        text: compact(turn?.text).slice(0, MAX_TURN_CHARS),
        at: Number(turn?.at) || 0
      }))
      .filter((turn) => turn.text)
      .slice(-MAX_TURNS)
    : [];
  return {
    version: 1,
    startedAt: Number(value.startedAt) || 0,
    updatedAt: Number(value.updatedAt) || 0,
    visitor: normalizeVisitor(value.visitor),
    need: compact(value.need).slice(0, 280),
    service: compact(value.service).slice(0, 80),
    lastPath: compact(value.lastPath).slice(0, 160),
    lastTitle: compact(value.lastTitle).slice(0, 120),
    turns,
    summary: compact(value.summary).slice(0, 400) || fallback.summary
  };
}

export function loadSessionMemory(storage = globalThis.sessionStorage) {
  try {
    const raw = storage?.getItem?.(SESSION_MEMORY_KEY);
    if (!raw) return emptyMemory();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1) return emptyMemory();
    return normalizeMemory(parsed);
  } catch {
    return emptyMemory();
  }
}

export function saveSessionMemory(memory, storage = globalThis.sessionStorage) {
  const next = normalizeMemory(memory);
  next.updatedAt = now();
  if (!next.startedAt) next.startedAt = next.updatedAt;
  next.summary = buildSummary(next);
  try {
    storage?.setItem?.(SESSION_MEMORY_KEY, JSON.stringify(next));
  } catch {
    /* sessionStorage peut être bloqué ; Claire reste utilisable. */
  }
  return next;
}

export function inferService(text = "") {
  const query = folded(text);
  if (!query) return "";
  if (/\bnis\s*2\b/.test(query)) return "audit-nis2";
  if (/\b(camera|cameras|videosurveillance|alarme)\b/.test(query)) return "videosurveillance";
  if (/\b(site web|site internet|creer un site|refonte|hebergement)\b/.test(query)) return "creation-site-web";
  if (/\b(recuperation|disque|donnees perdues|ssd|hdd)\b/.test(query)) return "recuperation-donnees";
  if (/\b(cyber|ransomware|pare[- ]feu|antivirus|intelligence artificielle|\bia\b)\b/.test(query)) {
    return "cybersecurite-ia";
  }
  if (/\b(maintenance a distance|prise en main)\b/.test(query)) return "maintenance-distance";
  if (/\b(a domicile|configuration a domicile)\b/.test(query)) return "configuration-domicile";
  return "";
}

function isCommandUtterance(text = "") {
  const query = folded(text);
  return /\b(envoie le devis|envoie un mail|envoie un e-mail|c est (parti|envoye|valide|tout|bon|pret)|bien (ete )?envoye)\b/.test(query)
    && query.length < 56;
}

function isContactOnlyUtterance(text, facts = {}) {
  const hasContact = Boolean(facts.email || facts.phone || facts.name || facts.city);
  if (!hasContact) return false;
  const query = folded(text);
  const hasNeedLanguage = Boolean(facts.service)
    || /\b(besoin|probleme|camera|installer|depanner|devis pour|je voudrais|je veux)\b/.test(query);
  return !hasNeedLanguage && query.length < 96;
}

function isThinUtterance(text = "") {
  const query = folded(text);
  if (!query) return true;
  if (query.length < 12) return true;
  if (isCommandUtterance(text)) return true;
  return /^(bonjour|bonsoir|merci|oui|non|ok|okay|d accord|appelle|appeler|appelez)\b/.test(query)
    && query.length < 28;
}

export function joinFrenchList(items = []) {
  const labels = items.map((item) => compact(item)).filter(Boolean);
  if (!labels.length) return "";
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} et ${labels.at(-1)}`;
}

function extractSpokenEmail(text = "") {
  const raw = compact(text);
  const direct = raw.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/);
  if (direct) return direct[0];
  const spoken = folded(text).match(
    /([a-z0-9._+-]+)\s+(?:arobase|arrobase|at)\s+([a-z0-9-]+)(?:\s+(?:point|dot)\s+([a-z]{2,})|\.([a-z]{2,}))/
  );
  if (!spoken) return "";
  const tld = spoken[3] || spoken[4];
  return tld ? `${spoken[1]}@${spoken[2]}.${tld}` : "";
}

function extractKnownCity(text = "") {
  const query = folded(text);
  const hit = KNOWN_CITIES.find(([needle]) => new RegExp(`\\b${needle}\\b`).test(query));
  return hit ? hit[1] : "";
}

export function extractFactsFromUtterance(text = "") {
  const raw = compact(text);
  const facts = {};
  if (!raw) return facts;

  const email = extractSpokenEmail(raw);
  if (email) facts.email = email;

  const phone = raw.match(/(?:\+33|0033|0)\s*[1-9](?:[\s.-]?\d{2}){4}/);
  if (phone) facts.phone = compact(phone[0]);

  const name = raw.match(/(?:je m['’]appelle|mon nom est|moi c['’]est|je suis(?!\s+(?:de|à|a|au|aux|en)\b))\s+([A-Za-zÀ-ÿ'’-]+(?:\s+[A-Za-zÀ-ÿ'’-]+){0,2})/i);
  if (name) facts.name = compact(name[1]);

  const city = raw.match(/(?:j['’]habite(?:\s+(?:à|a|au|aux|en))?\s+|je suis de\s+|je vis (?:à|a)\s+)([A-Za-zÀ-ÿ'’-]+(?:[- ][A-Za-zÀ-ÿ'’-]+){0,2})/i);
  if (city) facts.city = compact(city[1]);
  else if (extractKnownCity(raw)) facts.city = extractKnownCity(raw);

  const service = inferService(raw);
  if (service) facts.service = service;
  if (!isThinUtterance(raw) && !isContactOnlyUtterance(raw, facts)) {
    facts.need = raw.slice(0, 280);
  }
  return facts;
}

export function mergeFacts(memory, facts = {}) {
  const next = normalizeMemory(memory);
  next.visitor = normalizeVisitor({
    ...next.visitor,
    ...Object.fromEntries(
      ["name", "phone", "email", "city"]
        .filter((key) => compact(facts[key]))
        .map((key) => [key, facts[key]])
    )
  });
  if (compact(facts.service)) next.service = compact(facts.service).slice(0, 80);
  if (compact(facts.need)) next.need = compact(facts.need).slice(0, 280);
  next.summary = buildSummary(next);
  return next;
}

export function rememberTurn(role, text, storage = globalThis.sessionStorage) {
  const clean = compact(text).slice(0, MAX_TURN_CHARS);
  if (!clean || /\[INFOSERV2A_[A-Z0-9_]+\]/.test(clean)) return loadSessionMemory(storage);
  let memory = loadSessionMemory(storage);
  memory.turns.push({
    role: role === "user" ? "user" : "companion",
    text: clean,
    at: now()
  });
  if (memory.turns.length > MAX_TURNS) memory.turns = memory.turns.slice(-MAX_TURNS);
  if (role === "user") memory = mergeFacts(memory, extractFactsFromUtterance(clean));
  return saveSessionMemory(memory, storage);
}

export function rememberPage(path, title, storage = globalThis.sessionStorage) {
  const memory = loadSessionMemory(storage);
  if (path) memory.lastPath = compact(path).slice(0, 160);
  if (title) memory.lastTitle = compact(title).slice(0, 120);
  return saveSessionMemory(memory, storage);
}

export function quotePrefillFromMemory(memory = {}, extras = {}) {
  const visitor = normalizeVisitor(memory.visitor);
  return {
    name: compact(extras.name) || visitor.name,
    phone: compact(extras.phone) || visitor.phone,
    email: compact(extras.email) || visitor.email,
    city: compact(extras.city) || visitor.city,
    service: compact(extras.service) || compact(memory.service),
    description: compact(extras.description) || compact(memory.need) || compact(extras.fallbackDescription)
  };
}

export function missingQuoteFields(memory = {}, extras = {}) {
  const draft = quotePrefillFromMemory(memory, extras);
  return QUOTE_REQUIRED_FIELDS.filter((key) => !compact(draft[key]));
}

export function canSubmitQuote(memory = {}, extras = {}) {
  return missingQuoteFields(memory, extras).length === 0;
}

export function hasQuoteProgress(memory = {}) {
  const draft = quotePrefillFromMemory(memory);
  return QUOTE_REQUIRED_FIELDS.some((key) => compact(draft[key]));
}

export function shouldAnnounceQuoteTruth(command = "", memory = {}, pageId = "") {
  const facts = extractFactsFromUtterance(command);
  if (facts.email || facts.phone || facts.name || facts.city || facts.service) return true;
  const query = folded(command);
  if (/\b(c est (tout|bon|pret|complet)|voila|tu as tout|j ai tout (dit|donne))\b/.test(query)) {
    return hasQuoteProgress(memory) || pageId === "quote";
  }
  return false;
}

const PLACEHOLDER_NEED = "À préciser à l’oral";

export function quoteExtrasFromDocument(doc = globalThis.document) {
  if (!doc?.querySelector) return {};
  const read = (selector) => {
    const value = compact(doc.querySelector(selector)?.value);
    if (!value || value === PLACEHOLDER_NEED) return "";
    return value;
  };
  return {
    name: read("#devis-name"),
    phone: read("#devis-phone"),
    email: read("#devis-email"),
    city: read("#devis-city"),
    service: read("#devis-service"),
    description: read("#devis-description")
  };
}

export function hydrateQuoteMemoryFromForm(storage = globalThis.sessionStorage, doc = globalThis.document) {
  const extras = quoteExtrasFromDocument(doc);
  const memory = loadSessionMemory(storage);
  if (!QUOTE_REQUIRED_FIELDS.some((key) => compact(key === "description" ? extras.description : extras[key]))) {
    return memory;
  }
  return saveSessionMemory(mergeFacts(memory, {
    name: extras.name,
    phone: extras.phone,
    email: extras.email,
    city: extras.city,
    service: extras.service,
    need: extras.description
  }), storage);
}

export function describeMissingQuoteFields(memory = {}, extras = {}) {
  return joinFrenchList(missingQuoteFields(memory, extras).map((key) => QUOTE_FIELD_LABELS[key] || key));
}

export function describeQuoteChecklist(memory = {}, extras = {}) {
  const draft = quotePrefillFromMemory(memory, extras);
  const missing = QUOTE_REQUIRED_FIELDS.filter((key) => !compact(draft[key]));
  const filled = QUOTE_REQUIRED_FIELDS.filter((key) => compact(draft[key]));
  const missingSpeech = joinFrenchList(missing.map((key) => QUOTE_FIELD_LABELS[key] || key));
  const filledSpeech = joinFrenchList(filled.map((key) => QUOTE_FIELD_LABELS[key] || key));
  if (missing.length) {
    return {
      complete: false,
      missing,
      filled,
      speech: filledSpeech
        ? `Je n’envoie pas le devis. Il manque encore ${missingSpeech}. J’ai déjà ${filledSpeech}.`
        : `Je n’envoie pas le devis. Il manque encore ${missingSpeech}.`
    };
  }
  return {
    complete: true,
    missing: [],
    filled,
    speech: `Le devis est complet : ${filledSpeech}. Confirmez que vous voulez transmettre la demande vers contact@infoserv2a.pro. Rien n’est parti tant que le site n’a pas confirmé l’envoi.`
  };
}

export function emailDraftFromMemory(memory = {}) {
  const visitor = normalizeVisitor(memory.visitor);
  const who = visitor.name ? ` de ${visitor.name}` : "";
  const lines = [
    visitor.name && `Nom : ${visitor.name}`,
    visitor.phone && `Téléphone : ${visitor.phone}`,
    visitor.email && `E-mail : ${visitor.email}`,
    visitor.city && `Commune : ${visitor.city}`,
    memory.service && `Service : ${memory.service}`,
    "",
    compact(memory.need) || "Bonjour, je souhaite être recontacté(e) au sujet de ma demande."
  ].filter((line, index, list) => line || list[index - 1]);
  return {
    to: "contact@infoserv2a.pro",
    subject: `Contact InfoServ2A${who}`,
    body: lines.join("\n").trim(),
    name: visitor.name,
    email: visitor.email,
    phone: visitor.phone,
    message: compact(memory.need) || "Bonjour, je souhaite être recontacté(e) au sujet de ma demande."
  };
}

export function hasMemoryContent(memory = {}) {
  const visitor = normalizeVisitor(memory.visitor);
  return Boolean(
    visitor.name
    || visitor.phone
    || visitor.email
    || visitor.city
    || compact(memory.need)
    || compact(memory.service)
    || (memory.turns || []).length
  );
}

function buildSummary(memory = {}) {
  const visitor = normalizeVisitor(memory.visitor);
  const bits = [
    visitor.name && `Nom ${visitor.name}`,
    visitor.city && `à ${visitor.city}`,
    memory.service && `service ${memory.service}`,
    memory.need && compact(memory.need).slice(0, 80)
  ].filter(Boolean);
  return bits.join(" · ");
}

export function quoteQuestionnaire(memory = {}) {
  const draft = quotePrefillFromMemory(memory);
  return [
    { id: "name", label: "Nom", value: draft.name },
    { id: "phone", label: "Téléphone", value: draft.phone },
    { id: "email", label: "E-mail", value: draft.email },
    { id: "city", label: "Commune", value: draft.city },
    { id: "service", label: "Service", value: draft.service },
    { id: "description", label: "Besoin", value: draft.description }
  ];
}

export function shouldShowQuoteQuest(memory = {}, pageId = "") {
  if (pageId === "quote") return true;
  const visitor = normalizeVisitor(memory.visitor);
  return Boolean(visitor.name || visitor.phone || visitor.email || visitor.city);
}

export function formatCaptionContext({ page, section, memory } = {}) {
  const bits = [];
  if (page?.title) bits.push(page.title);
  if (section?.label) bits.push(section.label);
  if (page?.id === "quote") {
    const visitor = normalizeVisitor(memory?.visitor);
    if (visitor.name) bits.push(visitor.name);
    if (missingQuoteFields(memory).length) {
      bits.push(`il manque ${describeMissingQuoteFields(memory)}`);
    }
  }
  return bits.join(" · ") || "Conversation avec Claire";
}

export function formatMemoryBriefing(memory = {}) {
  const normalized = normalizeMemory(memory);
  if (!hasMemoryContent(normalized)) {
    return "Aucun échange précédent dans cet onglet de navigateur.";
  }
  const visitor = normalized.visitor;
  const facts = [
    visitor.name && `Nom : ${visitor.name}.`,
    visitor.phone && `Téléphone : ${visitor.phone}.`,
    visitor.email && `E-mail : ${visitor.email}.`,
    visitor.city && `Commune : ${visitor.city}.`,
    normalized.service && `Service évoqué : ${normalized.service}.`,
    normalized.need && `Besoin : ${normalized.need}.`,
    normalized.lastTitle && `Dernière page : ${normalized.lastTitle}.`
  ].filter(Boolean);
  const recent = normalized.turns.slice(-8).map((turn) => (
    `${turn.role === "user" ? "Visiteur" : "Claire"} : ${turn.text}`
  ));
  return [
    "Mémoire de session (onglet ouvert seulement, ne pas inventer ce qui manque) :",
    ...facts,
    recent.length ? "Derniers échanges :" : "",
    ...recent,
    "Ne redemande pas ce qui est déjà connu. Si un devis doit partir, n’invente jamais un nom, un téléphone, un e-mail ou une commune."
  ].filter(Boolean).join("\n");
}
