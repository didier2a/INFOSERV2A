import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function loadFunction(relativePath) {
  const source = await readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
  const encoded = Buffer.from(source).toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

const statusFunction = await loadFunction("functions/api/liveavatar-status.js");
const sessionFunction = await loadFunction("functions/api/liveavatar-session.js");

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
    assert.equal(outbound.url, "https://api.liveavatar.com/v1/sessions/token");
    const body = JSON.parse(outbound.options.body);
    assert.equal(body.avatar_id, "avatar-ref");
    assert.equal(body.openai_realtime_config.secret_id, "secret-ref");
    assert.equal(body.openai_realtime_config.context_id, "context-ref");
    assert.equal(body.max_session_duration, 300);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
