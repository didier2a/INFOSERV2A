const encoder = new TextEncoder();
const fallbackTickets = new Map();
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

export async function issueEmbedTicket(tenant, origin, env, now = Date.now()) {
  if (!originAllowed(tenant, origin)) throw new Error("Origin not allowed");
  const payload = {
    tenantId: tenant.id,
    origin: normalizeOrigin(origin),
    exp: now + TICKET_TTL_MS,
    nonce: crypto.randomUUID()
  };
  const secret = String(env.EMBED_SIGNING_SECRET || "").trim();
  if (!secret) {
    const ticket = `dev_${crypto.randomUUID()}`;
    fallbackTickets.set(ticket, payload);
    return ticket;
  }
  const encoded = base64Url(encoder.encode(JSON.stringify(payload)));
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", await signingKey(secret), encoder.encode(encoded)));
  return `${encoded}.${base64Url(signature)}`;
}

export async function verifyEmbedTicket(ticket, tenant, env, now = Date.now()) {
  const value = String(ticket || "").trim();
  const secret = String(env.EMBED_SIGNING_SECRET || "").trim();
  let payload;

  if (!secret) {
    payload = fallbackTickets.get(value);
  } else {
    const [encoded, suppliedSignature, extra] = value.split(".");
    if (!encoded || !suppliedSignature || extra) return null;
    try {
      const expected = new Uint8Array(await crypto.subtle.sign("HMAC", await signingKey(secret), encoder.encode(encoded)));
      const supplied = decodeBase64Url(suppliedSignature);
      if (!timingSafeEqual(expected, supplied)) return null;
      payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(encoded)));
    } catch {
      return null;
    }
  }

  if (!payload || payload.exp <= now || payload.tenantId !== tenant.id || !originAllowed(tenant, payload.origin)) {
    if (!secret) fallbackTickets.delete(value);
    return null;
  }
  return payload;
}

export function bearerTicket(request) {
  const authorization = String(request.headers.get("Authorization") || "");
  return authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
}

export function resetFallbackTickets() {
  fallbackTickets.clear();
}
