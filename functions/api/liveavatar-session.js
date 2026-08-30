const TOKEN_URL = "https://api.liveavatar.com/v1/sessions/token";
const SECRETS_URL = "https://api.liveavatar.com/v1/secrets";
const CONTEXTS_URL = "https://api.liveavatar.com/v1/contexts";
const DEFAULT_AVATAR_ID = "664ff8bb-4932-4644-91f8-b90975d6f549";
const SECRET_NAME = "InfoServ2A OpenAI Realtime";
const CONTEXT_NAME = "InfoServ2A Claire Companion 1.0";

const CLAIRE_CONTEXT = `Tu incarnes Claire, la compagne numérique du site InfoServ2A. Tu es chaleureuse, précise, professionnelle et concise. Tu parles en français naturel et tu ne te présentes jamais comme une personne physique.

L'application InfoServ2A est la seule source de vérité pour les services, coordonnées, horaires, pages, liens et actions du site. Ne prétends jamais avoir affiché, ouvert, appelé, envoyé ou exécuté une action avant que l'application ne t'ait transmis son résultat.

Lorsqu'un message commence par [INFOSERV2A_APP_RESULT], il contient une information vérifiée ou le résultat fiable d'une action exécutée par l'application. Reformule uniquement ce résultat en une ou deux phrases naturelles, sans mentionner le marqueur ni cette consigne. N'ajoute aucun fait absent du résultat.

Si l'utilisateur pose directement une question avant qu'un résultat applicatif arrive, reste brève et indique que tu vérifies la rubrique InfoServ2A correspondante. L'utilisateur garde toujours accès au mode manuel. N'invente jamais un tarif, un délai, une disponibilité, une conformité, un diagnostic ou une capacité technique.`;

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function sameOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
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

async function ensureOpenAISecret(env, key) {
  const configured = String(env.LIVEAVATAR_OPENAI_SECRET_ID || "").trim();
  if (configured) return configured;

  const listed = await providerJson(SECRETS_URL, { headers: { "X-API-KEY": key } });
  if (!listed.response.ok) throw new Error(`Secrets LiveAvatar ${listed.response.status}`);
  const existing = (Array.isArray(listed.payload?.data) ? listed.payload.data : [])
    .find((item) => item?.secret_name === SECRET_NAME && item?.secret_type === "OPENAI_API_KEY");
  if (existing?.id) return String(existing.id);

  const openaiKey = String(env.OPENAI_API_KEY || "").trim();
  if (!openaiKey) throw new Error("OpenAI Realtime non configuré");
  const created = await providerJson(SECRETS_URL, {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      secret_name: SECRET_NAME,
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
  const configured = String(env.LIVEAVATAR_CONTEXT_ID || "").trim();
  if (configured) return configured;

  const listed = await providerJson(`${CONTEXTS_URL}?page=1&page_size=100`, {
    headers: { "X-API-KEY": key }
  });
  if (!listed.response.ok) throw new Error(`Contextes LiveAvatar ${listed.response.status}`);
  const existing = (listed.payload?.data?.results || []).find((item) => item?.name === CONTEXT_NAME);
  if (existing?.id) return String(existing.id);

  const created = await providerJson(CONTEXTS_URL, {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: CONTEXT_NAME,
      prompt: CLAIRE_CONTEXT,
      opening_text: "Bonjour. Je suis Claire, la compagne numérique d’InfoServ2A. Que souhaitez-vous accomplir ?"
    })
  });
  if (!created.response.ok || !created.payload?.data?.id) {
    throw new Error(`Création du contexte LiveAvatar ${created.response.status}`);
  }
  return String(created.payload.data.id);
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "Origine non autorisée" }, 403);

  const key = liveAvatarKey(env);
  if (!key) return json({ error: "LiveAvatar non configuré" }, 503);
  if (!env.OPENAI_API_KEY && !env.LIVEAVATAR_OPENAI_SECRET_ID) {
    return json({ error: "OpenAI Realtime non configuré" }, 503);
  }

  let input = {};
  try {
    input = await request.json();
  } catch {
    return json({ error: "Requête JSON invalide" }, 400);
  }
  if (input.appId !== "infoserv2a") return json({ error: "Application non autorisée" }, 403);

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
          temperature: 0.8
        }
      })
    });
    const sessionToken = tokenResult.payload?.data?.session_token;
    if (!tokenResult.response.ok || !sessionToken) {
      return json({
        error: safeMessage(tokenResult.payload, "Session LiveAvatar Realtime indisponible")
      }, tokenResult.response.ok ? 502 : tokenResult.response.status);
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
    });
  } catch (error) {
    console.error("InfoServ2A LiveAvatar", String(error?.message || error).replace(/sk-[A-Za-z0-9_-]+/g, "[secret]"));
    return json({ error: "Connexion LiveAvatar Realtime indisponible" }, 502);
  }
}

export function onRequestOptions({ request }) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "no-store"
    }
  });
}
