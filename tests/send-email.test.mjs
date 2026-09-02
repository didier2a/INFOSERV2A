import assert from "node:assert/strict";
import test from "node:test";

import worker from "../src/worker.js";
import {
  allowEmailRequest,
  deliverSiteEmail,
  emailConfigured,
  normalizeEmailPayload,
  onRequestPost,
  resetEmailRateLimit,
  resolveEmailProvider
} from "../functions/api/send-email.js";
import { describeEmailSendOutcome } from "../assets/js/site-email.mjs";

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

function post(body, { origin = "https://www.infoserv2a.pro", url = "https://www.infoserv2a.pro" } = {}) {
  return new Request(`${url}/api/send-email`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

test("sans relais, l’envoi n’est pas configuré", () => {
  assert.equal(resolveEmailProvider({ EMAIL_PROVIDER: "none" }), "none");
  assert.equal(emailConfigured({ EMAIL_PROVIDER: "none" }), false);
});

test("Resend ou le binding Cloudflare activent l’envoi", () => {
  assert.equal(resolveEmailProvider({ RESEND_API_KEY: "re_test" }), "resend");
  assert.equal(resolveEmailProvider({ EMAIL: { send() {} } }), "cloudflare-email");
});

test("le payload refuse un message incomplet et ignore le honeypot", () => {
  const incomplete = normalizeEmailPayload({ kind: "contact", email: "pas-un-mail" });
  assert.deepEqual(incomplete.missing.sort(), ["email", "message", "name"]);
  const trapped = normalizeEmailPayload({
    kind: "contact",
    name: "Bot",
    email: "bot@example.com",
    message: "spam",
    website: "https://spam.example"
  });
  assert.equal(trapped.honeypot, true);
});

test("GET /api/send-email décrit le fournisseur sans secret", async () => {
  const response = await worker.fetch(new Request("https://infoserv2a.test/api/send-email"), env({
    EMAIL_PROVIDER: "none"
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    configured: false,
    provider: null,
    inboxes: {
      contact: "contact@infoserv2a.pro",
      devis: "devis@infoserv2a.pro"
    }
  });
});

test("POST refuse une origine étrangère", async () => {
  const response = await onRequestPost({
    request: post({ kind: "contact", name: "Didier", email: "didier@example.com", message: "Essai" }, { origin: "https://example.net" }),
    env: { EMAIL: { send() { return { messageId: "x" }; } } }
  });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).sent, false);
});

test("POST envoie réellement via le binding Cloudflare", async () => {
  resetEmailRateLimit();
  const sent = [];
  const response = await onRequestPost({
    request: post({
      kind: "contact",
      name: "Didier",
      email: "didier@example.com",
      message: "Essai d’envoi réel"
    }),
    env: {
      EMAIL: {
        async send(payload) {
          sent.push(payload);
          return { messageId: "cf-1" };
        }
      }
    }
  });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.sent, true);
  assert.equal(payload.inbox, "contact@infoserv2a.pro");
  assert.equal(payload.replyTo, "didier@example.com");
  assert.equal(sent[0].to, "contact@infoserv2a.pro");
  assert.match(sent[0].text, /Essai d’envoi réel/);
});

test("POST devis part vers devis@ et non vers l’adresse du visiteur", async () => {
  resetEmailRateLimit();
  const sent = [];
  const response = await onRequestPost({
    request: post({
      kind: "devis",
      name: "Marie Rossi",
      phone: "07 45 15 60 76",
      email: "marie@example.com",
      city: "Porto-Vecchio",
      service: "videosurveillance",
      description: "Caméra 4G"
    }),
    env: {
      EMAIL: {
        async send(payload) {
          sent.push(payload);
          return { messageId: "cf-2" };
        }
      }
    }
  });
  const payload = await response.json();
  assert.equal(payload.sent, true);
  assert.equal(payload.inbox, "devis@infoserv2a.pro");
  assert.equal(sent[0].to, "devis@infoserv2a.pro");
  assert.equal(sent[0].reply_to, "marie@example.com");
});

test("FormSubmit signale une activation au lieu de prétendre que c’est parti", async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async () => Response.json({
    success: "false",
    message: "Make sure you activate FormSubmit by visiting the email"
  });
  try {
    const delivery = await deliverSiteEmail({ EMAIL_PROVIDER: "formsubmit" }, normalizeEmailPayload({
      kind: "contact",
      name: "Didier",
      email: "didier@example.com",
      message: "Premier essai"
    }));
    assert.equal(delivery.pendingActivation, true);
    assert.equal(delivery.provider, "formsubmit");
  } finally {
    globalThis.fetch = previous;
  }
});

test("le limiteur refuse une rafale depuis la même IP", () => {
  resetEmailRateLimit();
  for (let index = 0; index < 6; index += 1) {
    assert.equal(allowEmailRequest("1.2.3.4", 1_000 + index), true);
  }
  assert.equal(allowEmailRequest("1.2.3.4", 1_010), false);
  assert.equal(allowEmailRequest("9.9.9.9", 1_010), true);
});

test("Claire ne dit pas que c’est parti si l’API n’a pas envoyé", () => {
  const failed = describeEmailSendOutcome({
    results: [{ tool: "compose_email", output: { sent: false, configured: false } }]
  });
  assert.match(failed, /pas encore branché|pas pu envoyer/);
  const ok = describeEmailSendOutcome({
    results: [{ tool: "compose_email", output: { sent: true, inbox: "contact@infoserv2a.pro", replyTo: "didier@example.com" } }]
  });
  assert.match(ok, /bien été envoyé vers contact@infoserv2a\.pro/);
  assert.match(ok, /didier@example.com/);
});
