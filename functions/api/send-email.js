import { corsHeaders, corsPreflight, isAllowedOrigin } from "./liveavatar-origin.js";

export const CONTACT_INBOX = "contact@infoserv2a.pro";
export const DEVIS_INBOX = CONTACT_INBOX;
export const DEFAULT_FROM = "InfoServ2A <contact@infoserv2a.pro>";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_LIMIT = 6;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const hits = new Map();

function json(data, status = 200, request) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'",
      "X-Content-Type-Options": "nosniff",
      ...corsHeaders(request)
    }
  });
}

export function resetEmailRateLimit() {
  hits.clear();
}

export function allowEmailRequest(ip, now = Date.now(), limit = RATE_LIMIT, windowMs = RATE_WINDOW_MS) {
  const key = String(ip || "unknown");
  const bucket = (hits.get(key) || []).filter((stamp) => now - stamp < windowMs);
  if (bucket.length >= limit) {
    hits.set(key, bucket);
    return false;
  }
  bucket.push(now);
  hits.set(key, bucket);
  return true;
}

export function compactField(value, max) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function resolveEmailProvider(env = {}) {
  if (typeof env.EMAIL?.send === "function") return "cloudflare-email";
  if (String(env.RESEND_API_KEY || "").trim()) return "resend";
  const forced = String(env.EMAIL_PROVIDER || "none").trim().toLowerCase();
  if (forced === "formsubmit") return "formsubmit";
  return "none";
}

export function emailConfigured(env = {}) {
  return resolveEmailProvider(env) !== "none";
}

export function inboxForKind(kind, env = {}) {
  if (kind === "devis") {
    return compactField(env.DEVIS_INBOX, 120) || compactField(env.CONTACT_INBOX, 120) || CONTACT_INBOX;
  }
  return compactField(env.CONTACT_INBOX, 120) || CONTACT_INBOX;
}

export function normalizeEmailPayload(input = {}, env = {}) {
  const kind = String(input.kind || "").trim() === "devis" ? "devis" : "contact";
  const honeypot = compactField(input.website || input.company_url || input._honey, 80);
  const name = compactField(input.name, 80);
  const email = compactField(input.email, 120);
  const phone = compactField(input.phone, 40);
  const city = compactField(input.city, 80);
  const service = compactField(input.service, 80);
  const message = compactField(input.message || input.description || input.body, 4000);
  const files = compactField(input.files, 400);
  const missing = [];
  if (!name) missing.push("name");
  if (!email || !EMAIL_RE.test(email)) missing.push("email");
  if (kind === "devis") {
    if (!phone) missing.push("phone");
    if (!city) missing.push("city");
    if (!service) missing.push("service");
    if (!message) missing.push("description");
  } else if (!message) {
    missing.push("message");
  }
  const inbox = inboxForKind(kind, env);
  const subject = kind === "devis"
    ? `Demande de devis InfoServ2A${name ? ` — ${name}` : ""}`
    : `Contact InfoServ2A${name ? ` — ${name}` : ""}`;
  const lines = [
    `Canal : ${kind === "devis" ? "demande de devis" : "message de contact"}`,
    `Nom : ${name}`,
    `E-mail : ${email}`,
    phone && `Téléphone : ${phone}`,
    city && `Commune : ${city}`,
    service && `Service : ${service}`,
    files && `Fichiers mentionnés (non joints par le site) : ${files}`,
    "",
    message
  ].filter((line, index, list) => line || list[index - 1]);
  return {
    kind,
    honeypot: Boolean(honeypot),
    missing,
    inbox,
    replyTo: email,
    subject,
    text: lines.join("\n").trim(),
    fields: { name, email, phone, city, service, message, files }
  };
}

function formSubmitActivated(payload) {
  const blob = JSON.stringify(payload || {}).toLowerCase();
  return !/activate|confirm your email|check your inbox to activate|pending/.test(blob);
}

