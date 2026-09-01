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
const QUOTE_FIELD_LABELS = Object.freeze({
  name: "votre nom",
  phone: "votre téléphone",
  email: "votre e-mail",
  city: "votre commune",
  service: "le type de service",
  description: "la description du besoin"
});

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

function isThinUtterance(text = "") {
  const query = folded(text);
  if (!query) return true;
  if (query.length < 12) return true;
  return /^(bonjour|bonsoir|merci|oui|non|ok|okay|d accord|appelle|appeler|appelez|envoie le devis|envoie un mail|envoie un e-mail)\b/.test(query)
    && query.length < 28;
}

export function extractFactsFromUtterance(text = "") {
  const raw = compact(text);
  const facts = {};
  if (!raw) return facts;

  const email = raw.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/);
  if (email) facts.email = email[0];

  const phone = raw.match(/(?:\+33|0)\s*[1-9](?:[\s.-]?\d{2}){4}/);
  if (phone) facts.phone = compact(phone[0]);

  const name = raw.match(/(?:je m['’]appelle|mon nom est|moi c['’]est)\s+([A-Za-zÀ-ÿ'’-]+(?:\s+[A-Za-zÀ-ÿ'’-]+){0,2})/i);
  if (name) facts.name = compact(name[1]);

  const city = raw.match(/(?:j['’]habite(?:\s+(?:à|a|au|aux|en))?\s+|je suis de\s+|je vis (?:à|a)\s+)([A-Za-zÀ-ÿ'’-]+(?:[- ][A-Za-zÀ-ÿ'’-]+){0,2})/i);
  if (city) facts.city = compact(city[1]);

  const service = inferService(raw);
  if (service) facts.service = service;
  if (!isThinUtterance(raw)) facts.need = raw.slice(0, 280);
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
  let memory = loadSessionMemory(storage);
  const clean = compact(text).slice(0, MAX_TURN_CHARS);
  if (!clean) return memory;
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

export function describeMissingQuoteFields(memory = {}, extras = {}) {
  const missing = missingQuoteFields(memory, extras);
  const labels = missing.map((key) => QUOTE_FIELD_LABELS[key] || key);
  if (!labels.length) return "";
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} et ${labels.at(-1)}`;
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
    body: lines.join("\n").trim()
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
