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

export function onRequestGet({ env }) {
  const liveAvatar = Boolean(env.LIVEAVATAR_API_KEY || env.HEYGEN_API_KEY);
  const realtime = Boolean(env.LIVEAVATAR_OPENAI_SECRET_ID || env.OPENAI_API_KEY);
  const avatar = true;
  return json({
    configured: liveAvatar && realtime && avatar,
    prerequisites: {
      liveAvatar,
      openAIRealtime: realtime,
      avatar
    },
    provider: "liveavatar-realtime",
    connector: "OPENAI_REALTIME",
    voice: "marin",
    model: String(env.LIVEAVATAR_OPENAI_MODEL || "gpt-realtime"),
    mode: "LITE"
  });
}