function mailAsHtml(text) {
  const escaped = String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<pre style="font-family:sans-serif;font-size:15px;white-space:pre-wrap">${escaped}</pre>`;
}

async function deliverViaResend(env, mail) {
  const from = compactField(env.RESEND_FROM, 160) || DEFAULT_FROM;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${String(env.RESEND_API_KEY).trim()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [mail.inbox],
      reply_to: mail.replyTo,
      subject: mail.subject,
      text: mail.text,
      html: mailAsHtml(mail.text)
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(compactField(payload.message || payload.error, 200) || "Resend a refusé l’envoi");
    error.status = 502;
    error.detail = payload;
    throw error;
  }
  return { provider: "resend", id: payload.id || "", pendingActivation: false };
}

async function deliverViaCloudflare(env, mail) {
  const from = compactField(env.EMAIL_FROM, 160) || DEFAULT_FROM;
  const result = await env.EMAIL.send({
    from,
    to: mail.inbox,
    reply_to: mail.replyTo,
    subject: mail.subject,
    text: mail.text
  });
  return { provider: "cloudflare-email", id: result?.messageId || "", pendingActivation: false };
}

async function deliverViaFormSubmit(mail) {
  const response = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(mail.inbox)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      name: mail.fields.name,
      email: mail.fields.email,
      message: mail.text,
      _subject: mail.subject,
      _template: "box",
      _captcha: "false",
      _replyto: mail.replyTo
    })
  });
  const raw = await response.text();
  let payload = {};
  try { payload = JSON.parse(raw); } catch { payload = {}; }
  if (!response.ok || /just a moment|cf-mitigated|challenge/i.test(raw)) {
    const error = new Error("Le relais FormSubmit est bloqué. Utilisez Resend (RESEND_API_KEY).");
    error.status = 502;
    throw error;
  }
  const pendingActivation = !formSubmitActivated(payload);
  return {
    provider: "formsubmit",
    id: "",
    pendingActivation,
    providerMessage: compactField(payload.message || payload.success, 240)
  };
}

export async function deliverSiteEmail(env, mail) {
  const provider = resolveEmailProvider(env);
  if (provider === "none") {
    const error = new Error("Envoi d’e-mail non configuré");
    error.status = 503;
    throw error;
  }
  if (provider === "cloudflare-email") return deliverViaCloudflare(env, mail);
  if (provider === "resend") return deliverViaResend(env, mail);
  return deliverViaFormSubmit(mail);
}

export function onRequestOptions({ request }) {
  return corsPreflight(request);
}

export function summarizeResendEmail(payload = {}) {
  const to = Array.isArray(payload.to)
    ? payload.to.map((item) => compactField(item, 120)).filter(Boolean).slice(0, 3)
    : [];
  return {
    id: compactField(payload.id, 80),
    lastEvent: compactField(payload.last_event, 40),
    to,
    from: compactField(payload.from, 160),
    subject: compactField(payload.subject, 160),
    createdAt: compactField(payload.created_at, 80)
  };
}

export async function retrieveResendEmail(env, id) {
  const key = String(env.RESEND_API_KEY || "").trim();
  const emailId = compactField(id, 80);
  if (!key) return { error: "Resend non configuré", id: emailId };
  if (!emailId) return { error: "Identifiant manquant", id: "" };
  const response = await fetch(`https://api.resend.com/emails/${encodeURIComponent(emailId)}`, {
    headers: { Authorization: `Bearer ${key}` }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { error: compactField(payload.message || "Introuvable chez Resend", 200), id: emailId };
  }
  return summarizeResendEmail(payload);
}

export async function listRecentResendEmails(env, limit = 5) {
  const key = String(env.RESEND_API_KEY || "").trim();
  if (!key) return { error: "Resend non configuré", emails: [] };
  const response = await fetch("https://api.resend.com/emails", {
    headers: { Authorization: `Bearer ${key}` }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { error: compactField(payload.message || "Liste Resend indisponible", 200), emails: [] };
  }
  const rows = Array.isArray(payload.data) ? payload.data : [];
  return {
    emails: rows.slice(0, Math.max(1, Math.min(Number(limit) || 5, 10))).map(summarizeResendEmail)
  };
}

export async function onRequestGet({ env, request }) {
  const url = new URL(request.url);
  const emailId = compactField(url.searchParams.get("id"), 80);
  const recent = url.searchParams.get("recent") === "1";
  if (emailId || recent) {
    if (!isAllowedOrigin(request)) return json({ error: "Origine non autorisée" }, 403, request);
    if (emailId) {
      const status = await retrieveResendEmail(env, emailId);
      return json(status, status.error ? 502 : 200, request);
    }
    const listed = await listRecentResendEmails(env);
    return json(listed, listed.error ? 502 : 200, request);
  }
  const provider = resolveEmailProvider(env);
  return json({
    configured: provider !== "none",
    provider: provider === "none" ? null : provider,
    secrets: {
      resend: Boolean(String(env.RESEND_API_KEY || "").trim()),
      from: Boolean(String(env.RESEND_FROM || "").trim())
    },
    inboxes: {
      contact: inboxForKind("contact", env),
      devis: inboxForKind("devis", env)
    }
  }, 200, request);
}

export async function onRequestPost({ request, env }) {
  if (!isAllowedOrigin(request)) return json({ error: "Origine non autorisée", sent: false }, 403, request);
  const provider = resolveEmailProvider(env);
  if (provider === "none") {
    return json({ error: "Envoi d’e-mail non configuré", sent: false, configured: false }, 503, request);
  }
  const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "";
  if (!allowEmailRequest(ip)) {
    return json({ error: "Trop de tentatives. Réessayez dans quelques minutes.", sent: false }, 429, request);
  }

  let input = {};
  try {
    input = await request.json();
  } catch {
    return json({ error: "Requête JSON invalide", sent: false }, 400, request);
  }

  const mail = normalizeEmailPayload(input, env);
  if (mail.honeypot) {
    return json({ sent: true, inbox: mail.inbox, replyTo: mail.replyTo, ignored: true }, 200, request);
  }
  if (mail.missing.length) {
    return json({
      error: "Champs incomplets",
      sent: false,
      missing: mail.missing,
      inbox: mail.inbox
    }, 400, request);
  }

  try {
    const delivery = await deliverSiteEmail(env, mail);
    return json({
      sent: !delivery.pendingActivation,
      pendingActivation: Boolean(delivery.pendingActivation),
      configured: true,
      provider: delivery.provider,
      inbox: mail.inbox,
      replyTo: mail.replyTo,
      id: delivery.id || "",
      message: delivery.pendingActivation
        ? `Premier envoi : un e-mail d’activation arrive dans ${mail.inbox}. Ouvrez-le, confirmez, puis renvoyez la demande.`
        : `Message transmis vers ${mail.inbox}.`
    }, delivery.pendingActivation ? 202 : 200, request);
  } catch (error) {
    const status = Number(error.status) || 502;
    return json({
      error: status === 503 ? error.message : (error.message || "L’envoi n’a pas pu aboutir"),
      sent: false,
      configured: provider !== "none",
      inbox: mail.inbox
    }, status, request);
  }
}
