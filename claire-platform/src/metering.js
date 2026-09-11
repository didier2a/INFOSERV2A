const meters = new Map();

function monthKey(now) {
  return new Date(now).toISOString().slice(0, 7);
}

function tenantMeter(tenantId, now) {
  const key = String(tenantId);
  const month = monthKey(now);
  const current = meters.get(key);
  if (current?.month === month) return current;
  const fresh = { month, completedMinutes: 0, active: new Map() };
  meters.set(key, fresh);
  return fresh;
}

function elapsedMinutes(startedAt, now) {
  return Math.max(0, now - startedAt) / 60000;
}

export function quotaSnapshot(tenant, now = Date.now()) {
  const meter = tenantMeter(tenant.id, now);
  let activeMinutes = 0;
  for (const startedAt of meter.active.values()) activeMinutes += elapsedMinutes(startedAt, now);
  const usedMinutes = meter.completedMinutes + activeMinutes;
  return {
    month: meter.month,
    usedMinutes: Number(usedMinutes.toFixed(3)),
    limitMinutes: tenant.quota.minutesPerMonth,
    remainingMinutes: Number(Math.max(0, tenant.quota.minutesPerMonth - usedMinutes).toFixed(3)),
    activeSessions: meter.active.size,
    allowed: usedMinutes < tenant.quota.minutesPerMonth
  };
}

export function recordSessionStart(tenant, sessionId, now = Date.now()) {
  const snapshot = quotaSnapshot(tenant, now);
  if (!snapshot.allowed) return { recorded: false, ...snapshot };
  tenantMeter(tenant.id, now).active.set(String(sessionId), now);
  return { recorded: true, ...quotaSnapshot(tenant, now) };
}

export function recordSessionEnd(tenant, sessionId, now = Date.now()) {
  const meter = tenantMeter(tenant.id, now);
  const key = String(sessionId);
  const startedAt = meter.active.get(key);
  if (startedAt === undefined) return { recorded: false, ...quotaSnapshot(tenant, now) };
  meter.active.delete(key);
  meter.completedMinutes += elapsedMinutes(startedAt, now);
  return { recorded: true, ...quotaSnapshot(tenant, now) };
}

export function resetMeters() {
  meters.clear();
}
