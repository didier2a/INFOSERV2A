const DEFAULT_SDK_URL = "https://unpkg.com/@heygen/liveavatar-web-sdk@0.0.18/dist/index.esm.js";
const SESSION_MEDIA_TIMEOUT_MS = 45000;

let sdkPromise = null;

function validEndpoint(value) {
  if (!value) return "";
  const url = new URL(value, location.origin);
  if (url.origin !== location.origin && url.protocol !== "https:") {
    throw new TypeError("Le service LiveAvatar doit utiliser HTTPS.");
  }
  return url.href;
}

async function loadSdk(url) {
  if (sdkPromise) return sdkPromise;
  sdkPromise = import(url).then((sdk) => {
    if (!sdk?.LiveAvatarSession) throw new Error("SDK LiveAvatar invalide");
    return sdk;
  }).catch((error) => {
    sdkPromise = null;
    throw error;
  });
  return sdkPromise;
}

export class InfoServ2ALiveAvatarProvider {
  constructor({
    endpoint = "/api/liveavatar-session",
    sdkUrl = DEFAULT_SDK_URL,
    fetchImpl = globalThis.fetch
  } = {}) {
    this.id = "liveavatar-realtime";
    this.endpoint = validEndpoint(endpoint);
    this.sdkUrl = sdkUrl;
    this.fetchImpl = fetchImpl.bind(globalThis);
    this.session = null;
    this.sdk = null;
    this.video = null;
    this.connected = false;
    this.listening = false;
    this.startPromise = null;
    this.streamReady = false;
    this.callbacks = {};
  }

  install({ video, onTranscript, onAvatarTranscript, onStatus, onCommand } = {}) {
    this.video = video || null;
    this.callbacks = { onTranscript, onAvatarTranscript, onStatus, onCommand };
    this.callbacks.onStatus?.("ready", "LiveAvatar disponible sur activation");
    return this;
  }

  emit(value, label) {
    this.callbacks.onStatus?.(value, label);
  }

