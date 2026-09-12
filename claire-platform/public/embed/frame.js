const SDK_URL = "https://unpkg.com/@heygen/liveavatar-web-sdk@0.0.18/dist/index.esm.js";
const url = new URL(location.href);
const tenantId = url.searchParams.get("tenant") || "";
let ticket = new URLSearchParams(location.hash.slice(1)).get("ticket") || "";
history.replaceState(null, "", `${url.pathname}${url.search}`);

const elements = {
  avatar: document.querySelector("#avatar"),
  placeholder: document.querySelector("#placeholder"),
  status: document.querySelector("#status"),
  enableSound: document.querySelector("#enable-sound"),
  name: document.querySelector("#claire-name"),
  greeting: document.querySelector("#greeting"),
  transcript: document.querySelector("#transcript"),
  start: document.querySelector("#start"),
  close: document.querySelector("#close"),
  contact: document.querySelector("#contact"),
  overlay: document.querySelector("#lead-overlay"),
  leadClose: document.querySelector("#lead-close"),
  leadForm: document.querySelector("#lead-form"),
  leadResult: document.querySelector("#lead-result"),
  chatForm: document.querySelector("#chat-form"),
  message: document.querySelector("#message")
};
elements.start.disabled = true;

let session = null;
let sdk = null;
let sessionId = "";
let starting = false;

function headers(json = false) {
  return {
    Authorization: `Bearer ${ticket}`,
    ...(json ? { "Content-Type": "application/json" } : {})
  };
}

function setStatus(message) {
  elements.status.textContent = message;
}

async function enableAvatarSound() {
  const video = elements.avatar;
  video.defaultMuted = false;
  video.muted = false;
  video.volume = 1;
  try {
    await video.play();
  } catch {
    try {
      video.muted = true;
      await video.play();
    } catch { /* The stream may not be attached yet. */ }
  }

  const audible = !video.muted && !video.paused;
  elements.enableSound.hidden = audible;
  setStatus(audible
    ? "Son activé · Claire est connectée"
    : "Touchez « Activer le son » pour entendre Claire");
  return audible;
}

function transcript(speaker, message) {
  const line = document.createElement("p");
  const label = document.createElement("strong");
  label.textContent = `${speaker} : `;
  line.append(label, document.createTextNode(message));
  elements.transcript.append(line);
  line.scrollIntoView({ block: "nearest" });
}

