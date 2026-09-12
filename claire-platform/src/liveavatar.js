const TOKEN_URL = "https://api.liveavatar.com/v1/sessions/token";
const SECRETS_URL = "https://api.liveavatar.com/v1/secrets";
const CONTEXTS_URL = "https://api.liveavatar.com/v1/contexts";
const DEFAULT_AVATAR_ID = "664ff8bb-4932-4644-91f8-b90975d6f549";
const contextCache = new Map();
let secretCache = "";

export class PlatformSetupError extends Error {
  constructor(message, requiredSecrets) {
    super(message);
    this.name = "PlatformSetupError";
    this.status = 503;
    this.requiredSecrets = requiredSecrets;
  }
}

async function providerJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

function configuredContextId(tenant, env) {
  const suffix = tenant.id.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  return String(env[`LIVEAVATAR_CONTEXT_ID_${suffix}`] || "").trim();
}

async function fingerprint(value) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return Array.from(digest.slice(0, 8), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function ensureOpenAISecret(env, liveAvatarKey) {
  const configured = String(env.LIVEAVATAR_OPENAI_SECRET_ID || "").trim();
  if (configured) return configured;
  if (secretCache) return secretCache;

  const openAIKey = String(env.OPENAI_API_KEY || "").trim();
  const secretName = `Claire Platform OpenAI ${await fingerprint(openAIKey)}`;
  const listed = await providerJson(SECRETS_URL, { headers: { "X-API-KEY": liveAvatarKey } });
  if (!listed.response.ok) throw new Error(`LiveAvatar secrets returned ${listed.response.status}`);
  const existing = (Array.isArray(listed.payload?.data) ? listed.payload.data : [])
    .find((item) => item?.secret_name === secretName && item?.secret_type === "OPENAI_API_KEY");
  if (existing?.id) {
    secretCache = String(existing.id);
    return secretCache;
  }

  const created = await providerJson(SECRETS_URL, {
    method: "POST",
    headers: { "X-API-KEY": liveAvatarKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      secret_name: secretName,
      secret_type: "OPENAI_API_KEY",
      secret_value: openAIKey
    })
  });
  if (!created.response.ok || !created.payload?.data?.id) {
    throw new Error(`LiveAvatar secret creation returned ${created.response.status}`);
  }
  secretCache = String(created.payload.data.id);
  return secretCache;
}

function tenantPrompt(tenant) {
  return [
    `Tu es ${tenant.persona.name}, conseillère de ${tenant.displayName}.`,
    tenant.persona.instructions,
    "Réponds en français naturel et professionnel. Ne prétends jamais avoir envoyé un formulaire.",
    "Connaissances vérifiées :",
    ...tenant.knowledge.map((item) => `- ${item}`)
  ].join("\n");
}

async function ensureTenantContext(tenant, env, liveAvatarKey) {
  const configured = configuredContextId(tenant, env);
  if (configured) return configured;
  if (contextCache.has(tenant.id)) return contextCache.get(tenant.id);

  const contextName = `Claire Platform / ${tenant.id} / v1`;
  const listed = await providerJson(`${CONTEXTS_URL}?page=1&page_size=100`, {
    headers: { "X-API-KEY": liveAvatarKey }
  });
  if (listed.response.ok) {
    const existing = (listed.payload?.data?.results || []).find((item) => item?.name === contextName);
    if (existing?.id) {
      contextCache.set(tenant.id, String(existing.id));
      return String(existing.id);
    }
  }

  const created = await providerJson(CONTEXTS_URL, {
    method: "POST",
    headers: { "X-API-KEY": liveAvatarKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: contextName,
      prompt: tenantPrompt(tenant),
      opening_text: tenant.persona.greeting
    })
  });
  if (!created.response.ok || !created.payload?.data?.id) {
    throw new Error(`LiveAvatar context creation returned ${created.response.status}`);
  }
  const contextId = String(created.payload.data.id);
  contextCache.set(tenant.id, contextId);
  return contextId;
}

export function liveAvatarSetup(env) {
  const liveAvatar = Boolean(String(env.LIVEAVATAR_API_KEY || "").trim());
  const openAIRealtime = Boolean(
    String(env.LIVEAVATAR_OPENAI_SECRET_ID || "").trim()
    || String(env.OPENAI_API_KEY || "").trim()
  );
  return {
    configured: liveAvatar && openAIRealtime,
    prerequisites: { liveAvatar, openAIRealtime },
    requiredSecrets: [
      ...(liveAvatar ? [] : ["LIVEAVATAR_API_KEY"]),
      ...(openAIRealtime ? [] : ["OPENAI_API_KEY or LIVEAVATAR_OPENAI_SECRET_ID"])
    ]
  };
}

export async function mintLiveAvatarSession(tenant, env, requestedSeconds) {
  const setup = liveAvatarSetup(env);
  if (!setup.configured) {
    throw new PlatformSetupError(
      "LiveAvatar/OpenAI is not configured. Add the listed Worker secrets, then retry.",
      setup.requiredSecrets
    );
  }

  const key = String(env.LIVEAVATAR_API_KEY).trim();
  const [secretId, contextId] = await Promise.all([
    ensureOpenAISecret(env, key),
    ensureTenantContext(tenant, env, key)
  ]);
  const maxSessionDuration = Math.min(
    tenant.quota.maxSessionSeconds,
    Math.max(60, Number(requestedSeconds) || tenant.quota.maxSessionSeconds)
  );
  const model = String(env.LIVEAVATAR_OPENAI_MODEL || "gpt-realtime").trim();
  const voice = tenant.persona.voice || "marin";
  const tokenResult = await providerJson(TOKEN_URL, {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "LITE",
      avatar_id: String(env.LIVEAVATAR_AVATAR_ID || DEFAULT_AVATAR_ID).trim(),
      is_sandbox: String(env.LIVEAVATAR_SANDBOX || "").toLowerCase() === "true",
      max_session_duration: maxSessionDuration,
      video_settings: { quality: "high", encoding: "H264" },
      openai_realtime_config: {
        secret_id: secretId,
        context_id: contextId,
        voice,
        model,
        temperature: 0.75
      }
    })
  });
  const data = tokenResult.payload?.data || {};
  if (!tokenResult.response.ok || !data.session_token) {
    throw new Error(`LiveAvatar session mint returned ${tokenResult.response.status}`);
  }
  return {
    sessionToken: String(data.session_token),
    sessionId: String(data.session_id || crypto.randomUUID()),
    maxSessionDuration,
    mode: "LITE",
    connector: "OPENAI_REALTIME",
    voice,
    model,
    orientation: "vertical",
    appId: tenant.id,
    tenantId: tenant.id
  };
}
