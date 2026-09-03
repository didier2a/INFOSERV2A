export const SESSION_MEMORY_KEY = "infoserv2a.claire.memory";
export const CLIENT_ID_KEY = "infoserv2a.claire.client";
export const QUOTE_REQUIRED_FIELDS = Object.freeze([
  "name",
  "phone",
  "email",
  "city",
  "service",
  "description"
]);

const MAX_TURNS = 24;
const MAX_VISITS = 8;
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
    version: 2,
    startedAt: 0,
    updatedAt: 0,
    clientId: "",
    visitCount: 0,
    visitor: { name: "", phone: "", email: "", city: "" },
    need: "",
    service: "",
    lastPath: "",
    lastTitle: "",
    turns: [],
    visits: [],
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
  const visits = Array.isArray(value.visits)
    ? value.visits
      .map((visit) => ({
        at: Number(visit?.at) || 0,
        summary: compact(visit?.summary).slice(0, 240),
        service: compact(visit?.service).slice(0, 80),
        need: compact(visit?.need).slice(0, 160)
      }))
      .filter((visit) => visit.summary || visit.need)
      .slice(-MAX_VISITS)
    : [];
  return {
    version: 2,
    startedAt: Number(value.startedAt) || 0,
    updatedAt: Number(value.updatedAt) || 0,
    clientId: compact(value.clientId).slice(0, 80),
    visitCount: Number(value.visitCount) || visits.length || 0,
    visitor: normalizeVisitor(value.visitor),
    need: compact(value.need).slice(0, 280),
    service: compact(value.service).slice(0, 80),
    lastPath: compact(value.lastPath).slice(0, 160),
    lastTitle: compact(value.lastTitle).slice(0, 120),
    turns,
    visits,
    summary: compact(value.summary).slice(0, 400) || fallback.summary
  };
}

function defaultSessionStore() {
  return globalThis.sessionStorage;
}

function defaultPersistentStore() {
  return globalThis.localStorage;
}

function readStore(storage) {
  try {
    const raw = storage?.getItem?.(SESSION_MEMORY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || (parsed.version !== 1 && parsed.version !== 2)) return null;
    return normalizeMemory(parsed);
  } catch {
    return null;
  }
}

function writeStore(storage, memory) {
  try {
    storage?.setItem?.(SESSION_MEMORY_KEY, JSON.stringify(memory));
  } catch {
    /* sessionStorage ou localStorage peut être bloqué ; Claire reste utilisable. */
  }
}

function mergeTurns(left = [], right = []) {
  const seen = new Set();
  const merged = [];
  for (const turn of [...left, ...right]) {
    const key = `${turn.at}|${turn.role}|${turn.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(turn);
  }
  return merged.sort((a, b) => (a.at || 0) - (b.at || 0)).slice(-MAX_TURNS);
}

function mergeVisits(left = [], right = []) {
  const seen = new Set();
  const merged = [];
  for (const visit of [...left, ...right]) {
    const key = `${visit.at}|${visit.summary}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(visit);
  }
  return merged.sort((a, b) => (a.at || 0) - (b.at || 0)).slice(-MAX_VISITS);
}

export function mergeMemories(primary = {}, secondary = {}) {
  const first = normalizeMemory(primary);
  const second = normalizeMemory(secondary);
  const firstHas = hasMemoryContent(first);
  const secondHas = hasMemoryContent(second);
  if (!firstHas) return second;
  if (!secondHas) return first;
  const newer = (first.updatedAt || 0) >= (second.updatedAt || 0) ? first : second;
  const older = newer === first ? second : first;
  return normalizeMemory({
    ...newer,
    visitor: {
      name: newer.visitor.name || older.visitor.name,
      phone: newer.visitor.phone || older.visitor.phone,
      email: newer.visitor.email || older.visitor.email,
      city: newer.visitor.city || older.visitor.city
    },
    need: newer.need || older.need,
    service: newer.service || older.service,
    lastPath: newer.lastPath || older.lastPath,
    lastTitle: newer.lastTitle || older.lastTitle,
    clientId: newer.clientId || older.clientId,
    visitCount: Math.max(Number(newer.visitCount) || 0, Number(older.visitCount) || 0),
    startedAt: Math.min(newer.startedAt || now(), older.startedAt || now()),
    turns: mergeTurns(older.turns, newer.turns),
    visits: mergeVisits(older.visits, newer.visits)
  });
}

export function loadClientId(persistent = defaultPersistentStore()) {
  try {
    const existing = compact(persistent?.getItem?.(CLIENT_ID_KEY));
    if (existing) return existing.slice(0, 80);
    const created = globalThis.crypto?.randomUUID?.() || `claire-${Date.now().toString(16)}`;
    persistent?.setItem?.(CLIENT_ID_KEY, created);
    return created;
  } catch {
    return "";
  }
}

