import test from "node:test";
import assert from "node:assert/strict";

import worker from "../src/worker.js";
import { getTenant } from "../src/tenants.js";
import { quotaSnapshot, recordSessionEnd, recordSessionStart, resetMeters } from "../src/metering.js";
import { resetFallbackTickets } from "../src/security.js";

const allowedOrigin = "http://localhost:4173";

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

test.beforeEach(() => {
  resetFallbackTickets();
  resetMeters();
});

test("bootstrap accepts an allowlisted origin and returns CORS headers", async () => {
  const response = await worker.fetch(request("/api/embed/bootstrap?tenant=boulangerie-soleil"), {});
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), allowedOrigin);
  assert.match(payload.embedTicket, /^dev_/);
  assert.equal(payload.tenant.id, "boulangerie-soleil");
  assert.equal(payload.tenant.allowedOrigins, undefined);
});

test("an unknown tenant is rejected", async () => {
  const response = await worker.fetch(request("/api/embed/bootstrap?tenant=absent"), {});
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "Unknown tenant" });
});

test("a non-allowlisted origin is rejected without a permissive CORS header", async () => {
  const response = await worker.fetch(request(
    "/api/embed/bootstrap?tenant=boulangerie-soleil",
    { origin: "https://attacker.example" }
  ), {});

  assert.equal(response.status, 403);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
});

test("preflight reflects only the tenant's allowed origin", async () => {
  const response = await worker.fetch(request(
    "/api/liveavatar-session?tenant=boulangerie-soleil",
    { method: "OPTIONS" }
  ), {});

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), allowedOrigin);
  assert.match(response.headers.get("access-control-allow-methods"), /POST/);
  assert.match(response.headers.get("vary"), /Origin/);
});

test("iframe calls are authorized by the short-lived embed ticket", async () => {
  const bootstrap = await worker.fetch(request("/api/embed/bootstrap?tenant=boulangerie-soleil"), {});
  const { embedTicket } = await bootstrap.json();
  const response = await worker.fetch(request("/api/tenant?tenant=boulangerie-soleil", {
    origin: "http://platform.test",
    headers: { Authorization: `Bearer ${embedTicket}` }
  }), {});

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
    }), {});
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

test("quota stub records start/end minutes and blocks at the limit", () => {
  const tenant = {
    ...getTenant("boulangerie-soleil"),
    id: "quota-test",
    quota: { minutesPerMonth: 1, maxSessionSeconds: 60 }
  };
  const start = Date.UTC(2026, 8, 11, 12, 0, 0);

  assert.equal(recordSessionStart(tenant, "session-1", start).recorded, true);
  assert.equal(recordSessionEnd(tenant, "session-1", start + 60000).recorded, true);
  const quota = quotaSnapshot(tenant, start + 60000);
  assert.equal(quota.usedMinutes, 1);
  assert.equal(quota.remainingMinutes, 0);
  assert.equal(quota.allowed, false);
  assert.equal(recordSessionStart(tenant, "session-2", start + 60001).recorded, false);
});
