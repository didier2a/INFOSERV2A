import assert from "node:assert/strict";
import test from "node:test";

import worker from "../src/worker.js";
import {
  allowEmailRequest,
  deliverSiteEmail,
  emailConfigured,
  DEFAULT_FROM,
  normalizeEmailPayload,
  onRequestGet,
  onRequestPost,
  resetEmailRateLimit,
  resolveEmailProvider,
  summarizeResendEmail
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
  assert.equal(resolveEmailProvider({}), "none");
  assert.equal(resolveEmailProvider({ EMAIL_PROVIDER: "none" }), "none");
  assert.equal(emailConfigured({}), false);
});

test("Resend ou le binding Cloudflare activent l’envoi", () => {
  assert.equal(resolveEmailProvider({ RESEND_API_KEY: "re_test" }), "resend");
  assert.equal(resolveEmailProvider({ EMAIL: { send() {} } }), "cloudflare-email");
});

test("l’expéditeur par défaut n’est plus noreply ni la boîte contact@", () => {
  assert.match(DEFAULT_FROM, /site@infoserv2a\.pro/);
  assert.doesNotMatch(DEFAULT_FROM, /noreply@/);
  assert.doesNotMatch(DEFAULT_FROM, /contact@/);
});

test("Resend envoie depuis contact@ avec texte et HTML", async () => {
  const previous = globalThis.fetch;
  const sent = [];
  globalThis.fetch = async (url, options) => {
    sent.push({ url: String(url), body: JSON.parse(options.body) });
    return Response.json({ id: "re-1" });
  };
  try {
    const delivery = await deliverSiteEmail({ RESEND_API_KEY: "re_test" }, normalizeEmailPayload({
      kind: "devis",
      name: "Marie Rossi",
      phone: "07 45 15 60 76",
      email: "marie@example.com",
      city: "Porto-Vecchio",
      service: "videosurveillance",
      description: "Caméra 4G"
    }));
    assert.equal(delivery.provider, "resend");
    assert.equal(sent[0].body.from, "InfoServ2A <site@infoserv2a.pro>");
    assert.equal(sent[0].body.to[0], "contact@infoserv2a.pro");
    assert.match(sent[0].body.subject, /devis/i);
    assert.match(sent[0].body.html, /Caméra 4G/);
  } finally {
    globalThis.fetch = previous;
  }
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
  const response = await worker.fetch(new Request("https://infoserv2a.test/api/send-email"), env());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    configured: false,
    provider: null,
    secrets: { resend: false, from: false },
    inboxes: {
      contact: "contact@infoserv2a.pro",
      devis: "contact@infoserv2a.pro"
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

test("DEVIS_INBOX permet d’ouvrir devis@ plus tard", () => {
  const mail = normalizeEmailPayload({
    kind: "devis",
    name: "Marie Rossi",
    phone: "07 45 15 60 76",
    email: "marie@example.com",
    city: "Porto-Vecchio",
    service: "videosurveillance",
    description: "Caméra 4G"
  }, { DEVIS_INBOX: "devis@infoserv2a.pro" });
  assert.equal(mail.inbox, "devis@infoserv2a.pro");
});

test("EMAIL_TEST_INBOX ne détourne plus vers Gmail", () => {
  const mail = normalizeEmailPayload({
    kind: "contact",
    name: "Didier",
    email: "didier@example.com",
    message: "Vers contact@"
  }, { EMAIL_TEST_INBOX: "infoserv2a@gmail.com" });
  assert.equal(mail.inbox, "contact@infoserv2a.pro");
});

test("POST devis part vers contact@ tant que devis@ n’existe pas", async () => {
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
  assert.equal(payload.inbox, "contact@infoserv2a.pro");
  assert.equal(sent[0].to, "contact@infoserv2a.pro");
  assert.equal(sent[0].reply_to, "marie@example.com");
});

test("un challenge Cloudflare FormSubmit est un échec, pas un envoi", async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async () => new Response("<html>Just a moment...</html>", {
    status: 403,
    headers: { "cf-mitigated": "challenge" }
  });
  try {
    await assert.rejects(
      () => deliverSiteEmail({ EMAIL_PROVIDER: "formsubmit" }, normalizeEmailPayload({
        kind: "contact",
        name: "Didier",
        email: "didier@example.com",
        message: "Ne doit pas partir"
      })),
      /FormSubmit est bloqué/
    );
  } finally {
    globalThis.fetch = previous;
  }
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

test("GET ?id résume le statut Resend sans le corps du message", async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.match(String(url), /\/emails\/mail-1$/);
    return Response.json({
      id: "mail-1",
      last_event: "bounced",
      to: ["contact@infoserv2a.pro"],
      from: "InfoServ2A <site@infoserv2a.pro>",
      subject: "Contact InfoServ2A — Test",
      created_at: "2026-09-02T22:20:00Z",
      html: "<p>secret</p>",
      text: "secret"
    });
  };
  try {
    const response = await onRequestGet({
      request: new Request("https://www.infoserv2a.pro/api/send-email?id=mail-1", {
        headers: { Origin: "https://www.infoserv2a.pro" }
      }),
      env: { RESEND_API_KEY: "re_test" }
    });
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.lastEvent, "bounced");
    assert.deepEqual(payload.to, ["contact@infoserv2a.pro"]);
    assert.equal(payload.html, undefined);
    assert.equal(payload.text, undefined);
  } finally {
    globalThis.fetch = previous;
  }
});

test("summarizeResendEmail n’expose pas le corps", () => {
  const summary = summarizeResendEmail({
    id: "mail-2",
    last_event: "delivered",
    to: ["contact@infoserv2a.pro"],
    html: "<p>secret</p>",
    text: "secret"
  });
  assert.equal(summary.lastEvent, "delivered");
  assert.equal(summary.html, undefined);
  assert.equal(summary.text, undefined);
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