export function loadSessionMemory(storage, persistent) {
  if (arguments.length === 0) {
    return mergeMemories(
      readStore(defaultSessionStore()) || emptyMemory(),
      readStore(defaultPersistentStore()) || emptyMemory()
    );
  }
  if (arguments.length === 1) return readStore(storage) || emptyMemory();
  return mergeMemories(readStore(storage) || emptyMemory(), readStore(persistent) || emptyMemory());
}

export function saveSessionMemory(memory, storage, persistent) {
  const next = normalizeMemory(memory);
  next.updatedAt = now();
  if (!next.startedAt) next.startedAt = next.updatedAt;
  if (!next.clientId) {
    const idStore = arguments.length >= 3
      ? persistent
      : arguments.length === 2
        ? storage
        : defaultPersistentStore();
    next.clientId = loadClientId(idStore);
  }
  next.summary = buildSummary(next);
  if (arguments.length >= 3) {
    writeStore(storage, next);
    writeStore(persistent, next);
  } else if (arguments.length === 2) {
    writeStore(storage, next);
  } else {
    writeStore(defaultSessionStore(), next);
    writeStore(defaultPersistentStore(), next);
  }
  return next;
}

export function archiveCurrentVisit(storage, persistent) {
  const loadArgs = arguments.length === 0 ? [] : arguments.length === 1 ? [storage] : [storage, persistent];
  const memory = loadSessionMemory(...loadArgs);
  if (!hasMemoryContent(memory)) return memory;
  const last = (memory.visits || []).at(-1);
  if (last && last.summary === memory.summary && now() - last.at < 120000) return memory;
  memory.visits = [
    ...(memory.visits || []),
    {
      at: now(),
      summary: memory.summary || buildSummary(memory),
      service: memory.service,
      need: memory.need
    }
  ].slice(-MAX_VISITS);
  memory.visitCount = Math.max(Number(memory.visitCount) || 0, memory.visits.length);
  return saveSessionMemory(memory, ...loadArgs);
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

export function rememberTurn(role, text, storage, persistent) {
  const storeArgs = arguments.length <= 2 ? [] : arguments.length === 3 ? [storage] : [storage, persistent];
  const clean = compact(text).slice(0, MAX_TURN_CHARS);
  if (!clean || /\[INFOSERV2A_[A-Z0-9_]+\]/.test(clean)) return loadSessionMemory(...storeArgs);
  let memory = loadSessionMemory(...storeArgs);
  memory.turns.push({
    role: role === "user" ? "user" : "companion",
    text: clean,
    at: now()
  });
  if (memory.turns.length > MAX_TURNS) memory.turns = memory.turns.slice(-MAX_TURNS);
  if (role === "user") memory = mergeFacts(memory, extractFactsFromUtterance(clean));
  return saveSessionMemory(memory, ...storeArgs);
}

export function rememberPage(path, title, storage, persistent) {
  const storeArgs = arguments.length <= 2 ? [] : arguments.length === 3 ? [storage] : [storage, persistent];
  const memory = loadSessionMemory(...storeArgs);
  if (path) memory.lastPath = compact(path).slice(0, 160);
  if (title) memory.lastTitle = compact(title).slice(0, 120);
  return saveSessionMemory(memory, ...storeArgs);
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

export function hydrateQuoteMemoryFromForm(storage, doc) {
  const documentRef = arguments.length >= 2 ? doc : globalThis.document;
  const extras = quoteExtrasFromDocument(documentRef);
  const storeArgs = arguments.length === 0 ? [] : [storage];
  const memory = loadSessionMemory(...storeArgs);
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
  }), ...storeArgs);
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
    || (memory.visits || []).length
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
    return "Aucun échange précédent sur cet ordinateur.";
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
  const visits = (normalized.visits || []).slice(-4).map((visit) => {
    const when = visit.at ? new Date(visit.at).toLocaleDateString("fr-FR") : "";
    return `- ${when ? `${when} : ` : ""}${visit.summary || visit.need}`.trim();
  });
  const recent = normalized.turns.slice(-8).map((turn) => (
    `${turn.role === "user" ? "Visiteur" : "Claire"} : ${turn.text}`
  ));
  return [
    "Mémoire de ce navigateur (même ordinateur, y compris après une coupure ou un rafraîchissement). Ne pas inventer ce qui manque :",
    ...facts,
    visits.length ? "Visites précédentes :" : "",
    ...visits,
    recent.length ? "Derniers échanges :" : "",
    ...recent,
    "Ne redemande pas ce qui est déjà connu. Ne refais pas un accueil complet. Reprends le fil. Si un devis doit partir, n’invente jamais un nom, un téléphone, un e-mail ou une commune."
  ].filter(Boolean).join("\n");
}
