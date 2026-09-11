import { persistEmbedTicket, persistedEmbedTicket } from "./tenant-state.js";

const encoder = new TextEncoder();
const TICKET_TTL_MS = 10 * 60 * 1000;

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function timingSafeEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

async function signingKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export function normalizeOrigin(value) {
  try {
    const url = new URL(String(value || ""));
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      return "";
    }
    return url.origin;
  } catch {
    return "";
  }
}

export function requestOrigin(request) {
  return normalizeOrigin(request.headers.get("Origin"));
}

export function originAllowed(tenant, origin) {
  const normalized = normalizeOrigin(origin);
  return Boolean(normalized && tenant?.allowedOrigins.includes(normalized));
}

export function corsHeaders(tenant, request) {
  const origin = requestOrigin(request);
  if (!originAllowed(tenant, origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin"
  };
}

export function localEnvironment(env = {}) {
  return ["local", "development", "test"].includes(
    String(env.CLAIRE_ENVIRONMENT || "").trim().toLowerCase()
  );
}

export class EmbedSetupError extends Error {
  constructor() {
    super("EMBED_SIGNING_SECRET is required outside local/development environments.");
    this.name = "EmbedSetupError";
    this.status = 503;
    this.requiredSecrets = ["EMBED_SIGNING_SECRET"];
  }
}

export async function issueEmbedTicket(tenant, origin, env, now = Date.now()) {
  if (!originAllowed(tenant, origin)) throw new Error("Origin not allowed");
  const payload = {
    tenantId: tenant.id,
    origin: normalizeOrigin(origin),
    exp: now + TICKET_TTL_MS,
    nonce: crypto.randomUUID()
  };
  const secret = String(env.EMBED_SIGNING_SECRET || "").trim();
  let ticket;
  if (!secret) {
    if (!localEnvironment(env)) throw new EmbedSetupError();
    ticket = `dev_${crypto.randomUUID()}`;
  } else {
    const encoded = base64Url(encoder.encode(JSON.stringify(payload)));
    const signature = new Uint8Array(await crypto.subtle.sign("HMAC", await signingKey(secret), encoder.encode(encoded)));
    ticket = `${encoded}.${base64Url(signature)}`;
  }
  await persistEmbedTicket(env, tenant, ticket, payload);
  return ticket;
}

export async function verifyEmbedTicket(ticket, tenant, env, now = Date.now()) {
  const value = String(ticket || "").trim();
  if (!value) return null;
  const secret = String(env.EMBED_SIGNING_SECRET || "").trim();
  let signedPayload = null;
  if (secret) {
    const [encoded, suppliedSignature, extra] = value.split(".");
    if (!encoded || !suppliedSignature || extra) return null;
    try {
      const expected = new Uint8Array(await crypto.subtle.sign("HMAC", await signingKey(secret), encoder.encode(encoded)));
      const supplied = decodeBase64Url(suppliedSignature);
      if (!timingSafeEqual(expected, supplied)) return null;
      signedPayload = JSON.parse(new TextDecoder().decode(decodeBase64Url(encoded)));
    } catch {
      return null;
    }
  } else if (!localEnvironment(env)) {
    return null;
  }

  const payload = await persistedEmbedTicket(env, tenant, value, now);
  if (!payload || payload.exp <= now || payload.tenantId !== tenant.id || !originAllowed(tenant, payload.origin)) {
    return null;
  }
  if (signedPayload && (
    signedPayload.nonce !== payload.nonce
    || signedPayload.exp !== payload.exp
    || signedPayload.tenantId !== payload.tenantId
    || signedPayload.origin !== payload.origin
  )) return null;
  return payload;
}

export function bearerTicket(request) {
  const authorization = String(request.headers.get("Authorization") || "");
  return authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
}
