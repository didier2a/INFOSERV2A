import { DurableObject } from "cloudflare:workers";

const encoder = new TextEncoder();

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", "Content-Type": "application/json" }
  });
}

function monthKey(now) {
  return new Date(now).toISOString().slice(0, 7);
}

function monthStart(now) {
  const date = new Date(now);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

function activeMinutes(session, now) {
  const startedAt = Math.max(Number(session.startedAt) || now, monthStart(now));
  const elapsedMs = Math.max(0, now - startedAt);
  const cappedMs = Math.min(elapsedMs, Math.max(60, Number(session.maxSessionSeconds) || 300) * 1000);
  return cappedMs / 60000;
}

async function quotaFromStorage(storage, limitMinutes, now) {
  const month = monthKey(now);
  const completedMinutes = Number(await storage.get(`quota:${month}`)) || 0;
  const sessions = await storage.list({ prefix: "session:" });
  let currentActiveMinutes = 0;
  for (const session of sessions.values()) {
    if (monthKey(Number(session.startedAt) || now) === month) {
      currentActiveMinutes += activeMinutes(session, now);
    }
  }
  const usedMinutes = completedMinutes + currentActiveMinutes;
  return {
    month,
    usedMinutes: Number(usedMinutes.toFixed(3)),
    limitMinutes,
    remainingMinutes: Number(Math.max(0, limitMinutes - usedMinutes).toFixed(3)),
    activeSessions: sessions.size,
    allowed: usedMinutes < limitMinutes
  };
}

async function ticketStorageKey(ticket) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(String(ticket))));
  let binary = "";
  for (const byte of digest) binary += String.fromCharCode(byte);
  return `ticket:${btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")}`;
}

export class ClaireTenantState extends DurableObject {
  constructor(state, env) {
    super(state, env);
    this.state = state;
  }

  async quotaSnapshot(limitMinutes, now = Date.now()) {
    return quotaFromStorage(this.state.storage, limitMinutes, now);
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/tickets/issue") {
      const { ticket, payload } = await request.json();
      await this.state.storage.put(await ticketStorageKey(ticket), payload);
      return json({ stored: true });
    }
    if (request.method === "POST" && url.pathname === "/tickets/verify") {
      const { ticket, now = Date.now() } = await request.json();
      const key = await ticketStorageKey(ticket);
      const payload = await this.state.storage.get(key);
      if (!payload || Number(payload.exp) <= Number(now)) {
        if (payload) await this.state.storage.delete(key);
        return json({ payload: null });
      }
      return json({ payload });
    }
    if (request.method === "GET" && url.pathname === "/quota") {
      const limit = Math.max(0, Number(url.searchParams.get("limit")) || 0);
      const now = Number(url.searchParams.get("now")) || Date.now();
      return json(await this.quotaSnapshot(limit, now));
    }
    if (request.method === "POST" && url.pathname === "/sessions/start") {
      const input = await request.json();
      const now = Number(input.now) || Date.now();
      const limitMinutes = Number(input.limitMinutes);
      const result = await this.state.storage.transaction(async (transaction) => {
        const snapshot = await quotaFromStorage(transaction, limitMinutes, now);
        if (!snapshot.allowed) return { recorded: false, ...snapshot };
        await transaction.put(`session:${String(input.sessionId)}`, {
          startedAt: now,
          maxSessionSeconds: Number(input.maxSessionSeconds) || 300
        });
        return { recorded: true };
      });
      if (!result.recorded) return json(result);
      return json({ recorded: true, ...await this.quotaSnapshot(limitMinutes, now) });
    }
    if (request.method === "POST" && url.pathname === "/sessions/end") {
      const input = await request.json();
      const now = Number(input.now) || Date.now();
      const key = `session:${String(input.sessionId)}`;
      const recorded = await this.state.storage.transaction(async (transaction) => {
        const session = await transaction.get(key);
        if (!session) return false;
        const month = monthKey(now);
        const quotaKey = `quota:${month}`;
        const completed = Number(await transaction.get(quotaKey)) || 0;
        await transaction.put(quotaKey, completed + activeMinutes(session, now));
        await transaction.delete(key);
        return true;
      });
      if (!recorded) {
        return json({ recorded: false, ...await this.quotaSnapshot(Number(input.limitMinutes), now) });
      }
      return json({ recorded: true, ...await this.quotaSnapshot(Number(input.limitMinutes), now) });
    }
    return json({ error: "Not found" }, 404);
  }
}

export class StateBindingError extends Error {
  constructor() {
    super("CLAIRE_TENANT_STATE Durable Object binding is required");
    this.name = "StateBindingError";
  }
}

function tenantStub(env, tenant) {
  if (!env.CLAIRE_TENANT_STATE?.getByName) throw new StateBindingError();
  return env.CLAIRE_TENANT_STATE.getByName(tenant.id);
}

async function stateJson(stub, path, options = {}) {
  const response = await stub.fetch(`https://claire-state.internal${path}`, options);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `Tenant state returned ${response.status}`);
  return payload;
}

export async function persistEmbedTicket(env, tenant, ticket, payload) {
  return stateJson(tenantStub(env, tenant), "/tickets/issue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticket, payload })
  });
}

export async function persistedEmbedTicket(env, tenant, ticket, now = Date.now()) {
  const result = await stateJson(tenantStub(env, tenant), "/tickets/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticket, now })
  });
  return result.payload || null;
}

export async function quotaSnapshot(env, tenant, now = Date.now()) {
  const query = new URLSearchParams({
    limit: String(tenant.quota.minutesPerMonth),
    now: String(now)
  });
  return stateJson(tenantStub(env, tenant), `/quota?${query}`);
}

export async function recordSessionStart(env, tenant, sessionId, maxSessionSeconds, now = Date.now()) {
  return stateJson(tenantStub(env, tenant), "/sessions/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      maxSessionSeconds,
      limitMinutes: tenant.quota.minutesPerMonth,
      now
    })
  });
}

export async function recordSessionEnd(env, tenant, sessionId, now = Date.now()) {
  return stateJson(tenantStub(env, tenant), "/sessions/end", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, limitMinutes: tenant.quota.minutesPerMonth, now })
  });
}
