import { getTenant, publicTenant } from "./tenants.js";
import {
  bearerTicket,
  corsHeaders,
  issueEmbedTicket,
  originAllowed,
  requestOrigin,
  verifyEmbedTicket
} from "./security.js";
import { quotaSnapshot, recordSessionEnd, recordSessionStart } from "./metering.js";
import { liveAvatarSetup, mintLiveAvatarSession, PlatformSetupError } from "./liveavatar.js";

const API_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'none'",
  "X-Content-Type-Options": "nosniff"
};

function json(data, status = 200, tenant = null, request = null) {
  return Response.json(data, {
    status,
    headers: {
      ...API_HEADERS,
      ...(tenant && request ? corsHeaders(tenant, request) : {})
    }
  });
}

function tenantFrom(request, input = {}) {
  const url = new URL(request.url);
  return getTenant(input.tenantId || input.appId || url.searchParams.get("tenant"));
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function authorize(request, tenant, env, input = {}) {
  const origin = requestOrigin(request);
  if (originAllowed(tenant, origin)) return { origin, method: "origin" };
  const ticket = bearerTicket(request) || String(input.embedTicket || "");
  const ticketPayload = await verifyEmbedTicket(ticket, tenant, env);
  return ticketPayload ? { origin: ticketPayload.origin, method: "ticket" } : null;
}

function setupPayload(error) {
  return {
    error: error.message,
    code: "PLATFORM_NOT_CONFIGURED",
    requiredSecrets: error.requiredSecrets,
    instructions: "Run `npx wrangler secret put <NAME> --config wrangler.claire-platform.jsonc` from claire-platform/."
  };
}

async function handlePreflight(request) {
  const tenant = tenantFrom(request);
  if (!tenant) return json({ error: "Unknown tenant" }, 404);
  if (!originAllowed(tenant, requestOrigin(request))) return json({ error: "Origin not allowed" }, 403);
  return new Response(null, { status: 204, headers: { ...API_HEADERS, ...corsHeaders(tenant, request) } });
}

async function bootstrap(request, env) {
  const tenant = tenantFrom(request);
  if (!tenant) return json({ error: "Unknown tenant" }, 404);
  const origin = requestOrigin(request);
  if (!originAllowed(tenant, origin)) return json({ error: "Origin not allowed" }, 403);
  const embedTicket = await issueEmbedTicket(tenant, origin, env);
  return json({
    embedTicket,
    expiresIn: 600,
    tenant: publicTenant(tenant)
  }, 200, tenant, request);
}

async function tenantConfig(request, env) {
  const tenant = tenantFrom(request);
  if (!tenant) return json({ error: "Unknown tenant" }, 404);
  const auth = await authorize(request, tenant, env);
  if (!auth) return json({ error: "Origin not allowed" }, 403, tenant, request);
  return json({ tenant: publicTenant(tenant) }, 200, tenant, request);
}

async function platformStatus(request, env) {
  const tenant = tenantFrom(request);
  if (!tenant) return json({ error: "Unknown tenant" }, 404);
  const auth = await authorize(request, tenant, env);
  if (!auth) return json({ error: "Origin not allowed" }, 403, tenant, request);
  return json({
    tenantId: tenant.id,
    provider: "liveavatar-realtime",
    connector: "OPENAI_REALTIME",
    ...liveAvatarSetup(env),
    quota: quotaSnapshot(tenant)
  }, 200, tenant, request);
}

async function startSession(request, env) {
  const input = await readJson(request);
  if (!input) return json({ error: "Invalid JSON request" }, 400);
  const tenant = tenantFrom(request, input);
  if (!tenant) return json({ error: "Unknown tenant" }, 404);
  const auth = await authorize(request, tenant, env, input);
  if (!auth) return json({ error: "Origin not allowed" }, 403, tenant, request);

  const quota = quotaSnapshot(tenant);
  if (!quota.allowed) {
    return json({ error: "Tenant minute quota exceeded", code: "QUOTA_EXCEEDED", quota }, 429, tenant, request);
  }

  try {
    const session = await mintLiveAvatarSession(tenant, env, input.maxSessionDuration);
    recordSessionStart(tenant, session.sessionId);
    return json({ ...session, quota: quotaSnapshot(tenant) }, 200, tenant, request);
  } catch (error) {
    if (error instanceof PlatformSetupError) return json(setupPayload(error), 503, tenant, request);
    console.error("Claire platform session mint failed", String(error?.message || error).slice(0, 240));
    return json({ error: "LiveAvatar session is temporarily unavailable" }, 502, tenant, request);
  }
}

async function endSession(request, env) {
  const input = await readJson(request);
  if (!input) return json({ error: "Invalid JSON request" }, 400);
  const tenant = tenantFrom(request, input);
  if (!tenant) return json({ error: "Unknown tenant" }, 404);
  const auth = await authorize(request, tenant, env, input);
  if (!auth) return json({ error: "Origin not allowed" }, 403, tenant, request);
  if (!String(input.sessionId || "").trim()) return json({ error: "sessionId is required" }, 400, tenant, request);
  return json({
    tenantId: tenant.id,
    sessionId: String(input.sessionId),
    quota: recordSessionEnd(tenant, input.sessionId)
  }, 200, tenant, request);
}

function compact(value, max) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

async function submitLead(request, env) {
  const input = await readJson(request);
  if (!input) return json({ error: "Invalid JSON request" }, 400);
  const tenant = tenantFrom(request, input);
  if (!tenant) return json({ error: "Unknown tenant" }, 404);
  const auth = await authorize(request, tenant, env, input);
  if (!auth) return json({ error: "Origin not allowed" }, 403, tenant, request);
  if (compact(input.website, 100)) return json({ accepted: true }, 202, tenant, request);

  const lead = {
    name: compact(input.name, 100),
    email: compact(input.email, 160),
    phone: compact(input.phone, 50),
    message: compact(input.message, 3000)
  };
  const missing = [
    ...(!lead.name ? ["name"] : []),
    ...(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email) ? ["email"] : []),
    ...(!lead.message ? ["message"] : [])
  ];
  if (missing.length) return json({ error: "Missing or invalid fields", missing }, 400, tenant, request);

  const webhook = compact(env[tenant.delivery.webhookEnv], 2048);
  if (!webhook) {
    return json({
      error: "Lead delivery is not configured",
      code: "LEAD_DELIVERY_NOT_CONFIGURED",
      requiredSecret: tenant.delivery.webhookEnv
    }, 503, tenant, request);
  }
  let webhookUrl;
  try {
    webhookUrl = new URL(webhook);
    if (webhookUrl.protocol !== "https:") throw new Error("HTTPS required");
  } catch {
    return json({ error: "Lead webhook configuration is invalid" }, 503, tenant, request);
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "claire.lead.created",
      tenantId: tenant.id,
      origin: auth.origin,
      submittedAt: new Date().toISOString(),
      lead,
      destinationEmail: compact(env[tenant.delivery.emailEnv], 160) || null
    })
  });
  if (!response.ok) return json({ error: "Lead delivery failed" }, 502, tenant, request);
  return json({ accepted: true }, 202, tenant, request);
}

