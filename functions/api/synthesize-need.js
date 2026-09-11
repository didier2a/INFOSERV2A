import { corsHeaders, corsPreflight, isAllowedOrigin } from "./liveavatar-origin.js";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";
const RATE_LIMIT = 6;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_TURNS = 30;
const MAX_TURN_CHARS = 800;
const MAX_TRANSCRIPT_CHARS = 8000;
const hits = new Map();

export const NEED_WRITER_SYSTEM_PROMPT = `Tu es la secrétaire professionnelle francophone d’InfoServ2A.
À partir des faits extraits et des tours de session, rédige un canevas de demande de devis strictement factuel.
Réponds uniquement selon le schéma JSON demandé avec les champs qui, statut, besoin, lieu, contraintes et urgence.
Le champ besoin contient 4 à 8 phrases courtes, à la troisième personne ("Le client…" ou "Le visiteur…"), et seulement les idées utiles au projet.
Sont interdits dans besoin : les salutations, "salut Claire", Claire utilisée comme interlocutrice, "je voudrais un devis", "faisons un devis", les labels "Vous:" ou "Claire:", "on n’a pas terminé le besoin", et les mots de remplissage ASR tels que "allez" ou "s’il te plaît" employés comme colle.
N’invente jamais de nom, de ville, de téléphone, de contrainte ni d’urgence. Pour toute information inconnue, écris exactement "À préciser".`;

function json(data, status = 200, request) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'",
      "X-Content-Type-Options": "nosniff",
      ...corsHeaders(request)
    }
  });
}

function compact(value = "", max = 800) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function folded(value = "") {
  return compact(value, 5000)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’'`]/g, " ");
}

export function resetNeedSynthesisRateLimit() {
  hits.clear();
}

export function allowNeedSynthesisRequest(ip, now = Date.now(), limit = RATE_LIMIT, windowMs = RATE_WINDOW_MS) {
  const key = String(ip || "unknown");
  const bucket = (hits.get(key) || []).filter((stamp) => now - stamp < windowMs);
  if (bucket.length >= limit) {
    hits.set(key, bucket);
    return false;
  }
  bucket.push(now);
  hits.set(key, bucket);
  return true;
}

export function normalizeSynthesisTurns(input = {}) {
  const source = Array.isArray(input.turns)
    ? input.turns
    : Array.isArray(input.session?.turns)
      ? input.session.turns
      : [];
  const recent = source.slice(-MAX_TURNS).map((turn) => ({
    role: turn?.role === "user" ? "user" : "companion",
    text: compact(turn?.text, MAX_TURN_CHARS)
  })).filter((turn) => turn.text);
  const kept = [];
  let size = 0;
  for (let index = recent.length - 1; index >= 0; index -= 1) {
    const turn = recent[index];
    if (size + turn.text.length > MAX_TRANSCRIPT_CHARS) {
      const room = MAX_TRANSCRIPT_CHARS - size;
      if (room > 40) kept.unshift({ ...turn, text: turn.text.slice(-room) });
      break;
    }
    kept.unshift(turn);
    size += turn.text.length;
  }
  return kept;
}

export function normalizeSynthesisFacts(value = {}) {
  return {
    name: compact(value.name, 80),
    status: compact(value.status, 80),
    service: compact(value.service, 80),
    city: compact(value.city, 80),
    constraints: compact(value.constraints, 320),
    urgency: compact(value.urgency, 160)
  };
}

function outputSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      qui: { type: "string" },
      statut: { type: "string" },
      besoin: { type: "string" },
      lieu: { type: "string" },
      contraintes: { type: "string" },
      urgence: { type: "string" }
    },
    required: ["qui", "statut", "besoin", "lieu", "contraintes", "urgence"]
  };
}

function parseModelContent(payload = {}) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string") return JSON.parse(content);
  if (Array.isArray(content)) {
    const text = content.map((item) => item?.text || "").join("");
    return JSON.parse(text);
  }
  throw new Error("Réponse OpenAI vide");
}

function sentenceCount(value = "") {
  return (String(value).match(/[.!?](?=\s|$)/g) || []).length;
}

export function normalizeWriterOutput(value = {}, facts = {}) {
  const normalized = {
    qui: facts.name || "À préciser",
    statut: facts.status || compact(value.statut, 80) || "À préciser",
    besoin: compact(value.besoin, 2400),
    lieu: facts.city || "À préciser",
    contraintes: facts.constraints || compact(value.contraintes, 320) || "À préciser",
    urgence: facts.urgency || compact(value.urgence, 160) || "À préciser"
  };
  const unsafe = folded(normalized.besoin);
  const forbidden = /\b(salut|bonjour|bonsoir)\b|\bclaire\b|faisons un devis|je voudrais un devis|vous\s*:|on n a pas termine le besoin|\ballez\b|s il te plait/;
  const count = sentenceCount(normalized.besoin);
  if (!normalized.besoin || forbidden.test(unsafe) || count < 4 || count > 8) {
    throw new Error("Synthèse OpenAI non conforme");
  }
  return normalized;
}

export function onRequestOptions({ request }) {
  return corsPreflight(request);
}

export function onRequestGet({ request, env }) {
  return json({ configured: Boolean(String(env.OPENAI_API_KEY || "").trim()) }, 200, request);
}

export async function onRequestPost({ request, env }) {
  if (!isAllowedOrigin(request)) {
    return json({ error: "Origine non autorisée", fallback: true }, 403, request);
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return json({ error: "Requête JSON invalide", fallback: true }, 400, request);
  }
  if (input?.appId !== "infoserv2a") {
    return json({ error: "Application non autorisée", fallback: true }, 403, request);
  }

  const key = String(env.OPENAI_API_KEY || "").trim();
  if (!key) {
    return json({ error: "Rédacteur silencieux non configuré", fallback: true }, 503, request);
  }
  const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "";
  if (!allowNeedSynthesisRequest(ip)) {
    return json({ error: "Trop de tentatives. Réessayez dans quelques minutes.", fallback: true }, 429, request);
  }

  const facts = normalizeSynthesisFacts(input.facts);
  const turns = normalizeSynthesisTurns(input);
  if (!turns.length && !facts.service) {
    return json({ error: "Contexte insuffisant", fallback: true }, 400, request);
  }

  try {
    const response = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: compact(env.OPENAI_NEED_MODEL, 80) || DEFAULT_MODEL,
        temperature: 0.2,
        messages: [
          { role: "system", content: NEED_WRITER_SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify({
              faits_extraits: facts,
              tours_de_session: turns
            })
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "infoserv2a_besoin",
            strict: true,
            schema: outputSchema()
          }
        }
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return json({ error: "Rédaction silencieuse indisponible", fallback: true }, 502, request);
    }
    const synthesis = normalizeWriterOutput(parseModelContent(payload), facts);
    return json(synthesis, 200, request);
  } catch {
    return json({ error: "Synthèse invalide", fallback: true }, 502, request);
  }
}
