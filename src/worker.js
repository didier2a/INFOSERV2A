import { onRequestGet as liveAvatarStatus } from "../functions/api/liveavatar-status.js";
import {
  onRequestOptions as liveAvatarSessionOptions,
  onRequestPost as liveAvatarSession
} from "../functions/api/liveavatar-session.js";

function methodNotAllowed(allowed) {
  return Response.json(
    { error: "Méthode non autorisée" },
    {
      status: 405,
      headers: {
        Allow: allowed.join(", "),
        "Cache-Control": "no-store",
        "Content-Security-Policy": "default-src 'none'",
        "X-Content-Type-Options": "nosniff"
      }
    }
  );
}

function assetRequest(request, pathname) {
  const url = new URL(request.url);
  url.pathname = pathname;
  return new Request(url, request);
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === "/api/liveavatar-status") {
      if (request.method !== "GET") return methodNotAllowed(["GET"]);
      return liveAvatarStatus({ request, env });
    }

    if (pathname === "/api/liveavatar-session") {
      if (request.method === "POST") return liveAvatarSession({ request, env });
      if (request.method === "OPTIONS") return liveAvatarSessionOptions({ request, env });
      return methodNotAllowed(["POST", "OPTIONS"]);
    }

    if (pathname === "/claire-lab" || pathname === "/claire-lab/") {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return methodNotAllowed(["GET", "HEAD"]);
      }
      return env.ASSETS.fetch(assetRequest(request, "/claire-lab.html"));
    }

    return env.ASSETS.fetch(request);
  }
};
