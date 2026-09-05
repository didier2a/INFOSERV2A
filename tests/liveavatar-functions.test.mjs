import assert from "node:assert/strict";
import test from "node:test";

import { isAllowedOrigin } from "../functions/api/liveavatar-origin.js";
import { onRequestGet, onRequestOptions as statusOptions } from "../functions/api/liveavatar-status.js";
import { onRequestPost, onRequestOptions as sessionOptions } from "../functions/api/liveavatar-session.js";

const statusFunction = { onRequestGet, onRequestOptions: statusOptions };
const sessionFunction = { onRequestPost, onRequestOptions: sessionOptions };

function request(origin = "https://preview.infoserv2a.pages.dev", body = { appId: "infoserv2a" }) {
  return new Request(`${origin}/api/liveavatar-session`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

test("le statut reste désactivé sans secrets Cloudflare", async () => {
  const response = statusFunction.onRequestGet({ env: {} });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.configured, false);
});

test("le statut s’active avec LiveAvatar et OpenAI Realtime", async () => {
  const response = statusFunction.onRequestGet({
    env: {
      LIVEAVATAR_API_KEY: "configured",
      LIVEAVATAR_OPENAI_SECRET_ID: "secret-ref"
    }
  });
  assert.equal((await response.json()).configured, true);
});

test("le statut confirme le modèle vocal sans exposer les secrets", async () => {
  const payload = await statusFunction.onRequestGet({ env: {} }).json();
  assert.equal(payload.voice, "marin");
  assert.equal(payload.model, "gpt-realtime");
  assert.deepEqual(payload.prerequisites, {
    liveAvatar: false,
    openAIRealtime: false,
    avatar: true
  });
});

test("la création de session refuse une origine différente", async () => {
  const incoming = new Request("https://infoserv2a.pro/api/liveavatar-session", {
    method: "POST",
    headers: { Origin: "https://example.net", "Content-Type": "application/json" },
    body: JSON.stringify({ appId: "infoserv2a" })
  });
  const response = await sessionFunction.onRequestPost({ request: incoming, env: {} });
  assert.equal(response.status, 403);
});

test("le domaine public peut demander une session au Worker Cloudflare", async () => {
  const incoming = new Request("https://infoserv2a.infoserv2a.workers.dev/api/liveavatar-session", {
    method: "POST",
    headers: { Origin: "https://infoserv2a.pro", "Content-Type": "application/json" },
    body: JSON.stringify({ appId: "infoserv2a" })
  });
  const response = await sessionFunction.onRequestPost({ request: incoming, env: {} });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://infoserv2a.pro");
});

test("une prévisualisation Workers est une origine autorisée", () => {
  const request = new Request("https://infoserv2a.infoserv2a.workers.dev/api/liveavatar-session", {
    method: "POST",
    headers: { Origin: "https://cursor-live-avatar-aidant-8f54-infoserv2a.infoserv2a.workers.dev" }
  });
  assert.equal(isAllowedOrigin(request), true);
});

test("le préflight CORS accepte infoserv2a.pro", async () => {
  const incoming = new Request("https://infoserv2a.infoserv2a.workers.dev/api/liveavatar-session", {
    method: "OPTIONS",
    headers: {
      Origin: "https://infoserv2a.pro",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type"
    }
  });
  const response = sessionFunction.onRequestOptions({ request: incoming });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://infoserv2a.pro");
});

test("la création de session échoue proprement sans configuration", async () => {
  const response = await sessionFunction.onRequestPost({ request: request(), env: {} });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "LiveAvatar non configuré");
});

test("la création de session ne sert que l’application InfoServ2A", async () => {
  const response = await sessionFunction.onRequestPost({
    request: request(undefined, { appId: "autre-site" }),
    env: { LIVEAVATAR_API_KEY: "configured", LIVEAVATAR_OPENAI_SECRET_ID: "secret-ref" }
  });
  assert.equal(response.status, 403);
});

