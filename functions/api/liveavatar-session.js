import { corsHeaders, corsPreflight, isAllowedOrigin } from "./liveavatar-origin.js";
import { buildClaireContextPrompt, CLAIRE_WELCOME } from "../../assets/js/claire-core.mjs";
import knowledge from "../../data/site-knowledge.json" with { type: "json" };

const TOKEN_URL = "https://api.liveavatar.com/v1/sessions/token";
const SECRETS_URL = "https://api.liveavatar.com/v1/secrets";
const CONTEXTS_URL = "https://api.liveavatar.com/v1/contexts";
const DEFAULT_AVATAR_ID = "664ff8bb-4932-4644-91f8-b90975d6f549";
const SECRET_NAME = "InfoServ2A OpenAI Realtime";
const CONTEXT_NAME = "InfoServ2A Claire Aidant 1.19";

const CLAIRE_CONTEXT = buildClaireContextPrompt(knowledge);

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

function safeMessage(payload, fallback) {
  const value = String(payload?.message || "").trim();
  return value && !/key|token|secret/i.test(value) ? value : fallback;
}

async function providerJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

function liveAvatarKey(env) {
  return String(env.LIVEAVATAR_API_KEY || env.HEYGEN_API_KEY || "").trim();
}

function avatarId(env) {
  return String(env.LIVEAVATAR_AVATAR_ID || env.HEYGEN_AVATAR_ID || DEFAULT_AVATAR_ID).trim();
}

async function secretFingerprint(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest).slice(0, 8), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function ensureOpenAISecret(env, key) {
  const configured = String(env.LIVEAVATAR_OPENAI_SECRET_ID || "").trim();
  if (configured) return configured;

  const openaiKey = String(env.OPENAI_API_KEY || "").trim();
  if (!openaiKey) throw new Error("OpenAI Realtime non configuré");
  // LiveAvatar ne permet pas de modifier la valeur d’un secret. Un nom
  // déterministe dérivé de la clé garantit donc qu’une rotation Cloudflare
  // crée une nouvelle référence au lieu de réutiliser une ancienne clé.
  const versionedName = `${SECRET_NAME} ${await secretFingerprint(openaiKey)}`;

  const listed = await providerJson(SECRETS_URL, { headers: { "X-API-KEY": key } });
  if (!listed.response.ok) throw new Error(`Secrets LiveAvatar ${listed.response.status}`);
  const existing = (Array.isArray(listed.payload?.data) ? listed.payload.data : [])
    .find((item) => item?.secret_name === versionedName && item?.secret_type === "OPENAI_API_KEY");
  if (existing?.id) return String(existing.id);

  const created = await providerJson(SECRETS_URL, {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      secret_name: versionedName,
      secret_type: "OPENAI_API_KEY",
      secret_value: openaiKey
    })
  });
  if (!created.response.ok || !created.payload?.data?.id) {
    throw new Error(`Création du secret LiveAvatar ${created.response.status}`);
  }
  return String(created.payload.data.id);
}

async function ensureClaireContext(env, key) {
  const listed = await providerJson(`${CONTEXTS_URL}?page=1&page_size=100`, {
    headers: { "X-API-KEY": key }
  });
  if (listed.response.ok) {
    const existing = (listed.payload?.data?.results || []).find((item) => item?.name === CONTEXT_NAME);
    if (existing?.id) return String(existing.id);
  }

  const created = await providerJson(CONTEXTS_URL, {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: CONTEXT_NAME,
      prompt: CLAIRE_CONTEXT,
      opening_text: CLAIRE_WELCOME
    })
  });
  if (created.response.ok && created.payload?.data?.id) {
    return String(created.payload.data.id);
  }

  const configured = String(env.LIVEAVATAR_CONTEXT_ID || "").trim();
  if (configured) return configured;
  if (!listed.response.ok) throw new Error(`Contextes LiveAvatar ${listed.response.status}`);
  throw new Error(`Création du contexte LiveAvatar ${created.response.status}`);
}

export async function onRequestPost({ request, env }) {
  if (!isAllowedOrigin(request)) return json({ error: "Origine non autorisée" }, 403, request);

  const key = liveAvatarKey(env);
  if (!key) return json({ error: "LiveAvatar non configuré" }, 503, request);
  if (!env.OPENAI_API_KEY && !env.LIVEAVATAR_OPENAI_SECRET_ID) {
    return json({ error: "OpenAI Realtime non configuré" }, 503, request);
  }

  let input = {};
  try {
    input = await request.json();
  } catch {
    return json({ error: "Requête JSON invalide" }, 400, request);
  }
  if (input.appId !== "infoserv2a") return json({ error: "Application non autorisée" }, 403, request);

  try {
    const [secretId, contextId] = await Promise.all([
      ensureOpenAISecret(env, key),
      ensureClaireContext(env, key)
    ]);
    const model = String(env.LIVEAVATAR_OPENAI_MODEL || "gpt-realtime").trim();
    const tokenResult = await providerJson(TOKEN_URL, {
      method: "POST",
      headers: { "X-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "LITE",
        avatar_id: avatarId(env),
        is_sandbox: false,
        max_session_duration: 300,
        video_settings: { quality: "high", encoding: "H264" },
        openai_realtime_config: {
          secret_id: secretId,
          context_id: contextId,
          voice: "marin",
          model,
          // LiveAvatar refuse toute température < 0.6 sur le connecteur LITE.
          temperature: 0.75
        }
      })
    });
    const sessionToken = tokenResult.payload?.data?.session_token;
    if (!tokenResult.response.ok || !sessionToken) {
      return json({
        error: safeMessage(tokenResult.payload, "Session LiveAvatar Realtime indisponible")
      }, tokenResult.response.ok ? 502 : tokenResult.response.status, request);
    }
    return json({
      sessionToken: String(sessionToken),
      sessionId: String(tokenResult.payload.data.session_id || ""),
      mode: "LITE",
      connector: "OPENAI_REALTIME",
      voice: "marin",
      model,
      orientation: "vertical",
      appId: "infoserv2a"
    }, 200, request);
  } catch (error) {
    console.error("InfoServ2A LiveAvatar", String(error?.message || error).replace(/sk-[A-Za-z0-9_-]+/g, "[secret]"));
    return json({ error: "Connexion LiveAvatar Realtime indisponible" }, 502, request);
  }
}

export function onRequestOptions({ request }) {
  return corsPreflight(request);
}
