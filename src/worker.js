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

    return env.ASSETS.fetch(request);
  }
};