async function api(path, options = {}) {
  const response = await fetch(path, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `HTTP ${response.status}`);
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function ensureEmbedTicket() {
  if (ticket) return ticket;
  if (!tenantId) throw new Error("Lien d’intégration Claire invalide.");
  const payload = await api(`/api/embed/bootstrap?tenant=${encodeURIComponent(tenantId)}`, {
    mode: "cors",
    credentials: "omit",
    headers: { Accept: "application/json" }
  });
  ticket = String(payload.embedTicket || "");
  if (!ticket) throw new Error("Ticket d’intégration Claire absent.");
  return ticket;
}

async function loadTenant() {
  if (!tenantId) throw new Error("Lien d’intégration Claire invalide.");
  await ensureEmbedTicket();
  const payload = await api(`/api/tenant?tenant=${encodeURIComponent(tenantId)}`, { headers: headers() });
  const tenant = payload.tenant;
  elements.name.textContent = tenant.persona.name;
  elements.greeting.textContent = tenant.persona.greeting;
  document.title = `${tenant.persona.name} · ${tenant.displayName}`;
  elements.start.disabled = false;
}

function wireSession(activeSession) {
  activeSession.on(sdk.SessionEvent.SESSION_STREAM_READY, async () => {
    await Promise.resolve(activeSession.attach(elements.avatar));
    elements.avatar.hidden = false;
    elements.placeholder.hidden = true;
    setStatus("Claire est connectée");
    await enableAvatarSound();
  });
  activeSession.on(sdk.SessionEvent.SESSION_DISCONNECTED, () => {
    setStatus("La session est terminée");
    elements.enableSound.hidden = true;
    elements.message.disabled = true;
    elements.chatForm.querySelector("button").disabled = true;
    session = null;
  });
  activeSession.on(sdk.AgentEventsEnum.USER_TRANSCRIPTION, (event) => {
    const text = String(event?.text || "").trim();
    if (text) transcript("Vous", text);
  });
  activeSession.on(sdk.AgentEventsEnum.AVATAR_TRANSCRIPTION, (event) => {
    const text = String(event?.text || "").trim();
    if (text) transcript(elements.name.textContent, text);
  });
  activeSession.on(sdk.AgentEventsEnum.USER_SPEAK_STARTED, () => setStatus("Je vous écoute…"));
  activeSession.on(sdk.AgentEventsEnum.AVATAR_SPEAK_STARTED, () => {
    if (elements.avatar.muted) {
      elements.enableSound.hidden = false;
      setStatus("Claire répond · activez le son");
    } else {
      setStatus("Claire vous répond…");
    }
  });
  activeSession.on(sdk.AgentEventsEnum.AVATAR_SPEAK_ENDED, () => setStatus("À votre écoute"));
}

async function start() {
  if (starting || session) return;
  starting = true;
  elements.start.disabled = true;
  setStatus("Connexion sécurisée…");
  try {
    await ensureEmbedTicket();
    const minted = await api("/api/liveavatar-session", {
      method: "POST",
      headers: headers(true),
      body: JSON.stringify({ tenantId, appId: tenantId, embedTicket: ticket })
    });
    const module = await import(SDK_URL);
    sdk = module;
    sessionId = minted.sessionId;
    session = new sdk.LiveAvatarSession(minted.sessionToken, { apiUrl: "https://api.liveavatar.com" });
    wireSession(session);
    await session.start();
    const voiceChat = session.voiceChat;
    if (voiceChat && String(voiceChat.state) === "INACTIVE") await voiceChat.start({ defaultMuted: false });
    await enableAvatarSound();
    try { session.startListening(); } catch { /* The SDK may already be listening. */ }
    elements.message.disabled = false;
    elements.chatForm.querySelector("button").disabled = false;
    elements.start.textContent = "Session active";
  } catch (error) {
    const missing = error.payload?.requiredSecrets?.join(", ");
    setStatus(missing ? `Configuration requise : ${missing}` : error.message);
    elements.start.disabled = false;
  } finally {
    starting = false;
  }
}

async function endSession() {
  if (!sessionId) return;
  const endingId = sessionId;
  sessionId = "";
  try {
    await fetch("/api/sessions/end", {
      method: "POST",
      keepalive: true,
      headers: headers(true),
      body: JSON.stringify({ tenantId, sessionId: endingId, embedTicket: ticket })
    });
  } catch { /* Metering end is best effort during page teardown. */ }
}

elements.start.addEventListener("click", start);
elements.enableSound.addEventListener("click", () => { void enableAvatarSound(); });
elements.close.addEventListener("click", () => parent.postMessage({ type: "claire:close" }, "*"));
elements.contact.addEventListener("click", () => { elements.overlay.hidden = false; });
elements.leadClose.addEventListener("click", () => { elements.overlay.hidden = true; });

elements.chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const message = elements.message.value.trim();
  if (!message || !session) return;
  transcript("Vous", message);
  session.message(message);
  elements.message.value = "";
  setStatus("Claire prépare sa réponse…");
});

elements.leadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.leadResult.textContent = "Envoi…";
  const formData = new FormData(elements.leadForm);
  try {
    await api("/api/leads", {
      method: "POST",
      headers: headers(true),
      body: JSON.stringify({ tenantId, embedTicket: ticket, ...Object.fromEntries(formData) })
    });
    elements.leadForm.reset();
    elements.leadResult.textContent = "Merci. Votre demande a bien été transmise.";
  } catch (error) {
    elements.leadResult.textContent = error.payload?.code === "LEAD_DELIVERY_NOT_CONFIGURED"
      ? "Le canal de contact de cette démo n’est pas encore configuré."
      : "L’envoi n’a pas abouti. Veuillez réessayer.";
  }
});

addEventListener("pagehide", endSession);
loadTenant().catch((error) => {
  setStatus(error.message);
  elements.start.disabled = true;
});
