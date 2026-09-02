import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

test("le Worker expose le laboratoire Claire sans extension HTML", async () => {
  const response = await worker.fetch(new Request("https://infoserv2a.test/claire-lab"), env());
  assert.equal(await response.text(), "asset:/claire-lab");
});

test("le Worker expose la spec Figma de l’aidante sans extension HTML", async () => {
  const response = await worker.fetch(new Request("https://infoserv2a.test/claire-aidant-figma"), env());
  assert.equal(await response.text(), "asset:/claire-aidant-figma");
});

test("le laboratoire Claire reste en lecture seule au niveau HTTP", async () => {
  const response = await worker.fetch(new Request("https://infoserv2a.test/claire-lab", {
    method: "POST"
  }), env());
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("Allow"), "GET, HEAD");
});

test("le Worker expose le statut LiveAvatar sans révéler de secret", async () => {
  const response = await worker.fetch(new Request("https://infoserv2a.test/api/liveavatar-status"), env());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    configured: false,
    prerequisites: {
      liveAvatar: false,
      openAIRealtime: false,
      avatar: true
    },
    provider: "liveavatar-realtime",
    connector: "OPENAI_REALTIME",
    voice: "marin",
    model: "gpt-realtime",
    mode: "LITE"
  });
});

test("le Worker refuse les méthodes inattendues sur les routes API", async () => {
  const response = await worker.fetch(new Request("https://infoserv2a.test/api/liveavatar-status", {
    method: "POST"
  }), env());
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("Allow"), "GET, OPTIONS");
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

test("le Worker expose le statut d’envoi d’e-mail", async () => {
  const response = await worker.fetch(new Request("https://infoserv2a.test/api/send-email"), env());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).configured, false);
});

test("le Worker n’attache pas encore infoserv2a.pro pour ne pas voler le domaine depuis une preview", async () => {
  const source = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  const uncommented = source.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(uncommented, /custom_domain/);
  assert.doesNotMatch(uncommented, /infoserv2a\.pro/);
  assert.match(source, /docs\/activer-claire-sur-infoserv2a-pro\.md/);
});
