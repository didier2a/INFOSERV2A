const DEFAULT_SDK_URL = "https://unpkg.com/@heygen/liveavatar-web-sdk@0.0.18/dist/index.esm.js";
const SESSION_MEDIA_TIMEOUT_MS = 45000;
const TRANSCRIPT_SETTLE_MS = 950;
const ECHO_GUARD_MS = 900;

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
    this.mediaAudible = false;
    this.pendingSpeech = [];
    this.realtimeSignal = "idle";
    this.replyTimer = null;
    this.transcriptTimer = null;
    this.transcriptParts = [];
    this.commandInFlight = false;
    this.avatarSpeaking = false;
    this.ignoreInputUntil = 0;
    this.resumeListeningAfterAvatar = false;
    this.callbacks = {};
  }

  install({ video, onTranscript, onAvatarTranscript, onAvatarSpeakStart, onAvatarSpeakEnd, onStatus, onCommand } = {}) {
    this.video = video || null;
    this.callbacks = { onTranscript, onAvatarTranscript, onAvatarSpeakStart, onAvatarSpeakEnd, onStatus, onCommand };
    this.callbacks.onStatus?.("ready", "LiveAvatar disponible sur activation");
    return this;
  }

  emit(value, label) {
    this.callbacks.onStatus?.(value, label);
  }

  primeAudio() {
    if (!this.video) return false;
    this.video.muted = false;
    this.video.volume = 1;
    // L'appel est volontairement déclenché dans le geste utilisateur.
    // Sans flux, play() peut être rejeté ; le vrai déverrouillage sera
    // retenté dès que LiveAvatar attache ses deux pistes.
    void this.video.play().catch(() => {});
    return true;
  }

  async resumeMedia() {
    if (!this.video) return false;
    this.primeAudio();
    try {
      await this.video.play();
      this.mediaAudible = this.hasLiveAudio();
      if (!this.mediaAudible) throw new Error("Piste audio LiveAvatar absente");
      this.emit("ready", "Son Realtime activé");
      this.flushPendingSpeech();
      return true;
    } catch {
      this.mediaAudible = false;
      this.emit("sound", "Touchez Claire pour activer le son");
      return false;
    }
  }

  hasLiveAudio() {
    return Boolean(this.video?.srcObject?.getAudioTracks?.().some((track) => track.readyState === "live" && track.enabled));
  }

  hasLiveVideo() {
    return Boolean(this.video?.srcObject?.getVideoTracks?.().some((track) => track.readyState === "live" && track.enabled));
  }

  sendPrompt(value) {
    if (!this.session) return false;
    const prompt = `[INFOSERV2A_APP_RESULT]\nInformation vérifiée par le site : ${value}\nRéponds en français naturel, brièvement, sans ajouter de fait ni prétendre avoir réalisé une autre action.`;
    this.session.message(prompt);
    this.emit("thinking", "Claire prépare sa réponse…");
    return true;
  }

  flushPendingSpeech() {
    if (!this.mediaAudible || !this.session || !this.pendingSpeech.length) return;
    const pending = this.pendingSpeech.splice(0);
    pending.forEach((value) => this.sendPrompt(value));
  }

  clearReplyTimer() {
    clearTimeout(this.replyTimer);
    this.replyTimer = null;
  }

  armReplyTimer() {
    this.clearReplyTimer();
    this.replyTimer = setTimeout(() => {
      if (this.realtimeSignal === "reply-started") return;
      this.realtimeSignal = "reply-timeout";
      this.emit("error", "Micro reçu, mais OpenAI Realtime ne renvoie pas de réponse");
    }, 12000);
  }

  clearTranscriptBuffer() {
    clearTimeout(this.transcriptTimer);
    this.transcriptTimer = null;
    this.transcriptParts = [];
  }

  stageTranscript(value) {
    const text = String(value || "").trim();
    if (!text || this.avatarSpeaking || Date.now() < this.ignoreInputUntil) return;

    const previous = this.transcriptParts.at(-1) || "";
    if (previous === text) return;
    if (previous && text.toLocaleLowerCase("fr").startsWith(previous.toLocaleLowerCase("fr"))) {
      this.transcriptParts[this.transcriptParts.length - 1] = text;
    } else if (!previous.toLocaleLowerCase("fr").endsWith(text.toLocaleLowerCase("fr"))) {
      this.transcriptParts.push(text);
    }

    clearTimeout(this.transcriptTimer);
    this.realtimeSignal = "buffering-transcript";
    this.emit("listening", "Phrase en cours…");
    this.transcriptTimer = setTimeout(() => void this.flushTranscript(), TRANSCRIPT_SETTLE_MS);
  }

  async flushTranscript() {
    clearTimeout(this.transcriptTimer);
    this.transcriptTimer = null;
    if (this.avatarSpeaking || this.commandInFlight) {
      this.transcriptParts = [];
      return;
    }
    const text = this.transcriptParts.join(" ").replace(/\s+/g, " ").trim();
    this.transcriptParts = [];
    const significant = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, "");
    if (significant.length < 4) {
      this.realtimeSignal = "waiting-complete-phrase";
      this.emit("listening", "Continuez votre phrase…");
      return;
    }

    this.commandInFlight = true;
    this.realtimeSignal = "transcribed";
    this.emit("thinking", "Transcription reçue · préparation de la réponse…");
    try {
      await this.callbacks.onCommand?.(text);
    } finally {
      this.commandInFlight = false;
      this.ignoreInputUntil = Date.now() + ECHO_GUARD_MS;
    }
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
        // Le SDK officiel attache les pistes vidéo ET audio au même média.
        // On conserve donc ce média audible au lieu de détourner sa piste
        // vers un AudioContext parfois suspendu par Chrome Android.
        this.video.muted = false;
        this.video.volume = 1;
        session.attach(this.video);
      }
      this.streamReady = this.hasLiveVideo() && this.hasLiveAudio();
      if (!this.streamReady) {
        rejectStream(new Error("Les pistes audio et vidéo LiveAvatar n’ont pas toutes été attachées."));
        return;
      }
      resolveStream(true);
      void this.video.play().then(() => {
        this.mediaAudible = !this.video.muted && this.hasLiveAudio();
        if (this.mediaAudible) {
          this.emit("ready", "Claire · LiveAvatar Realtime · son actif");
          this.flushPendingSpeech();
        } else {
          this.emit("sound", "Touchez Claire pour activer le son");
        }
      }).catch(() => {
        // Android peut autoriser l'image mais refuser l'audio différé.
        // On affiche alors la vidéo en sourdine et le prochain toucher de
        // Claire exécute resumeMedia() dans un nouveau geste utilisateur.
        this.mediaAudible = false;
        this.video.muted = true;
        void this.video.play().catch(() => {});
        this.emit("sound", "Touchez Claire pour activer le son");
      });
    });
    session.on(SessionEvent.SESSION_DISCONNECTED, () => {
      rejectStream(new Error("La session LiveAvatar a été interrompue avant l’arrivée du flux vidéo."));
      this.connected = false;
      this.streamReady = false;
      this.listening = false;
      this.emit("error", "Session LiveAvatar interrompue");
    });
    session.on(AgentEventsEnum.USER_SPEAK_STARTED, () => {
      if (this.avatarSpeaking || Date.now() < this.ignoreInputUntil) return;
      this.listening = true;
      this.realtimeSignal = "input-detected";
      this.clearReplyTimer();
      this.emit("listening", "Je vous écoute");
    });
    session.on(AgentEventsEnum.USER_SPEAK_ENDED, () => {
      if (this.avatarSpeaking || Date.now() < this.ignoreInputUntil) return;
      this.realtimeSignal = "input-ended";
      this.armReplyTimer();
      this.emit("thinking", "Micro transmis · attente de la transcription…");
    });
    session.on(AgentEventsEnum.USER_TRANSCRIPTION, (event) => {
      const text = String(event?.text || "").trim();
      if (!text) return;
      if (this.avatarSpeaking || Date.now() < this.ignoreInputUntil) return;
      this.clearReplyTimer();
      try { session.interrupt(); } catch { /* La réponse automatique n’a pas encore commencé. */ }
      this.stageTranscript(text);
    });
    session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, () => {
      this.listening = false;
      this.avatarSpeaking = true;
      this.clearTranscriptBuffer();
      this.realtimeSignal = "reply-started";
      this.clearReplyTimer();
      const chat = this.session?.voiceChat;
      this.resumeListeningAfterAvatar = Boolean(chat && !chat.isMuted);
      if (this.resumeListeningAfterAvatar) void chat.mute().catch(() => {});
      this.callbacks.onAvatarSpeakStart?.();
      this.emit(this.mediaAudible ? "speaking" : "sound", this.mediaAudible ? "Claire vous répond" : "Touchez Claire pour entendre sa réponse");
    });
    session.on(AgentEventsEnum.AVATAR_TRANSCRIPTION, (event) => {
      const text = String(event?.text || "").trim();
      if (text) this.callbacks.onAvatarTranscript?.(text);
    });
    session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => {
      this.avatarSpeaking = false;
      this.ignoreInputUntil = Date.now() + ECHO_GUARD_MS;
      this.realtimeSignal = "reply-ended";
      this.clearReplyTimer();
      const chat = this.session?.voiceChat;
      if (this.resumeListeningAfterAvatar && chat?.isMuted) void chat.unmute().catch(() => {});
      this.resumeListeningAfterAvatar = false;
      this.callbacks.onAvatarSpeakEnd?.();
      this.emit("ready", "Prête à vous guider");
    });
    session.on(AgentEventsEnum.SESSION_STOPPED, () => {
      this.realtimeSignal = "connector-stopped";
      this.clearReplyTimer();
      this.emit("error", "Le connecteur OpenAI Realtime a arrêté la session");
    });
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
    if (!this.mediaAudible) {
      this.pendingSpeech.push(value);
      this.emit("sound", "Touchez Claire pour activer le son");
      return true;
    }
    return this.sendPrompt(value);
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
    this.mediaAudible = false;
    this.pendingSpeech = [];
    this.realtimeSignal = "idle";
    this.clearReplyTimer();
    this.clearTranscriptBuffer();
    this.commandInFlight = false;
    this.avatarSpeaking = false;
    this.ignoreInputUntil = 0;
    this.resumeListeningAfterAvatar = false;
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
      audioState: this.mediaAudible ? "audible" : (this.hasLiveAudio() ? "blocked" : "missing"),
      videoMuted: Boolean(this.video?.muted),
      realtimeSignal: this.realtimeSignal,
      commandInFlight: this.commandInFlight,
      avatarSpeaking: this.avatarSpeaking,
      listening: this.listening,
      connector: "OPENAI_REALTIME",
      transport: "ephemeral-session-token"
    };
  }
}
