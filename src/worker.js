import {
  onRequestGet as liveAvatarStatus,
  onRequestOptions as liveAvatarStatusOptions
} from "../functions/api/liveavatar-status.js";
import {
  onRequestOptions as liveAvatarSessionOptions,
  onRequestPost as liveAvatarSession
} from "../functions/api/liveavatar-session.js";
import {
  onRequestGet as sendEmailStatus,
  onRequestOptions as sendEmailOptions,
  onRequestPost as sendEmail
} from "../functions/api/send-email.js";

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

function requestHostname(request) {
  const url = new URL(request.url);
  const headerHost = request.headers.get("Host");
  return (headerHost || url.hostname).split(":")[0].toLowerCase();
}

function isWorkerPreviewHost(hostname) {
  return hostname.endsWith(".workers.dev");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = requestHostname(request);

    // Apex uniquement : jamais www, jamais *.workers.dev, jamais localhost.
    if (host === "infoserv2a.pro" && !isWorkerPreviewHost(url.hostname) && !isWorkerPreviewHost(host)) {
      return new Response(null, {
        status: 301,
        headers: {
          Location: `https://www.infoserv2a.pro${url.pathname}${url.search}`
        }
      });
    }

    const { pathname } = url;

    if (pathname === "/api/liveavatar-status") {
      if (request.method === "GET") return liveAvatarStatus({ request, env });
      if (request.method === "OPTIONS") return liveAvatarStatusOptions({ request, env });
      return methodNotAllowed(["GET", "OPTIONS"]);
    }

    if (pathname === "/api/liveavatar-session") {
      if (request.method === "POST") return liveAvatarSession({ request, env });
      if (request.method === "OPTIONS") return liveAvatarSessionOptions({ request, env });
      return methodNotAllowed(["POST", "OPTIONS"]);
    }

    if (pathname === "/api/send-email") {
      if (request.method === "GET") return sendEmailStatus({ request, env });
      if (request.method === "POST") return sendEmail({ request, env });
      if (request.method === "OPTIONS") return sendEmailOptions({ request, env });
      return methodNotAllowed(["GET", "POST", "OPTIONS"]);
    }

    if (
      pathname === "/claire-lab" || pathname === "/claire-lab/"
      || pathname === "/claire-aidant-figma" || pathname === "/claire-aidant-figma/"
      || pathname === "/voyage" || pathname === "/voyage/"
    ) {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return methodNotAllowed(["GET", "HEAD"]);
      }
      return env.ASSETS.fetch(request);
    }

    return env.ASSETS.fetch(request);
  }
};
