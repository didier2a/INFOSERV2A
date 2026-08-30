import assert from "node:assert/strict";
import test from "node:test";

import worker from "../src/worker.js";

function env(overrides = {}) {
  return {
    ASSETS: {
      fetch(request) {
        return new Response(`asset:${new URL(request.url).pathname}`);
      }
    },
    ...overrides
  };
}

test("le Worker sert les actifs du site hors API", async () => {
  const response = await worker.fetch(new Request("https://infoserv2a.test/contact.html"), env());
  assert.equal(await response.text(), "asset:/contact.html");
});

test("le Worker expose le statut LiveAvatar sans révéler de secret", async () => {
  const response = await worker.fetch(new Request("https://infoserv2a.test/api/liveavatar-status"), env());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    configured: false,
    provider: "liveavatar-realtime",
    connector: "OPENAI_REALTIME",
    mode: "LITE"
  });
});

test("le Worker refuse les méthodes inattendues sur les routes API", async () => {
  const response = await worker.fetch(new Request("https://infoserv2a.test/api/liveavatar-status", {
    method: "POST"
  }), env());
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("Allow"), "GET");
});

test("la route de session échoue proprement sans secret Cloudflare", async () => {
  const request = new Request("https://infoserv2a.test/api/liveavatar-session", {
    method: "POST",
    headers: {
      Origin: "https://infoserv2a.test",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ appId: "infoserv2a" })
  });
  const response = await worker.fetch(request, env());
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "LiveAvatar non configuré");
});
