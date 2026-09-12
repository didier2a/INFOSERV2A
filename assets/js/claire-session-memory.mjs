import {
  CONTACT_SCHEMA,
  QUOTE_SCHEMA,
  normalizeSchemaValue,
  validateContactFields,
  validateQuoteFields
} from "./form-schema.mjs?v=20260912-claire-cde-v1";

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

const MAX_VISITS = 8;
const MAX_TURN_CHARS = 800;
export const SYNTHESIS_LEAD = "Synthèse de l’échange :";
export const BUSINESS_REPLY_TO = "contact@infoserv2a.pro";
export const QUOTE_FIELD_LABELS = Object.freeze({
  name: "votre nom",
  phone: "votre téléphone",
  email: "votre e-mail",
  city: "votre commune",
  service: "le type de service",
  description: "la description du besoin",
  message: "le message"
});

const SERVICE_LABELS = Object.freeze({
  "videosurveillance": "vidéosurveillance",
  "reseaux-wifi": "réseaux et Wi-Fi",
  "creation-site-web": "création de site web",
  "maintenance-distance": "maintenance à distance",
  "configuration-domicile": "configuration à domicile",
  "cybersecurite-ia": "cybersécurité et IA",
  "audit-nis2": "audit NIS 2",
  "recuperation-donnees": "récupération de données",
  "autre": "autre demande"
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
    .replace(/[’'`]/g, " ");
}

export const PLACEHOLDER_NEED = "À préciser à l’oral";
export const DRAFT_HUMAN_SOURCES = Object.freeze(["oral", "typed"]);
const DRAFT_FIELDS = Object.freeze([
  "name",
  "phone",
  "email",
  "city",
  "status",
  "service",
  "description",
  "message"
]);

export function isPlaceholderNeed(value = "") {
  return folded(value) === "a preciser a l oral";
}

export function usefulText(value = "", max = 4000) {
  const clean = compact(value).slice(0, max);
  return !clean || isPlaceholderNeed(clean) ? "" : clean;
}

export function firstUsefulText(max, ...values) {
  for (const value of values) {
    const found = usefulText(value, max);
    if (found) return found;
  }
  return "";
}

export function emptyMemory() {
  return {
    version: 4,
    startedAt: 0,
    updatedAt: 0,
    clientId: "",
    visitCount: 0,
    visitor: { name: "", phone: "", email: "", city: "" },
    status: "",
    constraints: "",
    urgency: "",
    need: "",
    service: "",
    lastPath: "",
    lastTitle: "",
    turns: [],
    visits: [],
    lastSend: null,
    quoteEpoch: 0,
    draft: {
      values: {},
      provenance: {},
      invalid: {},
      askedField: ""
    },
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

function normalizeStoredQuoteDraft(value = {}) {
  const visitor = normalizeVisitor(value);
  return {
    ...visitor,
    service: compact(value.service).slice(0, 80),
    description: usefulText(value.description || value.need, 4000)
  };
}

function normalizeDraft(value = {}) {
  const rawValues = value?.values || {};
  const rawProvenance = value?.provenance || {};
  const rawInvalid = value?.invalid || {};
  const values = {};
  const provenance = {};
  const invalid = {};
  for (const field of DRAFT_FIELDS) {
    const definition = QUOTE_SCHEMA[field] || CONTACT_SCHEMA[field] || { max: 4000 };
    const normalized = normalizeSchemaValue(rawValues[field], definition);
    if (normalized) values[field] = normalized;
    const source = compact(rawProvenance[field]?.source);
    const updatedAt = Math.max(0, Number(rawProvenance[field]?.updatedAt) || 0);
    if (source && updatedAt) provenance[field] = { source, updatedAt };
    const error = compact(rawInvalid[field]).slice(0, 240);
    if (error) invalid[field] = error;
  }
  const askedField = DRAFT_FIELDS.includes(value?.askedField) ? value.askedField : "";
  return { values, provenance, invalid, askedField };
}

function mergeDrafts(primary = {}, secondary = {}) {
  const first = normalizeDraft(primary);
  const second = normalizeDraft(secondary);
  const merged = { values: {}, provenance: {}, invalid: {}, askedField: first.askedField || second.askedField };
  for (const field of DRAFT_FIELDS) {
    const firstStamp = Number(first.provenance[field]?.updatedAt) || 0;
    const secondStamp = Number(second.provenance[field]?.updatedAt) || 0;
    const preferred = firstStamp >= secondStamp ? first : second;
    const fallback = preferred === first ? second : first;
    const value = preferred.values[field] ?? fallback.values[field];
    const provenance = preferred.provenance[field] || fallback.provenance[field];
    const error = preferred.invalid[field]
      || (!preferred.values[field] && !preferred.provenance[field] ? fallback.invalid[field] : "");
    if (value) merged.values[field] = value;
    if (provenance) merged.provenance[field] = provenance;
    if (error) merged.invalid[field] = error;
  }
  return merged;
}

function normalizeLastSend(value = null) {
  if (!value || value.sent !== true) return null;
  const kind = compact(value.kind);
  if (kind !== "devis" && kind !== "contact") return null;
  return {
    sent: true,
    kind,
    at: compact(value.at).slice(0, 40),
    inbox: compact(value.inbox).slice(0, 80),
    replyTo: compact(value.replyTo).slice(0, 80),
    signature: compact(value.signature).slice(0, 420),
    draft: kind === "devis" ? normalizeStoredQuoteDraft(value.draft) : null
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
    version: 4,
    startedAt: Number(value.startedAt) || 0,
    updatedAt: Number(value.updatedAt) || 0,
    clientId: compact(value.clientId).slice(0, 80),
    visitCount: Number(value.visitCount) || visits.length || 0,
    visitor: normalizeVisitor(value.visitor),
    status: compact(value.status).slice(0, 80),
    constraints: compact(value.constraints).slice(0, 320),
    urgency: compact(value.urgency).slice(0, 160),
    need: usefulText(value.need, 280),
    service: compact(value.service).slice(0, 80),
    lastPath: compact(value.lastPath).slice(0, 160),
    lastTitle: compact(value.lastTitle).slice(0, 120),
    turns,
    visits,
    lastSend: normalizeLastSend(value.lastSend),
    quoteEpoch: Math.max(0, Number(value.quoteEpoch) || 0),
    draft: normalizeDraft(value.draft),
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
    if (!parsed || ![1, 2, 3, 4].includes(parsed.version)) return null;
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
  return merged.sort((a, b) => (a.at || 0) - (b.at || 0));
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
  const newerEpoch = Number(newer.quoteEpoch) || 0;
  const olderEpoch = Number(older.quoteEpoch) || 0;
  const needFrom = newerEpoch > olderEpoch ? newer : olderEpoch > newerEpoch ? older : newer;
  return normalizeMemory({
    ...newer,
    quoteEpoch: Math.max(newerEpoch, olderEpoch),
    visitor: {
      name: newer.visitor.name || older.visitor.name,
      phone: newer.visitor.phone || older.visitor.phone,
      email: newer.visitor.email || older.visitor.email,
      city: newer.visitor.city || older.visitor.city
    },
    status: newer.status || older.status,
    constraints: newer.constraints || older.constraints,
    urgency: newer.urgency || older.urgency,
    need: needFrom === newer ? (newer.need || (newerEpoch === olderEpoch ? older.need : "")) : older.need,
    service: needFrom === newer ? (newer.service || (newerEpoch === olderEpoch ? older.service : "")) : older.service,
    lastSend: newer.lastSend || older.lastSend,
    lastPath: newer.lastPath || older.lastPath,
    lastTitle: newer.lastTitle || older.lastTitle,
    clientId: newer.clientId || older.clientId,
    visitCount: Math.max(Number(newer.visitCount) || 0, Number(older.visitCount) || 0),
    startedAt: Math.min(newer.startedAt || now(), older.startedAt || now()),
    turns: newerEpoch === olderEpoch ? mergeTurns(older.turns, newer.turns) : (needFrom.turns || []),
    visits: mergeVisits(older.visits, newer.visits),
    draft: mergeDrafts(newer.draft, older.draft)
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
    return readStore(defaultSessionStore()) || emptyMemory();
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

export function loadPersistentResumeCandidate(persistent = defaultPersistentStore()) {
  const candidate = readStore(persistent) || emptyMemory();
  return hasMemoryContent(candidate) ? candidate : null;
}

export function resumePersistentMemory(
  session = defaultSessionStore(),
  persistent = defaultPersistentStore()
) {
  const candidate = loadPersistentResumeCandidate(persistent);
  if (!candidate) return emptyMemory();
  return saveSessionMemory(candidate, session);
}

export function clearSessionMemory(
  session = defaultSessionStore(),
  persistent = defaultPersistentStore()
) {
  try { session?.removeItem?.(SESSION_MEMORY_KEY); } catch { /* stockage bloqué */ }
  try { persistent?.removeItem?.(SESSION_MEMORY_KEY); } catch { /* stockage bloqué */ }
  return emptyMemory();
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

function applyDraftValueToMemory(memory, field, value) {
  if (["name", "phone", "email", "city"].includes(field)) {
    memory.visitor = normalizeVisitor({ ...memory.visitor, [field]: value });
  } else if (field === "service") {
    memory.service = compact(value).slice(0, 80);
  } else if (field === "status") {
    memory.status = compact(value).slice(0, 80);
  } else if (field === "description" || field === "message") {
    if (!value) {
      memory.need = "";
    } else if (!isClaireSynthesis(value) && !looksLikeConversationDump(value, memory)) {
      memory.need = usefulText(value, 280);
    }
  }
}

export function applyDraftPatch(memory = {}, patch = {}, {
  source = "oral",
  at = now(),
  clearInvalid = true
} = {}) {
  const next = normalizeMemory(memory);
  const draft = normalizeDraft(next.draft);
  const humanSource = DRAFT_HUMAN_SOURCES.includes(source);
  for (const field of DRAFT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(patch, field)) continue;
    const definition = QUOTE_SCHEMA[field] || CONTACT_SCHEMA[field] || { max: 4000 };
    const value = normalizeSchemaValue(patch[field], definition);
    const previous = draft.provenance[field] || {};
    const previousIsHuman = DRAFT_HUMAN_SOURCES.includes(previous.source);
    if (source === "programmatic" && previousIsHuman) continue;
    if (Number(previous.updatedAt) > Number(at)) continue;
    if (value) draft.values[field] = value;
    else delete draft.values[field];
    draft.provenance[field] = { source: humanSource ? source : compact(source) || "programmatic", updatedAt: Number(at) || now() };
    if (clearInvalid) delete draft.invalid[field];
    applyDraftValueToMemory(next, field, value);
  }
  next.draft = draft;
  next.summary = buildSummary(next);
  return next;
}

export function rememberDraftField(field, value, source = "typed", storage, persistent) {
  if (!DRAFT_FIELDS.includes(field)) return loadSessionMemory(storage, persistent);
  const storeArgs = arguments.length <= 3 ? [] : arguments.length === 4 ? [storage] : [storage, persistent];
  const memory = applyDraftPatch(loadSessionMemory(...storeArgs), { [field]: value }, { source });
  return saveSessionMemory(memory, ...storeArgs);
}

export function rememberAskedQuoteField(field = "", storage, persistent) {
  const storeArgs = arguments.length <= 1 ? [] : arguments.length === 2 ? [storage] : [storage, persistent];
  const memory = loadSessionMemory(...storeArgs);
  memory.draft = normalizeDraft(memory.draft);
  memory.draft.askedField = DRAFT_FIELDS.includes(field) ? field : "";
  return saveSessionMemory(memory, ...storeArgs);
}

export function rejectDraftFields(fields = [], fieldErrors = {}, storage, persistent) {
  const storeArgs = arguments.length <= 2 ? [] : arguments.length === 3 ? [storage] : [storage, persistent];
  const memory = loadSessionMemory(...storeArgs);
  memory.draft = normalizeDraft(memory.draft);
  const rejected = [...new Set(fields)].filter((field) => DRAFT_FIELDS.includes(field));
  for (const field of rejected) {
    delete memory.draft.values[field];
    memory.draft.invalid[field] = compact(fieldErrors[field])
      || `Corrigez ${QUOTE_FIELD_LABELS[field] || field}.`;
    applyDraftValueToMemory(memory, field, "");
  }
  memory.draft.askedField = rejected[0] || "";
  return saveSessionMemory(memory, ...storeArgs);
}

function slotFact(text = "", askedField = "", explicitFacts = {}) {
  const raw = compact(text);
  if (!raw || !DRAFT_FIELDS.includes(askedField)) return {};
  if (/\b(?:envoie|transmets|soumets)\b.{0,40}\b(?:devis|contact|message)\b/.test(folded(raw))) {
    return {};
  }
  const explicitKeys = ["name", "phone", "email", "city", "service", "status"]
    .filter((field) => compact(explicitFacts[field]));
  if (explicitKeys.length) return explicitFacts;
  if (askedField === "name" && /^[A-Za-zÀ-ÿ'’-]+(?:\s+[A-Za-zÀ-ÿ'’-]+){1,3}$/.test(raw)) {
    return { name: raw };
  }
  if (askedField === "phone") return { phone: raw };
  if (askedField === "email") return { email: extractSpokenEmail(raw) || raw };
  if (askedField === "city") {
    const city = extractKnownCity(raw)
      || raw.replace(/^(?:je (?:suis|vis)|j['’]habite)\s+(?:à|a|de|au|aux|en)\s+/i, "");
    return { city: compact(city) };
  }
  if (askedField === "service") return { service: inferService(raw) || raw };
  if (askedField === "description" || askedField === "message") return { [askedField]: raw };
  return {};
}

export function inferService(text = "") {
  const query = folded(text);
  if (!query) return "";
  if (/\bnis\s*2\b/.test(query)) return "audit-nis2";
  if (/\b(camera|cameras|videosurveillance|alarme)\b/.test(query)) return "videosurveillance";
  if (/\b(site web|site internet|creer un site|refonte|hebergement)\b/.test(query)) return "creation-site-web";
  if (/\b(reseau|reseaux|wi[\s-]?fi|wifi|internet|routeur|borne|ethernet|cablage|connexion)\b/.test(query)) {
    return "reseaux-wifi";
  }
  if (/\b(recuperation|disque|donnees perdues|ssd|hdd)\b/.test(query)) return "recuperation-donnees";
  if (/\b(cyber|ransomware|pare[- ]feu|antivirus|intelligence artificielle|\bia\b)\b/.test(query)) {
    return "cybersecurite-ia";
  }
  if (/\b(maintenance a distance|prise en main)\b/.test(query)) return "maintenance-distance";
  if (/\b(a domicile|configuration a domicile)\b/.test(query)) return "configuration-domicile";
  return "";
}

function hasNeedLanguage(text = "", facts = {}) {
  const query = folded(text);
  return Boolean(facts.service)
    || /\b(besoin|probleme|camera|cameras|installer|depanner|devis pour|je voudrais|je veux|j aimerais|site web|site internet|reseau|wifi|sauvegarde|maintenance|panne|ne demarre|ordinateur|\bpc\b|nas|serveur|enregistrement|hangar|cabinet|boutique|commerce)\b/.test(query);
}

function isCommandUtterance(text = "") {
  const query = folded(text);
  return /\b(envoie le devis|envoie un mail|envoie un e-mail|c est (parti|envoye|valide|tout|bon|pret)|bien (ete )?envoye)\b/.test(query)
    && query.length < 56;
}

function isContactOnlyUtterance(text, facts = {}) {
  const hasContact = Boolean(facts.email || facts.phone || facts.name || facts.city);
  if (!hasContact) return false;
  return !hasNeedLanguage(text, facts) && folded(text).length < 96;
}

function isGreetingOnly(text = "", facts = {}) {
  const query = folded(text);
  if (!/^(bonjour|bonsoir|salut|hey|coucou|hello)\b/.test(query)) return false;
  return !hasNeedLanguage(query, facts);
}

function isSmallTalk(text = "", facts = {}) {
  const query = folded(text);
  if (hasNeedLanguage(query, facts)) return false;
  return /^(comment (ca|tu|vous)|ca va|qui es[- ]tu|tu vas bien|vous allez bien)\b/.test(query)
    || (/^(merci|de rien|a bientot|bonne journee)\b/.test(query) && query.length < 40);
}

function isThinUtterance(text = "") {
  const query = folded(text);
  if (!query) return true;
  if (query.length < 12) return true;
  if (isCommandUtterance(text)) return true;
  if (isGreetingOnly(text) || isSmallTalk(text)) return true;
  return /^(bonjour|bonsoir|merci|oui|non|ok|okay|d accord|appelle|appeler|appelez)\b/.test(query)
    && query.length < 28;
}

export function isNeedUtterance(text = "") {
  return Boolean(extractFactsFromUtterance(text).need);
}

export function isClaireSynthesis(value = "") {
  const query = folded(value);
  return query.startsWith("synthese de l echange")
    || query.startsWith("le visiteur a indique")
    || /^1\.?\s+qui\b/.test(query);
}

function serviceLabel(service = "") {
  const key = compact(service);
  return SERVICE_LABELS[key] || key;
}

function dedupeNeedSnippets(items = []) {
  const cleaned = items.map((item) => compact(item)).filter(Boolean);
  const kept = [];
  for (const item of cleaned) {
    const fold = folded(item);
    if (kept.some((existing) => folded(existing).includes(fold) && folded(existing).length > fold.length)) {
      continue;
    }
    for (let index = kept.length - 1; index >= 0; index -= 1) {
      const other = folded(kept[index]);
      if (fold.includes(other) && fold.length > other.length) kept.splice(index, 1);
    }
    if (!kept.some((existing) => folded(existing) === fold)) kept.push(item);
  }
  return kept;
}

const ORAL_LEAD = /^(bonjour|bonsoir|salut|hey|coucou|hello|merci|oui|ouais|ok|okay|d accord|daccord|ben|bah|alors|et puis|et|euh|voila|voilà|donc)\b[\s,;:.!?-]*/i;
const SPEAK_LEAD = /^(je (?:voudrais|veux|aimerais|souhaite|desirerais)|j['’]aimerais|on (?:voudrait|aimerait|souhaite)|il (?:me )?faudrait|il me faut|j['’]ai besoin d(?:e |['’])?|nous (?:voulons|souhaitons|avons besoin d(?:e |['’])?))\s+/i;

function stripDialogueTranscript(text = "") {
  const lines = String(text || "").split(/\n+/);
  const kept = [];
  let dialogue = false;
  for (const line of lines) {
    const match = line.match(/^\s*(visiteur|vous|claire|assistant|companion)\s*[:\-–]\s*(.*)$/i);
    if (match) {
      dialogue = true;
      if (!/^(claire|assistant|companion)$/i.test(match[1])) kept.push(match[2]);
      continue;
    }
    if (!dialogue) kept.push(line);
  }
  return kept.join(" ");
}

function stripContactClauses(text = "") {
  return text
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, " ")
    .replace(/(?:\+33|0033|0)\s*[1-9](?:[\s.-]?\d{2}){4}/g, " ")
    .replace(/\b(?:je m['’]appelle|mon nom est|moi c['’]est)\s+[A-Za-zÀ-ÿ'’-]+(?:\s+[A-Za-zÀ-ÿ'’-]+){0,2}/gi, " ")
    .replace(/\b(?:mon (?:e-?mail|mail|courriel|numero|telephone)|adresse)(?:\s+(?:c['’]est|est))?\s+\S+/gi, " ")
    .replace(/\b(?:j['’]habite|je vis|je suis de)(?:\s+(?:à|a|au|aux|en))?\s+[A-Za-zÀ-ÿ'’-]+(?:[- ][A-Za-zÀ-ÿ'’-]+){0,2}/gi, " ");
}

function stripCommands(text = "") {
  return text.replace(/\b(?:envoie(?:r)?(?:\s+le|\s+un|\s+l[ea])?\s+(?:devis|message|mail|e-mail)|c['’]est bon|c['’]est parti)\b.*$/gi, " ");
}

function toWrittenClause(text = "") {
  let value = stripDialogueTranscript(text);
  value = stripContactClauses(value);
  value = stripCommands(value);
  value = compact(value);
  if (isClaireSynthesis(value)) {
    value = value.replace(/^(synthèse de l[’']échange\s*:?\s*)/i, "");
    value = value.replace(/^le visiteur a indiqué qu[’']il souhaite\s*/i, "");
    value = value.replace(/\n*service évoqué\s*:[^\n]+/gi, "");
  }
  let guard = 0;
  while (guard < 6 && ORAL_LEAD.test(value)) {
    value = compact(value.replace(ORAL_LEAD, ""));
    guard += 1;
  }
  value = compact(value.replace(SPEAK_LEAD, ""));
  value = value.replace(/[.!?…]+$/g, "");
  return compact(value);
}

function isUselessClause(text = "") {
  const query = folded(text);
  if (query.length < 6) return true;
  if (isGreetingOnly(text) || isSmallTalk(text) || isCommandUtterance(text)) return true;
  if (!hasNeedLanguage(query) && query.length < 48 && /^(claire|comment |tu vas|vous allez|ca va)\b/.test(query)) {
    return true;
  }
  return false;
}

export function looksLikeConversationDump(text = "", memory = {}) {
  const raw = compact(text);
  if (!raw) return false;
  const query = folded(raw);
  if (/\b(visiteur|vous|claire|assistant)\s*:/.test(query)) return true;
  if (/\bderniers echanges\b/.test(query)) return true;
  if (
    /\b(salut|bonjour|bonsoir)\s+claire\b/.test(query)
    || /\bfaisons un devis\b/.test(query)
    || /\bon n a pas termine le besoin\b/.test(query)
    || (/^le visiteur souhaite\b/.test(query) && /\b(allez|salut|faisons|s il te plait)\b/.test(query))
  ) {
    return true;
  }
  const oralMarkers = [
    /\b(salut|bonjour|bonsoir)\b/,
    /\b(allez|euh|bah|ben)\b/,
    /\b(s il te plait|faisons|on n a pas termine)\b/,
    /\b(je|on|nous)\b/
  ].filter((pattern) => pattern.test(query)).length;
  if (oralMarkers >= 3 && (raw.match(/[,;:]/g) || []).length >= 3) return true;
  const companionHit = (memory.turns || [])
    .filter((turn) => turn.role !== "user")
    .some((turn) => {
      const slice = folded(turn.text).slice(0, 36);
      return slice.length >= 24 && query.includes(slice);
    });
  if (companionHit) return true;
  const userNeedTurns = (memory.turns || [])
    .filter((turn) => turn.role === "user" && isNeedUtterance(turn.text));
  const distinctHits = userNeedTurns.filter((turn) => {
    const slice = folded(turn.text).slice(0, 28);
    return slice.length >= 16 && query.includes(slice);
  });
  if (distinctHits.length >= 2 && /[•\n]/.test(raw)) return true;
  return distinctHits.length >= 3;
}

function synthesisSource(memory = {}, extras = {}) {
  const normalized = normalizeMemory(memory);
  return folded([
    normalized.service,
    normalized.need,
    normalized.constraints,
    extras.service,
    extras.description,
    ...(normalized.turns || [])
      .filter((turn) => turn.role === "user")
      .map((turn) => turn.text)
  ].join(" "));
}

function controlledNeedSentences(memory = {}, extras = {}) {
  const normalized = normalizeMemory(memory);
  const service = compact(extras.service) || normalized.service || inferService(extras.description);
  const source = synthesisSource(normalized, extras);
  const sentences = [];

  if (service === "creation-site-web") {
    if (/\bsite vitrine\b/.test(source)) {
      sentences.push("Le client souhaite faire créer un site vitrine pour son activité.");
    } else {
      sentences.push("Le client souhaite faire créer un site web adapté à son activité.");
    }
    if (/\b(boulangerie|boulanger)\b/.test(source)) {
      sentences.push("Le site est destiné à une boulangerie.");
    } else if (/\b(commerce|boutique)\b/.test(source)) {
      sentences.push("Le site est destiné à une activité commerciale.");
    } else if (/\brestaurant\b/.test(source)) {
      sentences.push("Le site est destiné à un restaurant.");
    }
    if (/\b(part de zero|partir de zero|a partir de zero|depuis zero)\b/.test(source)) {
      sentences.push("Le projet de site part de zéro.");
    }
    if (/\b(local professionnel|local pro)\b/.test(source)) {
      sentences.push("Le client dispose déjà d’un local professionnel.");
    }
  } else if (service === "videosurveillance") {
    const target = /\bhangar\b/.test(source)
      ? ` pour un hangar${/\bisole\b/.test(source) ? " isolé" : ""}`
      : /\b(commerce|boutique)\b/.test(source)
        ? " pour un commerce"
        : "";
    if (/\b4g\b/.test(source)) {
      sentences.push(`Le client recherche une caméra 4G${target}.`);
    } else {
      sentences.push(`Le client recherche une solution de vidéosurveillance${target}.`);
    }
    if (/\bquinze jours\b|\b15 jours\b/.test(source)) {
      sentences.push("Une durée d’enregistrement de quinze jours est demandée.");
    } else if (/\benregistrement\b/.test(source)) {
      sentences.push("Un dispositif d’enregistrement est demandé.");
    }
  } else if (service === "maintenance-distance") {
    sentences.push("Le client recherche une intervention de maintenance informatique à distance.");
  } else if (service === "configuration-domicile") {
    sentences.push("Le client souhaite une configuration informatique à domicile.");
  } else if (service === "cybersecurite-ia") {
    sentences.push("Le client souhaite être accompagné sur un besoin de cybersécurité ou d’intelligence artificielle.");
  } else if (service === "audit-nis2") {
    sentences.push("Le client souhaite étudier un audit de conformité NIS 2.");
  } else if (service === "recuperation-donnees") {
    sentences.push("Le client sollicite une récupération de données.");
  }

  if (/\bsans fibre\b/.test(source) && !sentences.some((item) => /sans fibre/i.test(item))) {
    sentences.push("La solution doit fonctionner sans fibre.");
  }
  return dedupeNeedSnippets(sentences);
}

export function writeNeedParagraph(memory = {}, extras = {}) {
  const controlled = controlledNeedSentences(memory, extras);
  if (controlled.length) return controlled.join(" ");
  const normalized = normalizeMemory(memory);
  const authored = firstUsefulText(1000, extras.description, normalized.need);
  if (
    authored
    && (normalized.turns || []).length === 0
    && !isClaireSynthesis(authored)
    && !looksLikeConversationDump(authored, normalized)
  ) {
    const clause = toWrittenClause(authored);
    if (clause && !isUselessClause(clause)) {
      return `Le client souhaite ${ensureReadableClause(clause)}.`;
    }
  }
  return normalized.service
    ? `Le client souhaite étudier un besoin de ${serviceLabel(normalized.service)}.`
    : "";
}

export function synthesisFactsFromMemory(memory = {}, extras = {}) {
  const normalized = normalizeMemory(memory);
  return {
    name: compact(extras.name) || normalized.visitor.name,
    status: compact(extras.status) || normalized.status,
    service: compact(extras.service) || normalized.service,
    city: compact(extras.city) || normalized.visitor.city,
    constraints: compact(extras.constraints) || normalized.constraints,
    urgency: compact(extras.urgency) || normalized.urgency
  };
}

export function synthesisTurnsFromMemory(memory = {}) {
  return normalizeMemory(memory).turns.slice(-30).map((turn) => ({
    role: turn.role === "user" ? "user" : "companion",
    text: compact(turn.text).slice(0, MAX_TURN_CHARS)
  }));
}

export function hasEnoughNeedContext(memory = {}, extras = {}) {
  const normalized = normalizeMemory(memory);
  const service = compact(extras.service) || normalized.service || inferService(extras.description);
  if (!service) return false;
  const source = synthesisSource(normalized, extras);
  const generic = /^(je |j |on )?(veux|voudrais|souhaite|aimerais|faisons|faire|demande).{0,24}\bdevis\b[.! ]*$/;
  return source.length >= 20 && !generic.test(source);
}

export function formatNeedSynthesisCanvas(value = {}, memory = {}) {
  const normalized = normalizeMemory(memory);
  const facts = synthesisFactsFromMemory(normalized);
  const need = usefulText(value.besoin, 2400);
  const unsafe = folded(need);
  if (
    !need
    || looksLikeConversationDump(need, normalized)
    || /\bclaire\b|faisons un devis|je voudrais un devis|vous\s*:|on n a pas termine le besoin|\ballez\b|s il te plait/.test(unsafe)
  ) {
    return "";
  }
  return [
    `1. Qui : ${facts.name || usefulText(value.qui, 80) || "À préciser"}`,
    `2. Statut (pro/particulier) : ${facts.status || usefulText(value.statut, 80) || "À préciser"}`,
    `3. Besoin : ${need}`,
    `4. Lieu : ${facts.city || usefulText(value.lieu, 80) || "À préciser"}`,
    `5. Contraintes : ${facts.constraints || usefulText(value.contraintes, 320) || "À préciser"}`,
    `6. Urgence : ${facts.urgency || usefulText(value.urgence, 160) || "À préciser"}`
  ].join("\n").slice(0, 4000);
}

function collectNeedSnippets(memory = {}) {
  const snippets = [];
  for (const turn of memory.turns || []) {
    if (turn.role !== "user") continue;
    const text = compact(turn.text);
    if (!isNeedUtterance(text) || isGreetingOnly(text) || isSmallTalk(text)) continue;
    snippets.push(text.slice(0, MAX_TURN_CHARS));
  }
  const need = usefulText(memory.need, 4000);
  if (need && !isClaireSynthesis(need) && !looksLikeConversationDump(need, memory)) {
    snippets.push(need);
  }
  return dedupeNeedSnippets(
    snippets.map((item) => toWrittenClause(item)).filter((item) => item && !isUselessClause(item))
  );
}

function uncapitalizeFr(value = "") {
  if (!value) return "";
  return value.charAt(0).toLocaleLowerCase("fr") + value.slice(1);
}

function ensureReadableClause(value = "") {
  const text = uncapitalizeFr(value);
  if (/^(un|une|le|la|les|des|du|de |d'|l'|mon|ma|mes|ton|ta|tes|son|sa|ses|ce|cet|cette|ces|au |aux )\b/i.test(text)) {
    return text;
  }
  const query = folded(text);
  if (/^site\b/.test(query)) return `un ${text}`;
  if (/^camera\b/.test(query)) return `une ${text}`;
  if (/^enregistrement\b/.test(query)) return `un ${text}`;
  return text;
}

function joinWrittenClauses(clauses = []) {
  if (!clauses.length) return "";
  if (clauses.length === 1) return ensureReadableClause(clauses[0]);
  const head = clauses.slice(0, -1).map(ensureReadableClause).join(", ");
  return `${head}, et ${ensureReadableClause(clauses.at(-1))}`;
}

function isHandwrittenBody(authored, memory = {}) {
  const text = usefulText(authored, 4000);
  if (!text) return false;
  if (isClaireSynthesis(text) || looksLikeConversationDump(text, memory)) return false;
  if (memory.need && folded(text) === folded(memory.need)) return false;
  return true;
}

export function formatClaireSynthesis(snippets = [], service = "") {
  const clauses = dedupeNeedSnippets(
    snippets.map((item) => toWrittenClause(item)).filter((item) => item && !isUselessClause(item))
  );
  if (!clauses.length) return "";
  const paragraph = `Le visiteur a indiqué qu’il souhaite ${joinWrittenClauses(clauses)}.`;
  const label = serviceLabel(service);
  const body = `${SYNTHESIS_LEAD}\n\n${paragraph}`;
  const withService = label ? `${body}\n\nService évoqué : ${label}.` : body;
  return withService.replace(/\n{3,}/g, "\n\n").trim().slice(0, 4000);
}

export function formatClaireActionCanvas(memory = {}, extras = {}) {
  const normalized = normalizeMemory(memory);
  const remoteCanvas = extras.synthesis
    ? formatNeedSynthesisCanvas(extras.synthesis, normalized)
    : "";
  if (remoteCanvas) return remoteCanvas;
  const need = writeNeedParagraph(normalized, {
    ...extras,
    description: firstUsefulText(4000, extras.description, extras.message)
  });
  if (!need && !normalized.service) return "";
  const visitor = normalized.visitor;
  return [
    `1. Qui : ${visitor.name || "À préciser"}`,
    `2. Statut (pro/particulier) : ${normalized.status || "À préciser"}`,
    `3. Besoin : ${need || serviceLabel(normalized.service) || "À préciser"}`,
    `4. Lieu : ${visitor.city || "À préciser"}`,
    `5. Contraintes : ${normalized.constraints || "À préciser"}`,
    `6. Urgence : ${normalized.urgency || "À préciser"}`
  ].join("\n").slice(0, 4000);
}

export function synthesizeMailBody(memory = {}, extras = {}) {
  const canvas = formatClaireActionCanvas(memory, extras);
  if (canvas) return canvas;
  const fallback = usefulText(extras.fallbackDescription, 4000);
  return fallback && !looksLikeConversationDump(fallback, memory) && !isClaireSynthesis(fallback)
    ? fallback
    : "";
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

  const name = raw.match(/(?:je m['’]appelle|mon nom est|moi c['’]est|je suis(?!\s+(?:de|à|a|au|aux|en)(?:\s|$)))\s+([A-Za-zÀ-ÿ'’-]+(?:\s+[A-Za-zÀ-ÿ'’-]+){0,2})/i);
  if (name) facts.name = compact(name[1]);

  const city = raw.match(/(?:j['’]habite(?:\s+(?:à|a|au|aux|en))?\s+|je suis (?:de|à|a|au|aux|en)\s+|je vis (?:à|a)\s+)([A-Za-zÀ-ÿ'’-]+(?:[- ][A-Za-zÀ-ÿ'’-]+){0,2})/i);
  if (city) facts.city = compact(city[1]);
  else if (extractKnownCity(raw)) facts.city = extractKnownCity(raw);

  const service = inferService(raw);
  if (service) facts.service = service;
  const query = folded(raw);
  if (/\b(particulier|a titre personnel|pour chez moi|ma maison)\b/.test(query)) {
    facts.status = "Particulier";
  } else if (/\b(professionnel|entreprise|societe|commerce|cabinet|association|collectivite|mairie|restaurant|boutique)\b/.test(query)) {
    facts.status = "Professionnel";
  }
  const constraint = raw.match(/\b(sans (?:fibre|internet|électricité|electricite|connexion)|budget[^.!?]*|enregistrement[^.!?]*|[0-9]+\s*(?:jours?|semaines?|mois)|accès[^.!?]*|acces[^.!?]*)/i);
  if (constraint) facts.constraints = compact(constraint[0]);
  const urgency = raw.match(/\b(urgent(?:e|ement)?|dès que possible|des que possible|cette semaine|aujourd['’]hui|demain|pas urgent(?:e)?|sans urgence)\b/i);
  if (urgency) facts.urgency = compact(urgency[0]);
  if (
    !isThinUtterance(raw)
    && !isContactOnlyUtterance(raw, facts)
    && !isGreetingOnly(raw, facts)
    && !isSmallTalk(raw, facts)
  ) {
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
  if (compact(facts.status)) next.status = compact(facts.status).slice(0, 80);
  if (compact(facts.constraints)) next.constraints = compact(facts.constraints).slice(0, 320);
  if (compact(facts.urgency)) next.urgency = compact(facts.urgency).slice(0, 160);
  if (usefulText(facts.need)) next.need = usefulText(facts.need, 280);
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
  if (role === "user") {
    const extracted = extractFactsFromUtterance(clean);
    const askedField = memory.draft?.askedField || "";
    const facts = askedField ? slotFact(clean, askedField, extracted) : extracted;
    memory = mergeFacts(memory, facts);
    const patch = {
      ...Object.fromEntries(
        ["name", "phone", "email", "city", "status", "service"]
          .filter((field) => Object.prototype.hasOwnProperty.call(facts, field))
          .map((field) => [field, facts[field]])
      ),
      ...(facts.description ? { description: facts.description } : {}),
      ...(facts.message ? { message: facts.message } : {}),
      ...(facts.need ? { description: facts.need } : {})
    };
    memory = applyDraftPatch(memory, patch, { source: "oral" });
    if (askedField && Object.prototype.hasOwnProperty.call(patch, askedField)) {
      memory.draft.askedField = "";
    }
  }
  return saveSessionMemory(memory, ...storeArgs);
}

export function rememberPage(path, title, storage, persistent) {
  const storeArgs = arguments.length <= 2 ? [] : arguments.length === 3 ? [storage] : [storage, persistent];
  const memory = loadSessionMemory(...storeArgs);
  if (path) memory.lastPath = compact(path).slice(0, 160);
  if (title) memory.lastTitle = compact(title).slice(0, 120);
  return saveSessionMemory(memory, ...storeArgs);
}

function rawNeedForSignature(memory = {}, extras = {}) {
  const authored = firstUsefulText(4000, extras.description, extras.message);
  if (authored && !isClaireSynthesis(authored) && !looksLikeConversationDump(authored, memory)) {
    return authored;
  }
  return usefulText(memory.need, 4000);
}

export function quoteDraftSignature(memory = {}, extras = {}) {
  const visitor = normalizeVisitor(memory.visitor);
  const fields = {
    name: compact(extras.name) || visitor.name,
    phone: compact(extras.phone) || visitor.phone,
    email: compact(extras.email) || visitor.email,
    city: compact(extras.city) || visitor.city,
    service: compact(extras.service) || compact(memory.service),
    description: rawNeedForSignature(memory, extras)
  };
  return QUOTE_REQUIRED_FIELDS
    .map((key) => compact(fields[key]).toLocaleLowerCase("fr"))
    .join("|");
}

export function contactDraftSignature(memory = {}, extras = {}) {
  const visitor = normalizeVisitor(memory.visitor);
  const name = compact(extras.name) || visitor.name;
  const email = compact(extras.email) || visitor.email;
  const message = rawNeedForSignature(memory, extras);
  return [name, email, message].map((value) => compact(value).toLocaleLowerCase("fr")).join("|");
}

export function rememberSuccessfulSend(detail = {}, storage, persistent) {
  const storeArgs = arguments.length <= 1 ? [] : arguments.length === 2 ? [storage] : [storage, persistent];
  const memory = loadSessionMemory(...storeArgs);
  memory.lastSend = normalizeLastSend({
    sent: true,
    kind: detail.kind,
    at: detail.at || new Date().toISOString(),
    inbox: detail.inbox || compact(detail.email).slice(0, 80),
    replyTo: detail.replyTo || "",
    signature: detail.signature || "",
    draft: detail.draft
  });
  return saveSessionMemory(memory, ...storeArgs);
}

export function beginNewQuoteAfterSend(storage, persistent) {
  const storeArgs = arguments.length === 0 ? [] : arguments.length === 1 ? [storage] : [storage, persistent];
  archiveCurrentVisit(...storeArgs);
  const memory = loadSessionMemory(...storeArgs);
  memory.need = "";
  memory.service = "";
  memory.turns = [];
  memory.draft = normalizeDraft(memory.draft);
  for (const field of ["service", "description", "message"]) {
    delete memory.draft.values[field];
    delete memory.draft.provenance[field];
  }
  memory.draft.invalid = {};
  memory.draft.askedField = "";
  memory.quoteEpoch = (Number(memory.quoteEpoch) || 0) + 1;
  return saveSessionMemory(memory, ...storeArgs);
}

export function isSameDraftAlreadySent(memory = {}, extras = {}, kind = "devis") {
  const last = normalizeLastSend(memory.lastSend);
  if (!last || last.kind !== kind) return false;
  const signature = kind === "contact"
    ? contactDraftSignature(memory, extras)
    : quoteDraftSignature(memory, extras);
  return Boolean(last.signature && signature && last.signature === signature);
}

function quoteDraftFromSignature(signature = "") {
  const [name = "", phone = "", email = "", city = "", service = "", ...description] = String(signature).split("|");
  return normalizeStoredQuoteDraft({
    name,
    phone,
    email,
    city,
    service,
    description: description.join("|")
  });
}

export function restoreQuoteDraftForResend(storage, doc) {
  const storeArgs = arguments.length === 0 ? [] : [storage];
  const documentRef = arguments.length >= 2 ? doc : globalThis.document;
  const memory = loadSessionMemory(...storeArgs);
  const form = formExtrasFromDocument(documentRef);
  const lastSend = normalizeLastSend(memory.lastSend);
  const stored = lastSend?.kind === "devis" ? normalizeStoredQuoteDraft(lastSend.draft) : {};
  const signed = lastSend?.kind === "devis" ? quoteDraftFromSignature(lastSend.signature) : {};
  const archived = (memory.visits || []).at(-1) || {};
  const service = firstUsefulText(80, stored.service, archived.service, form.service, signed.service);
  const description = firstUsefulText(4000, stored.description, archived.need, form.description, signed.description);
  if (!service && !description) return null;

  const restored = normalizeMemory(memory);
  restored.visitor = normalizeVisitor({
    name: firstUsefulText(80, form.name, stored.name, restored.visitor.name, signed.name),
    phone: firstUsefulText(40, form.phone, stored.phone, restored.visitor.phone, signed.phone),
    email: firstUsefulText(120, form.email, stored.email, restored.visitor.email, signed.email),
    city: firstUsefulText(80, form.city, stored.city, restored.visitor.city, signed.city)
  });
  restored.service = service;
  restored.need = description;
  restored.quoteEpoch = (Number(restored.quoteEpoch) || 0) + 1;
  if (restored.lastSend?.kind === "devis") {
    restored.lastSend = { ...restored.lastSend, signature: "" };
  }
  return saveSessionMemory(restored, ...storeArgs);
}

export function alreadySentSpeech(memory = {}, kind = "devis") {
  const last = normalizeLastSend(memory.lastSend);
  const inbox = last?.inbox || "votre e-mail";
  if (kind === "contact") {
    return `Le message a déjà été envoyé vers ${inbox}. Je n’en renvoie pas un deuxième.`;
  }
  return `La demande de devis a déjà été envoyée vers ${inbox}. Je n’en renvoie pas une deuxième.`;
}

export function quotePrefillFromMemory(memory = {}, extras = {}) {
  const visitor = normalizeVisitor(memory.visitor);
  const draft = normalizeDraft(memory.draft);
  const value = (field, fallback = "") => compact(draft.values[field]) || compact(extras[field]) || compact(fallback);
  const typedDescription = draft.provenance.description?.source === "typed"
    ? usefulText(draft.values.description, 4000)
    : "";
  return {
    name: value("name", visitor.name),
    phone: value("phone", visitor.phone),
    email: value("email", visitor.email),
    city: value("city", visitor.city),
    service: value("service", memory.service),
    description: typedDescription || synthesizeMailBody(memory, {
      ...extras,
      description: firstUsefulText(4000, extras.description, draft.values.description)
    })
  };
}

export function validateQuoteDraft(memory = {}, extras = {}) {
  const validation = validateQuoteFields(quotePrefillFromMemory(memory, extras));
  const rejected = normalizeDraft(memory.draft).invalid;
  for (const [field, message] of Object.entries(rejected)) {
    validation.invalid.push(field);
    validation.fieldErrors[field] = message;
  }
  validation.invalid = [...new Set(validation.invalid)];
  validation.valid = validation.invalid.length === 0;
  return validation;
}

export function missingQuoteFields(memory = {}, extras = {}) {
  return validateQuoteDraft(memory, extras).invalid;
}

export function canSubmitQuote(memory = {}, extras = {}) {
  return validateQuoteDraft(memory, extras).valid;
}

export function hasQuoteProgress(memory = {}) {
  const draft = quotePrefillFromMemory(memory);
  return QUOTE_REQUIRED_FIELDS.some((key) => compact(draft[key]));
}

export function shouldAnnounceQuoteTruth(command = "", memory = {}, pageId = "") {
  const requested = arguments.length >= 4 ? arguments[3] === true : false;
  if (!requested) return false;
  const facts = extractFactsFromUtterance(command);
  if (facts.email || facts.phone || facts.name || facts.city || facts.service) return true;
  const query = folded(command);
  if (/\b(c est (tout|bon|pret|complet)|voila|tu as tout|j ai tout (dit|donne))\b/.test(query)) {
    return hasQuoteProgress(memory) || pageId === "quote";
  }
  return false;
}

export function quoteExtrasFromDocument(doc = globalThis.document) {
  if (!doc?.querySelector) return {};
  const read = (selector) => {
    const field = doc.querySelector(selector);
    if (field?.getAttribute?.("aria-invalid") === "true") return "";
    return usefulText(field?.value);
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

export function contactExtrasFromDocument(doc = globalThis.document) {
  if (!doc?.querySelector) return {};
  const read = (selector) => {
    const field = doc.querySelector(selector);
    if (field?.getAttribute?.("aria-invalid") === "true") return "";
    return usefulText(field?.value);
  };
  return {
    name: read("#contact-name"),
    phone: read("#contact-phone"),
    email: read("#contact-email"),
    city: read("#contact-city"),
    status: read('[name="audience"]:checked'),
    message: read("#contact-message")
  };
}

export function formExtrasFromDocument(doc = globalThis.document) {
  const quote = quoteExtrasFromDocument(doc);
  const contact = contactExtrasFromDocument(doc);
  return {
    name: quote.name || contact.name,
    phone: quote.phone || contact.phone,
    email: quote.email || contact.email,
    city: quote.city,
    status: contact.status,
    service: quote.service,
    description: quote.description || contact.message,
    message: contact.message || quote.description
  };
}

export function validateContactDraft(memory = {}, extras = {}) {
  const visitor = normalizeVisitor(memory.visitor);
  const draft = normalizeDraft(memory.draft);
  const name = compact(draft.values.name) || compact(extras.name) || visitor.name;
  const email = compact(draft.values.email) || compact(extras.email) || visitor.email;
  const phone = compact(draft.values.phone) || compact(extras.phone) || visitor.phone;
  const authored = looksLikeConversationDump(extras.message || extras.description, memory)
    || isClaireSynthesis(extras.message || extras.description)
    ? ""
    : firstUsefulText(4000, extras.message, extras.description);
  const message = firstUsefulText(
    4000,
    draft.provenance.message?.source === "typed" ? draft.values.message : "",
    synthesizeMailBody(memory, extras),
    authored,
    memory.need
  );
  const validation = validateContactFields({ name, email, phone, message });
  for (const [field, error] of Object.entries(draft.invalid)) {
    if (field in CONTACT_SCHEMA) {
      validation.invalid.push(field);
      validation.fieldErrors[field] = error;
    }
  }
  validation.invalid = [...new Set(validation.invalid)];
  validation.valid = validation.invalid.length === 0;
  return validation;
}

export function canSubmitContact(memory = {}, extras = {}) {
  return validateContactDraft(memory, extras).valid;
}

export function hydrateQuoteMemoryFromForm(storage, doc) {
  const documentRef = arguments.length >= 2 ? doc : globalThis.document;
  const extras = formExtrasFromDocument(documentRef);
  const storeArgs = arguments.length === 0 ? [] : [storage];
  const memory = loadSessionMemory(...storeArgs);
  if (isSameDraftAlreadySent(memory, extras, "devis") || isSameDraftAlreadySent(memory, extras, "contact")) {
    return memory;
  }
  if (!QUOTE_REQUIRED_FIELDS.some((key) => compact(key === "description" ? extras.description : extras[key]))
    && !canSubmitContact(memory, extras)
    && !compact(extras.name || extras.email || extras.message)) {
    return memory;
  }
  const rawNeed = firstUsefulText(4000, extras.description, extras.message);
  const facts = {
    name: extras.name,
    phone: extras.phone,
    email: extras.email,
    city: extras.city,
    status: extras.status,
    service: extras.service
  };
  if (rawNeed && !isClaireSynthesis(rawNeed) && !looksLikeConversationDump(rawNeed, memory)) {
    facts.need = rawNeed;
  }
  return saveSessionMemory(mergeFacts(memory, facts), ...storeArgs);
}

export function describeMissingQuoteFields(memory = {}, extras = {}) {
  return joinFrenchList(missingQuoteFields(memory, extras).map((key) => QUOTE_FIELD_LABELS[key] || key));
}

export function describeQuoteChecklist(memory = {}, extras = {}) {
  const validation = validateQuoteDraft(memory, extras);
  const draft = validation.normalized;
  const missing = validation.invalid;
  const filled = QUOTE_REQUIRED_FIELDS.filter((key) => compact(draft[key]) && !missing.includes(key));
  const missingSpeech = joinFrenchList(missing.map((key) => QUOTE_FIELD_LABELS[key] || key));
  const filledSpeech = joinFrenchList(filled.map((key) => QUOTE_FIELD_LABELS[key] || key));
  if (missing.length) {
    return {
      complete: false,
      missing,
      filled,
      fieldErrors: validation.fieldErrors,
      alreadySent: false,
      speech: filledSpeech
        ? `Je n’envoie pas le devis. Il manque encore ${missingSpeech}. J’ai déjà ${filledSpeech}.`
        : `Je n’envoie pas le devis. Il manque encore ${missingSpeech}.`
    };
  }
  if (isSameDraftAlreadySent(memory, extras, "devis")) {
    return {
      complete: true,
      missing: [],
      filled,
      fieldErrors: {},
      alreadySent: true,
      speech: alreadySentSpeech(memory, "devis")
    };
  }
  return {
    complete: true,
    missing: [],
    filled,
    fieldErrors: {},
    alreadySent: false,
    speech: `Le devis est complet : ${filledSpeech}. Confirmez que vous voulez transmettre la demande vers ${draft.email || "l’e-mail indiqué dans le formulaire"}. Rien n’est parti tant que le site n’a pas confirmé l’envoi.`
  };
}

export function emailDraftFromMemory(memory = {}) {
  const visitor = normalizeVisitor(memory.visitor);
  const who = visitor.name ? ` de ${visitor.name}` : "";
  const message = synthesizeMailBody(memory);
  return {
    to: visitor.email,
    replyTo: BUSINESS_REPLY_TO,
    subject: `Contact InfoServ2A${who}`,
    body: message,
    name: visitor.name,
    email: visitor.email,
    phone: visitor.phone,
    city: visitor.city,
    status: compact(memory.status),
    message
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
    memory.status,
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

export function shouldShowQuoteQuest(memory = {}, pageId = "", requested = false) {
  if (requested !== true) return false;
  if (pageId === "quote") return true;
  const visitor = normalizeVisitor(memory.visitor);
  return Boolean(visitor.name || visitor.phone || visitor.email || visitor.city);
}

export function formatCaptionContext({ page, section, memory, requested = false } = {}) {
  const bits = [];
  if (page?.title) bits.push(page.title);
  if (section?.label) bits.push(section.label);
  if (page?.id === "quote" && requested === true) {
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
    normalized.need && `Besoin en cours : ${normalized.need}.`,
    !normalized.need && normalized.lastSend?.sent && "Devis en cours : aucun. N’en ressors pas un ancien.",
    normalized.lastTitle && `Dernière page : ${normalized.lastTitle}.`,
    normalized.lastSend?.sent && `Dernier envoi : ${normalized.lastSend.kind} vers ${normalized.lastSend.inbox}. C’est clos. Un nouveau besoin à l’oral = un nouveau devis : tu ne ressorts pas l’ancien, tu ne redemandes pas de confirmer cet envoi-là.`
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

export function formatLiveMemoryCue(memory = {}) {
  const normalized = normalizeMemory(memory);
  if (!hasMemoryContent(normalized)) return "";
  const visitor = normalized.visitor;
  const facts = [
    visitor.name && `Nom ${visitor.name}`,
    visitor.city,
    visitor.phone && `tél. ${visitor.phone}`,
    visitor.email,
    normalized.service && `service ${normalized.service}`,
    normalized.need && compact(normalized.need).slice(0, 120)
  ].filter(Boolean).join(" · ");
  const sent = normalized.lastSend?.sent
    ? ` Dernier envoi (${normalized.lastSend.kind}) clos. Un nouveau besoin = un nouveau devis.`
    : "";
  return `Client déjà connu : ${facts || "échange en cours"}.${sent} ORDRE : une phrase courte (« Je reprends. »). N’énumère rien. N’accueille pas. Silence ensuite.`;
}