  async connect({ microphone = false } = {}) {
    if (this.connected) {
      if (microphone) await this.ensureMicrophone();
      return true;
    }
    if (this.startPromise) return this.startPromise;

    this.startPromise = (async () => {
      this.emit("connecting", "Connexion sécurisée à Claire…");
      try {
        const [sdk, response] = await Promise.all([
          loadSdk(this.sdkUrl),
          this.fetchImpl(this.endpoint, {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ appId: "infoserv2a", knowledgeVersion: "1.0.0" })
          })
        ]);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || `LiveAvatar HTTP ${response.status}`);
        if (!payload.sessionToken) throw new Error("Jeton de session LiveAvatar absent");

        this.sdk = sdk;
        const session = new sdk.LiveAvatarSession(payload.sessionToken, { apiUrl: "https://api.liveavatar.com" });
        this.session = session;
        const streamReady = this.wireSession(session, sdk);
        let sessionTimer;
        try {
          await Promise.race([
            (async () => {
              await session.start();
              await streamReady;
            })(),
            new Promise((_, reject) => {
              sessionTimer = setTimeout(() => {
                reject(new Error("La connexion vidéo LiveAvatar a dépassé le délai prévu."));
              }, SESSION_MEDIA_TIMEOUT_MS);
            })
          ]);
        } finally {
          clearTimeout(sessionTimer);
        }
        this.connected = true;
        if (microphone) await this.ensureMicrophone();
        else this.emit("ready", "Claire est connectée");
        return true;
      } catch (error) {
        await this.stop();
        this.emit("error", "LiveAvatar indisponible · mode local actif");
        throw error;
      } finally {
        this.startPromise = null;
      }
    })();
    return this.startPromise;
  }

  wireSession(session, sdk) {
    const { SessionEvent, AgentEventsEnum } = sdk;
    let resolveStream;
    let rejectStream;
    const streamReady = new Promise((resolve, reject) => {
      resolveStream = resolve;
      rejectStream = reject;
    });
    session.on(SessionEvent.SESSION_STREAM_READY, () => {
      if (this.video) {
        this.video.hidden = false;
        this.video.muted = false;
        session.attach(this.video);
        void this.video.play().catch(() => {});
      }
      this.streamReady = Boolean(this.video?.srcObject);
      if (!this.streamReady) {
        rejectStream(new Error("Les pistes LiveAvatar n’ont pas été attachées à la vidéo."));
        return;
      }
      resolveStream(true);
      this.emit("ready", "Claire · LiveAvatar Realtime");
    });
    session.on(SessionEvent.SESSION_DISCONNECTED, () => {
      rejectStream(new Error("La session LiveAvatar a été interrompue avant l’arrivée du flux vidéo."));
      this.connected = false;
      this.streamReady = false;
      this.listening = false;
      this.emit("error", "Session LiveAvatar interrompue");
    });
    session.on(AgentEventsEnum.USER_SPEAK_STARTED, () => {
      this.listening = true;
      this.emit("listening", "Je vous écoute");
    });
    session.on(AgentEventsEnum.USER_SPEAK_ENDED, () => this.emit("thinking", "J’analyse votre demande…"));
    session.on(AgentEventsEnum.USER_TRANSCRIPTION, (event) => {
      const text = String(event?.text || "").trim();
      if (!text) return;
      try { session.interrupt(); } catch { /* La réponse automatique n’a pas encore commencé. */ }
      void this.callbacks.onCommand?.(text);
    });
    session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, () => {
      this.listening = false;
      this.emit("speaking", "Claire vous répond");
    });
    session.on(AgentEventsEnum.AVATAR_TRANSCRIPTION, (event) => {
      const text = String(event?.text || "").trim();
      if (text) this.callbacks.onAvatarTranscript?.(text);
    });
    session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => this.emit("ready", "Prête à vous guider"));
    return streamReady;
  }

  async ensureMicrophone() {
    if (!this.session || !this.connected) return false;
    const chat = this.session.voiceChat;
    if (!chat) return false;
    if (String(chat.state) === "INACTIVE") await chat.start({ defaultMuted: false });
    else if (chat.isMuted) await chat.unmute();
    try { this.session.startListening(); } catch { /* Le SDK peut déjà écouter. */ }
    this.listening = true;
    this.emit("listening", "Je vous écoute");
    return true;
  }

  async toggleListening() {
    if (!this.connected) {
      await this.connect({ microphone: true });
      return this.listening;
    }
    const chat = this.session?.voiceChat;
    if (!chat) return false;
    if (String(chat.state) === "INACTIVE" || chat.isMuted) return this.ensureMicrophone();
    await chat.mute();
    try { this.session.stopListening(); } catch { /* Le SDK peut déjà être en pause. */ }
    this.listening = false;
    this.emit("ready", "Microphone en pause");
    return false;
  }

  async speak(text) {
    const value = String(text || "").trim();
    if (!value) return false;
    if (!this.connected) await this.connect({ microphone: false });
    if (!this.session) return false;
    const prompt = `[INFOSERV2A_APP_RESULT]\nInformation vérifiée par le site : ${value}\nRéponds en français naturel, brièvement, sans ajouter de fait ni prétendre avoir réalisé une autre action.`;
    this.session.message(prompt);
    this.emit("thinking", "Claire prépare sa réponse…");
    return true;
  }

  interrupt() {
    try { this.session?.interrupt(); } catch { /* Aucune réponse en cours. */ }
    this.emit(this.listening ? "listening" : "ready", this.listening ? "Je vous écoute" : "Prête à vous guider");
  }

  async stop() {
    const session = this.session;
    this.session = null;
    this.connected = false;
    this.streamReady = false;
    this.listening = false;
    try { await session?.stop(); } catch { /* Session déjà terminée. */ }
    try { await session?.room?.disconnect?.(); } catch { /* Transport LiveKit déjà fermé. */ }
    if (this.video) {
      this.video.hidden = true;
      this.video.srcObject = null;
    }
  }

  diagnostic() {
    return {
      id: this.id,
      endpoint: this.endpoint,
      connected: this.connected,
      streamReady: this.streamReady,
      listening: this.listening,
      connector: "OPENAI_REALTIME",
      transport: "ephemeral-session-token"
    };
  }
}
