import test from "node:test";
import assert from "node:assert/strict";

import worker from "../src/worker.js";
import { getTenant } from "../src/tenants.js";
import { issueEmbedTicket, verifyEmbedTicket } from "../src/security.js";
import {
  ClaireTenantState,
  quotaSnapshot,
  recordSessionEnd,
  recordSessionStart
} from "../src/tenant-state.js";

const allowedOrigin = "http://localhost:4173";

class MemoryStorage {
  constructor(values = new Map()) {
    this.values = values;
  }

  async get(key) {
    return this.values.get(key);
  }

  async put(key, value) {
    this.values.set(key, structuredClone(value));
  }

  async delete(key) {
    return this.values.delete(key);
  }

  async list({ prefix = "" } = {}) {
    return new Map([...this.values].filter(([key]) => key.startsWith(prefix)));
  }

  async transaction(callback) {
    return callback(this);
  }
}

function durableNamespace() {
  const records = new Map();
  const instances = new Map();
  const namespace = {
    getByName(name) {
      if (!records.has(name)) records.set(name, new Map());
      if (!instances.has(name)) {
        const durable = new ClaireTenantState({ storage: new MemoryStorage(records.get(name)) });
        instances.set(name, durable);
      }
      return { fetch: (input, init) => instances.get(name).fetch(new Request(input, init)) };
    },
    restart(name) {
      instances.delete(name);
    }
  };
  return namespace;
}

function platformEnv(overrides = {}) {
  return {
    CLAIRE_ENVIRONMENT: "test",
    CLAIRE_TENANT_STATE: durableNamespace(),
    ...overrides
  };
}

function request(path, { method = "GET", origin = allowedOrigin, body, headers = {} } = {}) {
  return new Request(`http://platform.test${path}`, {
    method,
    headers: {
      ...(origin ? { Origin: origin } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });
}

test("bootstrap accepts an allowlisted origin and returns CORS headers", async () => {
  const response = await worker.fetch(
    request("/api/embed/bootstrap?tenant=boulangerie-soleil"),
    platformEnv()
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), allowedOrigin);
  assert.match(payload.embedTicket, /^dev_/);
  assert.equal(payload.tenant.id, "boulangerie-soleil");
  assert.equal(payload.tenant.allowedOrigins, undefined);
});

test("an unknown tenant is rejected", async () => {
  const response = await worker.fetch(request("/api/embed/bootstrap?tenant=absent"), platformEnv());
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "Unknown tenant" });
});

test("a non-allowlisted origin is rejected without a permissive CORS header", async () => {
  const response = await worker.fetch(request(
    "/api/embed/bootstrap?tenant=boulangerie-soleil",
    { origin: "https://attacker.example" }
  ), platformEnv());

  assert.equal(response.status, 403);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
});

test("preflight reflects only the tenant's allowed origin", async () => {
  const response = await worker.fetch(request(
    "/api/liveavatar-session?tenant=boulangerie-soleil",
    { method: "OPTIONS" }
  ), platformEnv());

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), allowedOrigin);
  assert.match(response.headers.get("access-control-allow-methods"), /POST/);
  assert.match(response.headers.get("vary"), /Origin/);
});

test("iframe calls are authorized by the short-lived embed ticket", async () => {
  const env = platformEnv();
  const bootstrap = await worker.fetch(request("/api/embed/bootstrap?tenant=boulangerie-soleil"), env);
  const { embedTicket } = await bootstrap.json();
  const response = await worker.fetch(request("/api/tenant?tenant=boulangerie-soleil", {
    origin: "http://platform.test",
    headers: { Authorization: `Bearer ${embedTicket}` }
  }), env);

  assert.equal(response.status, 200);
  assert.equal((await response.json()).tenant.displayName, "Boulangerie du Soleil");
});

