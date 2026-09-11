import assert from "node:assert/strict";
import test from "node:test";

import worker from "../src/worker.js";
import {
  onRequestPost,
  resetNeedSynthesisRateLimit
} from "../functions/api/synthesize-need.js";

function env(overrides = {}) {
  return {
    ASSETS: { fetch: () => new Response("asset") },
    ...overrides
  };
}

function post(body, origin = "https://www.infoserv2a.pro") {
  return new Request("https://www.infoserv2a.pro/api/synthesize-need", {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      "CF-Connecting-IP": "192.0.2.10"
    },
    body: JSON.stringify(body)
  });
}

const input = {
  appId: "infoserv2a",
  turns: [
    { role: "user", text: "Salut Claire, faisons un devis pour un site web de boulangerie en partant de zéro." },
    { role: "companion", text: "Avez-vous déjà un local ?" },
    { role: "user", text: "Oui, un local professionnel." }
  ],
  facts: {
    name: "",
    status: "Professionnel",
    service: "creation-site-web",
    city: "",
    constraints: "",
    urgency: ""
  }
};

test("POST /api/synthesize-need refuse une origine étrangère", async () => {
  const response = await onRequestPost({
    request: post(input, "https://example.net"),
    env: { OPENAI_API_KEY: "test-key" }
  });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).fallback, true);
});

test("POST /api/synthesize-need demande une clé uniquement côté Worker", async () => {
  const response = await worker.fetch(post(input), env());
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: "Rédacteur silencieux non configuré",
    fallback: true
  });
});

test("GET /api/synthesize-need indique si le rédacteur est configuré", async () => {
  const missing = await worker.fetch(
    new Request("https://www.infoserv2a.pro/api/synthesize-need"),
    env()
  );
  assert.deepEqual(await missing.json(), { configured: false });
  const configured = await worker.fetch(
    new Request("https://www.infoserv2a.pro/api/synthesize-need"),
    env({ OPENAI_API_KEY: "test-key" })
  );
  assert.deepEqual(await configured.json(), { configured: true });
});

test("POST /api/synthesize-need renvoie le canevas JSON structuré d’OpenAI", async () => {
  resetNeedSynthesisRateLimit();
  const originalFetch = globalThis.fetch;
  let outbound;
  globalThis.fetch = async (url, options) => {
    outbound = { url: String(url), options, body: JSON.parse(options.body) };
    return Response.json({
      choices: [{
        message: {
          content: JSON.stringify({
            qui: "Nom inventé",
            statut: "Professionnel",
            besoin: "Le client souhaite créer un site web pour sa boulangerie. Le projet part de zéro. Le site devra présenter clairement l’activité. Le visiteur souhaite disposer d’une présence professionnelle en ligne.",
            lieu: "Ville inventée",
            contraintes: "À préciser",
            urgence: "À préciser"
          })
        }
      }]
    });
  };
  try {
    const response = await worker.fetch(post(input), env({ OPENAI_API_KEY: "test-key" }));
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.qui, "À préciser");
    assert.equal(payload.lieu, "À préciser");
    assert.match(payload.besoin, /boulangerie/i);
    assert.match(payload.besoin, /site web/i);
    assert.equal(outbound.url, "https://api.openai.com/v1/chat/completions");
    assert.equal(outbound.options.headers.Authorization, "Bearer test-key");
    assert.equal(outbound.body.model, "gpt-4o-mini");
    assert.equal(outbound.body.response_format.type, "json_schema");
    assert.equal(outbound.body.messages[0].role, "system");
    assert.doesNotMatch(JSON.stringify(payload), /test-key/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
