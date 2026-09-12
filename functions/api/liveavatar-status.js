import { corsHeaders, corsPreflight } from "./liveavatar-origin.js";

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

export function onRequestGet({ env, request }) {
  const liveAvatar = Boolean(env.LIVEAVATAR_API_KEY || env.HEYGEN_API_KEY);
  const realtime = Boolean(env.LIVEAVATAR_OPENAI_SECRET_ID || env.OPENAI_API_KEY);
  const avatar = true;
  const minimalProfile = String(env.LIVEAVATAR_REALTIME_DIAGNOSTIC || "").trim() === "minimal";
  return json({
    configured: liveAvatar && realtime && avatar,
    prerequisites: {
      liveAvatar,
      openAIRealtime: realtime,
      avatar
    },
    provider: "liveavatar-realtime",
    connector: "OPENAI_REALTIME",
    voice: minimalProfile ? "alloy" : "marin",
    model: String(env.LIVEAVATAR_OPENAI_MODEL || "gpt-realtime"),
    ...(realtime ? {
      realtimeProfile: minimalProfile ? "minimal" : "claire",
      realtimeCredentialSource: env.OPENAI_API_KEY ? "cloudflare-key" : "liveavatar-secret-id"
    } : {}),
    mode: "LITE"
  }, 200, request);
}

export function onRequestOptions({ request }) {
  return corsPreflight(request);
}