test("session mint returns actionable 503 and never invents provider traffic", async () => {
  const originalFetch = globalThis.fetch;
  let providerCalls = 0;
  globalThis.fetch = async () => {
    providerCalls += 1;
    throw new Error("provider should not be called");
  };
  try {
    const response = await worker.fetch(request("/api/liveavatar-session", {
      method: "POST",
      body: { tenantId: "boulangerie-soleil" }
    }), platformEnv());
    const payload = await response.json();

    assert.equal(response.status, 503);
    assert.equal(response.headers.get("access-control-allow-origin"), allowedOrigin);
    assert.equal(payload.code, "PLATFORM_NOT_CONFIGURED");
    assert.deepEqual(payload.requiredSecrets, [
      "LIVEAVATAR_API_KEY",
      "OPENAI_API_KEY or LIVEAVATAR_OPENAI_SECRET_ID"
    ]);
    assert.equal(providerCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Durable Object quota survives an object restart and blocks at the limit", async () => {
  const tenant = {
    ...getTenant("boulangerie-soleil"),
    id: "quota-test",
    quota: { minutesPerMonth: 1, maxSessionSeconds: 60 }
  };
  const start = Date.UTC(2026, 8, 11, 12, 0, 0);
  const namespace = durableNamespace();
  const env = platformEnv({ CLAIRE_TENANT_STATE: namespace });

  assert.equal((await recordSessionStart(env, tenant, "session-1", 60, start)).recorded, true);
  namespace.restart(tenant.id);
  assert.equal((await recordSessionEnd(env, tenant, "session-1", start + 60000)).recorded, true);
  namespace.restart(tenant.id);
  const quota = await quotaSnapshot(env, tenant, start + 60000);
  assert.equal(quota.usedMinutes, 1);
  assert.equal(quota.remainingMinutes, 0);
  assert.equal(quota.allowed, false);
  assert.equal((await recordSessionStart(env, tenant, "session-2", 60, start + 60001)).recorded, false);
});

test("HMAC ticket validation rejects tampering and survives a Durable Object restart", async () => {
  const tenant = getTenant("boulangerie-soleil");
  const namespace = durableNamespace();
  const env = platformEnv({
    CLAIRE_ENVIRONMENT: "staging",
    CLAIRE_TENANT_STATE: namespace,
    EMBED_SIGNING_SECRET: "test-signing-secret-with-sufficient-entropy"
  });
  const now = Date.UTC(2026, 8, 11, 12, 0, 0);
  const ticket = await issueEmbedTicket(tenant, allowedOrigin, env, now);

  assert.match(ticket, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  namespace.restart(tenant.id);
  assert.equal((await verifyEmbedTicket(ticket, tenant, env, now + 1000))?.origin, allowedOrigin);

  const replacement = ticket.endsWith("A") ? "B" : "A";
  const tampered = `${ticket.slice(0, -1)}${replacement}`;
  assert.equal(await verifyEmbedTicket(tampered, tenant, env, now + 1000), null);
  assert.equal(await verifyEmbedTicket(ticket, tenant, env, now + 600001), null);
});

test("bootstrap requires EMBED_SIGNING_SECRET outside local/development", async () => {
  const response = await worker.fetch(
    request("/api/embed/bootstrap?tenant=boulangerie-soleil"),
    platformEnv({ CLAIRE_ENVIRONMENT: "staging" })
  );
  const payload = await response.json();

  assert.equal(response.status, 503);
  assert.equal(payload.code, "PLATFORM_NOT_CONFIGURED");
  assert.deepEqual(payload.requiredSecrets, ["EMBED_SIGNING_SECRET"]);
});

test("/api/leads validates fields and reports an unconfigured tenant channel", async () => {
  const invalid = await worker.fetch(request("/api/leads", {
    method: "POST",
    body: { tenantId: "boulangerie-soleil", name: "", email: "invalid", message: "" }
  }), platformEnv());
  assert.equal(invalid.status, 400);
  assert.deepEqual((await invalid.json()).missing, ["name", "email", "message"]);

  const unconfigured = await worker.fetch(request("/api/leads", {
    method: "POST",
    body: {
      tenantId: "boulangerie-soleil",
      name: "Alice",
      email: "alice@example.test",
      message: "Commande spéciale"
    }
  }), platformEnv());
  assert.equal(unconfigured.status, 503);
  assert.equal((await unconfigured.json()).requiredSecret, "LEAD_WEBHOOK_BOULANGERIE_SOLEIL");
});

test("/api/leads sends a compact tenant-scoped webhook payload", async () => {
  const originalFetch = globalThis.fetch;
  let delivery;
  globalThis.fetch = async (url, options) => {
    delivery = { url: String(url), options };
    return new Response(null, { status: 204 });
  };
  try {
    const response = await worker.fetch(request("/api/leads", {
      method: "POST",
      body: {
        tenantId: "boulangerie-soleil",
        name: "  Alice   Martin ",
        email: "alice@example.test",
        phone: "01 02 03",
        message: " Une   commande spéciale "
      }
    }), platformEnv({
      LEAD_WEBHOOK_BOULANGERIE_SOLEIL: "https://hooks.example.test/claire",
      LEAD_EMAIL_BOULANGERIE_SOLEIL: "leads@example.test"
    }));

    assert.equal(response.status, 202);
    assert.equal(delivery.url, "https://hooks.example.test/claire");
    const payload = JSON.parse(delivery.options.body);
    assert.equal(payload.tenantId, "boulangerie-soleil");
    assert.equal(payload.origin, allowedOrigin);
    assert.equal(payload.lead.name, "Alice Martin");
    assert.equal(payload.lead.message, "Une commande spéciale");
    assert.equal(payload.destinationEmail, "leads@example.test");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