async function embedPage(request, env) {
  const tenant = tenantFrom(request);
  if (!tenant) return json({ error: "Unknown tenant" }, 404);
  if (!env.ASSETS?.fetch) return new Response("Static assets binding unavailable", { status: 503 });
  const assetUrl = new URL("/embed/index.html", request.url);
  const asset = await env.ASSETS.fetch(new Request(assetUrl, request));
  const headers = new Headers(asset.headers);
  headers.set("Content-Security-Policy", [
    "default-src 'self'",
    "script-src 'self' https://unpkg.com",
    "style-src 'self'",
    "img-src 'self' data:",
    "media-src 'self' blob: https:",
    "connect-src 'self' https://api.liveavatar.com wss:",
    `frame-ancestors ${tenant.allowedOrigins.join(" ")}`
  ].join("; "));
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(asset.body, { status: asset.status, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) return handlePreflight(request);
    if (request.method === "GET" && url.pathname === "/api/embed/bootstrap") return bootstrap(request, env);
    if (request.method === "GET" && url.pathname === "/api/tenant") return tenantConfig(request, env);
    if (request.method === "GET" && url.pathname === "/api/liveavatar-status") return platformStatus(request, env);
    if (request.method === "POST" && ["/api/liveavatar-session", "/api/sessions/start"].includes(url.pathname)) {
      return startSession(request, env);
    }
    if (request.method === "POST" && url.pathname === "/api/sessions/end") return endSession(request, env);
    if (request.method === "POST" && url.pathname === "/api/leads") return submitLead(request, env);
    if (request.method === "GET" && ["/embed", "/embed/"].includes(url.pathname)) return embedPage(request, env);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, service: "claire-platform", worker: "claire-platform-dev" });
    }
    if (env.ASSETS?.fetch) return env.ASSETS.fetch(request);
    return json({ error: "Not found" }, 404);
  }
};
