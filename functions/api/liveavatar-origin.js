export function requestOrigin(request) {
  return String(request?.headers?.get("Origin") || "").trim();
}

export function isAllowedOrigin(request) {
  const origin = requestOrigin(request);
  if (!origin) return false;
  try {
    const remote = new URL(origin);
    const local = new URL(request.url);
    if (remote.origin === local.origin) return true;
    if (remote.protocol !== "https:") return false;
    const host = remote.hostname;
    if (host === "infoserv2a.pro" || host === "www.infoserv2a.pro") return true;
    if (host.endsWith(".infoserv2a.workers.dev")) return true;
    return false;
  } catch {
    return false;
  }
}

export function corsHeaders(request) {
  if (!isAllowedOrigin(request)) return {};
  return {
    "Access-Control-Allow-Origin": requestOrigin(request),
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

export function corsPreflight(request) {
  if (!isAllowedOrigin(request)) {
    return new Response(null, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(request),
      "Cache-Control": "no-store",
      "Access-Control-Max-Age": "86400"
    }
  });
}