test("la fonction échange les références serveur contre un jeton éphémère", async () => {
  const originalFetch = globalThis.fetch;
  let outbound = null;
  globalThis.fetch = async (url, options) => {
    outbound = { url: String(url), options };
    return Response.json({ data: { session_token: "ephemeral-test-token", session_id: "session-test" } });
  };
  try {
    const response = await sessionFunction.onRequestPost({
      request: request(),
      env: {
        LIVEAVATAR_API_KEY: "configured",
        LIVEAVATAR_OPENAI_SECRET_ID: "secret-ref",
        LIVEAVATAR_CONTEXT_ID: "context-ref",
        LIVEAVATAR_AVATAR_ID: "avatar-ref"
      }
    });
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.sessionToken, "ephemeral-test-token");
    assert.equal(payload.appId, "infoserv2a");
    assert.equal(payload.maxSessionDuration, 600);
    assert.equal(outbound.url, "https://api.liveavatar.com/v1/sessions/token");
    const body = JSON.parse(outbound.options.body);
    assert.equal(body.avatar_id, "avatar-ref");
    assert.equal(body.openai_realtime_config.secret_id, "secret-ref");
    assert.equal(body.openai_realtime_config.context_id, "context-ref");
    assert.equal(body.openai_realtime_config.temperature, 0.75);
    assert.equal(body.max_session_duration, 600);
    assert.equal(body.max_session_duration * 1000, 600_000);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("une nouvelle clé Cloudflare crée une nouvelle référence LiveAvatar", async () => {
  const originalFetch = globalThis.fetch;
  const outbound = [];
  globalThis.fetch = async (url, options = {}) => {
    outbound.push({ url: String(url), options });
    if (String(url).endsWith("/v1/secrets") && !options.method) {
      return Response.json({ data: [{ id: "stale", secret_name: "InfoServ2A OpenAI Realtime", secret_type: "OPENAI_API_KEY" }] });
    }
    if (String(url).endsWith("/v1/secrets") && options.method === "POST") {
      return Response.json({ data: { id: "rotated-secret" } });
    }
    return Response.json({ data: { session_token: "rotated-token", session_id: "rotated-session" } });
  };
  try {
    const response = await sessionFunction.onRequestPost({
      request: request(),
      env: {
        LIVEAVATAR_API_KEY: "configured",
        OPENAI_API_KEY: "sk-test-new-value",
        LIVEAVATAR_CONTEXT_ID: "context-ref",
        LIVEAVATAR_AVATAR_ID: "avatar-ref"
      }
    });
    assert.equal(response.status, 200);
    const created = outbound.find((item) => item.url.endsWith("/v1/secrets") && item.options.method === "POST");
    assert.ok(created);
    const secretBody = JSON.parse(created.options.body);
    assert.match(secretBody.secret_name, /^InfoServ2A OpenAI Realtime [0-9a-f]{16}$/);
    assert.equal(secretBody.secret_value, "sk-test-new-value");
    const token = outbound.find((item) => item.url.endsWith("/v1/sessions/token"));
    assert.equal(JSON.parse(token.options.body).openai_realtime_config.secret_id, "rotated-secret");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("si LiveAvatar refuse 600 s, la session retombe sur la durée du plan", async () => {
  const originalFetch = globalThis.fetch;
  const tokenBodies = [];
  let tokenCalls = 0;
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes("/v1/sessions/token")) {
      tokenCalls += 1;
      tokenBodies.push(JSON.parse(options.body));
      if (tokenCalls === 1) {
        return Response.json(
          { message: "max_session_duration (600s) exceeds the maximum allowed (300s)" },
          { status: 400 }
        );
      }
      return Response.json({ data: { session_token: "plan-token", session_id: "plan-session" } });
    }
    return Response.json({ data: { results: [] } });
  };
  try {
    const response = await sessionFunction.onRequestPost({
      request: request(),
      env: {
        LIVEAVATAR_API_KEY: "configured",
        LIVEAVATAR_OPENAI_SECRET_ID: "secret-ref",
        LIVEAVATAR_CONTEXT_ID: "context-ref",
        LIVEAVATAR_AVATAR_ID: "avatar-ref"
      }
    });
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.sessionToken, "plan-token");
    assert.equal(payload.maxSessionDuration, 300);
    assert.equal(tokenCalls, 2);
    assert.equal(tokenBodies[0].max_session_duration, 600);
    assert.equal(tokenBodies[1].max_session_duration, 300);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
